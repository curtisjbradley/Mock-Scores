import { Router } from "express";
import * as organizer from "../../providers/organizerProvider";
import { IPairingCreationPayload, IRound } from "@mock-scores/shared";
import { DbError, NotFoundError } from "../../errors";
import { roundHandler } from "../../types/handlers";
import { scorerInviteEmail, roundResultsPublicEmail, sendEmail, sendTrackedEmail } from "../../email";

const BASE_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

const router = Router();

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/rounds/{round}:
 *   get:
 *     summary: Get a round
 *     tags: [Organizer - Rounds]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: round
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Round object }
 *       404: { description: Not found }
 */
router.get("/", roundHandler(async (req, res) => {
    return res.status(200).json(req.round);
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/rounds/{round}:
 *   patch:
 *     summary: Update a round
 *     tags: [Organizer - Rounds]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: round
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, results_public, teams_public]
 *             properties:
 *               name: { type: string }
 *               results_public: { type: boolean }
 *               teams_public: { type: boolean }
 *               round_time: { type: string, format: date-time, nullable: true }
 *     responses:
 *       200: { description: Updated round }
 *       400: { description: Missing required fields }
 *       404: { description: Not found }
 */
router.patch("/", roundHandler(async (req, res) => {
    const body: IRound = req.body;
    if (body.name == undefined || body.results_public == undefined || body.teams_public == undefined)
        return res.status(400).json({ message: "Missing required fields" });

    // results_public and teams_public are one-way: once true they cannot be unset
    if (req.round.results_public && !body.results_public)
        return res.status(400).json({ message: "Results cannot be made private once published" });
    if (req.round.teams_public && !body.teams_public)
        return res.status(400).json({ message: "Teams cannot be made private once published" });

    try {
        const wasPublic = req.round.results_public;
        const updated = await organizer.updateRound(req.round.round_id, body);
        // Fire results-public emails only on the false→true transition
        if (!wasPublic && updated.results_public) {
            organizer.getRoundResultsPublicContext(req.round.round_id).then(ctx => {
                if (!ctx || ctx.coachEmails.length === 0) return;
                const standingsUrl = `${BASE_URL}/coach`;
                const template = roundResultsPublicEmail(ctx.tournamentName, ctx.roundName, standingsUrl);
                return Promise.all(ctx.coachEmails.map(email =>
                    sendEmail(email, template.subject, template.html, template.text).catch(console.error)
                ));
            }).catch(console.error);
        }
        return res.status(200).json(updated);
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/rounds/{round}:
 *   delete:
 *     summary: Delete a round
 *     tags: [Organizer - Rounds]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: round
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Deleted }
 *       404: { description: Not found }
 */
router.delete("/", roundHandler(async (req, res) => {
    try {
        const row = await organizer.deleteRound(req.round.round_id);
        return res.status(204).json({ ...row, round_time: row.round_time?.toISOString() ?? null });
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/rounds/{round}/pairings:
 *   get:
 *     summary: Get pairings for a round
 *     tags: [Organizer - Rounds]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: round
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Array of pairings }
 *       500: { description: Database error }
 */
router.get('/pairings', roundHandler(async (req, res) => {
    try {
        return res.status(200).json(await organizer.getPairings(req.round.round_id));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/rounds/{round}/pairings:
 *   post:
 *     summary: Create a pairing in a round
 *     tags: [Organizer - Rounds]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: round
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [prosectionID, defenseID, courtroomID]
 *             properties:
 *               prosectionID: { type: string, format: uuid }
 *               defenseID: { type: string, format: uuid }
 *               courtroomID: { type: string | null, format: uuid }
 *     responses:
 *       201: { description: Created pairing }
 *       400: { description: Missing fields or duplicate teams }
 *       409: { description: Team already assigned this round }
 *       500: { description: Database error }
 */
router.post('/pairings', roundHandler(async (req, res) => {
    const { prosectionID, defenseID, courtroomID }: IPairingCreationPayload = req.body;
    if (!prosectionID || !defenseID) return res.status(400).json({ message: "Missing required fields" });
    if (prosectionID === defenseID) return res.status(400).json({ message: "Prosecution and defense teams must differ" });
    try {
        return res.status(201).json(await organizer.createRoundPairing(req.round.round_id, prosectionID, defenseID, courtroomID));
    } catch (e: unknown) {
        const detail: string = (e as { detail?: string })?.detail ?? '';
        if (detail.includes('p_team')) return res.status(409).json({ message: "That team is already assigned as prosecution this round" });
        if (detail.includes('d_team')) return res.status(409).json({ message: "That team is already assigned as defense this round" });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to create pairing' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/rounds/{round}/ballot-status:
 *   get:
 *     summary: Get ballot submission status for all pairings in a round
 *     tags: [Organizer - Rounds]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: round
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Array of ballot status per pairing
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   pairing_id: { type: string, format: uuid }
 *                   total_scorers: { type: integer }
 *                   submitted: { type: integer }
 *       500: { description: Database error }
 */
router.get('/ballot-status', roundHandler(async (req, res) => {
    try {
        return res.status(200).json(await organizer.getBallotStatus(req.round.round_id));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
}));



/**
 * @swagger
 * /organizer/tournament/{tournamentId}/rounds/{round}/send-scoring-links:
 *   post:
 *     summary: Sends scorecard invite emails to all registered scorers assigned to pairing in this round.
 *     tags: [Organizer - Rounds]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: round
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Number of emails sent
 *         content:
 *           application/json:
 *              schema:
 *                  sent: { type: boolean }
 *       500: { description: Database error }
 */
router.post('/send-scoring-links', roundHandler(async (req, res) => {
    // Scoring links must never go out before the round is locked (scoring opens on lock).
    if (!req.round.locked) {
        return res.status(409).json({ message: 'Lock the round before sending scoring links.' });
    }
    // Bulk send is one-time per round: if any scoring-link email has already been
    // recorded for this round's assignments, refuse (individual resends use the
    // per-assignment endpoint). This holds even across page reloads / other clients.
    if (await organizer.hasSentScoringLinksForRound(req.round.round_id)) {
        return res.status(409).json({ message: 'Scoring links have already been sent for this round.' });
    }
    const contexts = await organizer.getScorerInviteContextsForRound(req.round.round_id);
    let sent = 0;
    for (const ctx of contexts) {
        const scorecardUrl = `${BASE_URL}/score/${ctx.assignmentId}`;
        const template = scorerInviteEmail(ctx.tournamentName, scorecardUrl);
        sendTrackedEmail(ctx.email, template.subject, template.html, template.text,
            { type: 'scoring_link', id: ctx.assignmentId })
            .catch(console.error);
        sent++;
    }
    return res.status(200).json({ sent });
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/rounds/{round}/send-scoring-links/{assignment}:
 *   post:
 *     summary: Sends scorecard invite to the registered scorer's assignment id.
 *     tags: [Organizer - Scorers]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: round
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: assignment
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: {description: Success message}
 *       404: {description: Cannot find the assignment}
 *       500: { description: Database error }
 */
router.post('/send-scoring-links/:assignment', roundHandler(async (req, res) => {
    // Scoring links must never go out before the round is locked (scoring opens on lock).
    if (!req.round.locked) {
        return res.status(409).json({ message: 'Lock the round before sending scoring links.' });
    }
    const assignment = req.params.assignment as string;
    const context = await organizer.getScorerInviteContextForAssignment(assignment);
    if (context === null) {
        return res.status(404).json({message: "Cannot resolve scoring assignment"})
    }

    const scorecardUrl = `${BASE_URL}/score/${context.assignmentId}`;
    const template = scorerInviteEmail(context.tournamentName, scorecardUrl);
    return await sendTrackedEmail(context.email, template.subject, template.html, template.text,
        { type: 'scoring_link', id: context.assignmentId })
        .then(() => res.status(200).json({sent: true}) )
        .catch((err) => res.status(500).json({message: `Error when attempting to send email: ${err}`}))
}));

export default router;
