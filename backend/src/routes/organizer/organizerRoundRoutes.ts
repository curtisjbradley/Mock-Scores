import { Request, Response, Router } from "express";
import * as organizer from "../../providers/organizerProvider";
import { IPairingCreationPayload, IRound } from "@mock-scores/shared";
import { DbError, NotFoundError } from "../../errors";
import { uuidRegex } from "../../authUtils";
import { roundHandler } from "../../types/handlers";
import { scorerInviteEmail, roundResultsPublicEmail, sendEmail } from "../../email";

const BASE_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

const router = Router();

/**
 * @swagger
 * /api/organizer/tournament/{tournamentId}/rounds/{round}:
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
 * /api/organizer/tournament/{tournamentId}/rounds/{round}:
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
 * /api/organizer/tournament/{tournamentId}/rounds/{round}:
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
 * /api/organizer/tournament/{tournamentId}/rounds/{round}/pairings:
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
 * /api/organizer/tournament/{tournamentId}/rounds/{round}/pairings:
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
 *               courtroomID: { type: string, format: uuid }
 *     responses:
 *       201: { description: Created pairing }
 *       400: { description: Missing fields or duplicate teams }
 *       409: { description: Team already assigned this round }
 *       500: { description: Database error }
 */
router.post('/pairings', roundHandler(async (req, res) => {
    const { prosectionID, defenseID, courtroomID }: IPairingCreationPayload = req.body;
    if (!prosectionID || !defenseID || !courtroomID) return res.status(400).json({ message: "Missing required fields" });
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
 * /api/organizer/tournament/{tournamentId}/rounds/{round}/pairings/{pairing}:
 *   delete:
 *     summary: Delete a pairing
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
 *       - in: path
 *         name: pairing
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Deleted }
 *       400: { description: Invalid pairing ID }
 *       404: { description: Not found }
 */
router.delete('/pairings/:pairing', async (req: Request, res: Response) => {
    const pairing = req.params.pairing as string;
    if (!uuidRegex.test(pairing)) return res.status(400).json({ message: 'Invalid pairing ID' });
    try {
        await organizer.deletePairing(pairing);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
});

/**
 * @swagger
 * /api/organizer/tournament/{tournamentId}/rounds/{round}/pairings/{pairing}/scorers:
 *   get:
 *     summary: Get scorers assigned to a pairing
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
 *       - in: path
 *         name: pairing
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Array of scorer assignments }
 *       400: { description: Invalid pairing ID }
 */
router.get('/pairings/:pairing/scorers', async (req: Request, res: Response) => {
    const pairing = req.params.pairing as string;
    if (!uuidRegex.test(pairing)) return res.status(400).json({ message: 'Invalid pairing ID' });
    return res.status(200).json(await organizer.getPairingScorers(pairing));
});

/**
 * @swagger
 * /api/organizer/tournament/{tournamentId}/rounds/{round}/pairings/{pairing}/scorers:
 *   post:
 *     summary: Assign a scorer to a pairing
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
 *       - in: path
 *         name: pairing
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scorer_id: { type: string, format: uuid }
 *               paper_name: { type: string }
 *     responses:
 *       201: { description: Assignment created }
 *       400: { description: Invalid ID or missing body }
 *       500: { description: Unable to assign scorer }
 */
router.post('/pairings/:pairing/scorers', async (req: Request, res: Response) => {
    const pairing = req.params.pairing as string;
    if (!uuidRegex.test(pairing)) return res.status(400).json({ message: 'Invalid pairing ID' });
    const { scorer_id, paper_name } = req.body as { scorer_id?: string; paper_name?: string };
    try {
        if (scorer_id) {
            if (!uuidRegex.test(scorer_id)) return res.status(400).json({ message: 'Invalid scorer ID' });
            const result = await organizer.assignScorerToPairing(pairing, scorer_id);
            // Fire-and-forget invite email
            organizer.getScorerInviteContext(pairing, scorer_id).then(ctx => {
                if (!ctx) return;
                const scorecardUrl = `${BASE_URL}/score/${result.assignment_id}`;
                const template = scorerInviteEmail(ctx.tournamentName, scorecardUrl);
                return sendEmail(ctx.email, template.subject, template.html, template.text);
            }).catch(console.error);
            return res.status(201).json(result);
        }
        if (paper_name?.trim()) {
            return res.status(201).json(await organizer.addPaperScorer(pairing, paper_name.trim()));
        }
        return res.status(400).json({ message: 'Provide scorer_id or paper_name' });
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to assign scorer' });
        throw e;
    }
});

/**
 * @swagger
 * /api/organizer/tournament/{tournamentId}/rounds/{round}/pairings/{pairing}/scorers/{assignment}:
 *   delete:
 *     summary: Remove a scorer assignment from a pairing
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
 *       - in: path
 *         name: pairing
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: assignment
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Removed }
 *       400: { description: Invalid assignment ID }
 *       404: { description: Not found }
 */
router.delete('/pairings/:pairing/scorers/:assignment', async (req: Request, res: Response) => {
    const assignment = req.params.assignment as string;
    if (!uuidRegex.test(assignment)) return res.status(400).json({ message: 'Invalid assignment ID' });
    try {
        await organizer.removeScorerAssignment(assignment);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
});

/**
 * @swagger
 * /api/organizer/tournament/{tournamentId}/rounds/{round}/pairings/{pairing}/presider:
 *   put:
 *     summary: Set the presiding scorer for a pairing
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
 *       - in: path
 *         name: pairing
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [assignment_id]
 *             properties:
 *               assignment_id: { type: string, format: uuid }
 *     responses:
 *       200: { description: Presider set }
 *       400: { description: Invalid ID }
 *       500: { description: Database error }
 */
router.put('/pairings/:pairing/presider', async (req: Request, res: Response) => {
    const pairing = req.params.pairing as string;
    if (!uuidRegex.test(pairing)) return res.status(400).json({ message: 'Invalid pairing ID' });
    const { assignment_id } = req.body as { assignment_id: string };
    if (!assignment_id || !uuidRegex.test(assignment_id)) return res.status(400).json({ message: 'Invalid assignment_id' });
    try {
        await organizer.setPresider(pairing, assignment_id);
        return res.status(200).json({ success: true });
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to set presider' });
        throw e;
    }
});

/**
 * @swagger
 * /api/organizer/tournament/{tournamentId}/rounds/{round}/pairings/{pairing}/presider:
 *   delete:
 *     summary: Clear the presiding scorer for a pairing
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
 *       - in: path
 *         name: pairing
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Cleared }
 *       400: { description: Invalid pairing ID }
 */
router.delete('/pairings/:pairing/presider', async (req: Request, res: Response) => {
    const pairing = req.params.pairing as string;
    if (!uuidRegex.test(pairing)) return res.status(400).json({ message: 'Invalid pairing ID' });
    await organizer.clearPresider(pairing);
    return res.status(204).send();
});

export default router;
