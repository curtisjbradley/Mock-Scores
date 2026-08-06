import { Request, Response, Router } from "express";
import * as organizer from "../../providers/organizerProvider";
import { IPairingCreationPayload, IRound } from "@mock-scores/shared";
import { DbError, NotFoundError } from "../../errors";
import { uuidRegex } from "../../authUtils";
import { roundHandler } from "../../types/handlers";
import { scorerInviteEmail, roundResultsPublicEmail, sendEmail } from "../../email";
import { dbQuery } from "../../db";

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

/**
 * @swagger
 * /api/organizer/tournament/{tournamentId}/rounds/{round}/ballot-status:
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
 * POST /api/organizer/tournament/:tournamentId/rounds/:round/send-scoring-links
 * Sends scorecard invite emails to all registered scorers assigned to pairings
 * in this round. Fire-and-forget per email so one bad address doesn't block others.
 * Returns the count of emails dispatched.
 */
router.post('/send-scoring-links', roundHandler(async (req, res) => {
    const contexts = await organizer.getScorerInviteContextsForRound(req.round.round_id);
    let sent = 0;
    for (const ctx of contexts) {
        const scorecardUrl = `${BASE_URL}/score/${ctx.assignmentId}`;
        const template = scorerInviteEmail(ctx.tournamentName, scorecardUrl);
        sendEmail(ctx.email, template.subject, template.html, template.text)
            .then(() => { /* fire-and-forget */ })
            .catch(console.error);
        sent++;
    }
    return res.status(200).json({ sent });
}));

/**
 * POST /api/organizer/tournament/:tournamentId/rounds/:round/generate-pairings
 * Automatically generates pairings for the round using the specified method.
 * Accepts optional body: { method: 'random' | 'power' } (default: 'power')
 * Returns the array of created pairings.
 */
router.post('/generate-pairings', roundHandler(async (req, res) => {
    const method: 'random' | 'power' = req.body?.method === 'random' ? 'random' : 'power';
    const tournamentId = req.tournament;
    const roundId = req.round.round_id;

    // Check that the round has no existing pairings
    const existingPairings = await organizer.getPairings(roundId);
    if (existingPairings.length > 0) {
        return res.status(409).json({ message: 'Round already has pairings. Remove them before generating new ones.' });
    }

    // Get all teams for the tournament
    const teamsResult = await dbQuery<{ id: string; name: string }>('SELECT id, name FROM teams WHERE tournament_id = $1', [tournamentId]);
    if (!teamsResult) return res.status(500).json({ message: 'Failed to fetch teams' });
    const teams = teamsResult.rows;

    if (teams.length < 2) {
        return res.status(400).json({ message: 'Need at least 2 teams to generate pairings' });
    }

    // Get all existing pairings across ALL rounds in this tournament for history
    const historyResult = await dbQuery<{ p_team: string; d_team: string; round_id: string }>(
        `SELECT p.p_team, p.d_team, p.round_id FROM pairings p
         JOIN rounds r ON r.round_id = p.round_id
         WHERE r.tournament_id = $1`,
        [tournamentId]
    );
    const allPairings = historyResult?.rows ?? [];

    // Track side counts per team (how many times prosecution vs defense)
    const prosCount: Record<string, number> = {};
    const defCount: Record<string, number> = {};
    const matchupSet = new Set<string>(); // "teamA:teamB" regardless of sides

    for (const p of allPairings) {
        prosCount[p.p_team] = (prosCount[p.p_team] ?? 0) + 1;
        defCount[p.d_team] = (defCount[p.d_team] ?? 0) + 1;
        // Store matchup in both directions for easy lookup
        matchupSet.add(`${p.p_team}:${p.d_team}`);
        matchupSet.add(`${p.d_team}:${p.p_team}`);
    }

    // For power matching, get win/loss records from ballots
    const winCounts: Record<string, number> = {};
    if (method === 'power') {
        const ballotsResult = await dbQuery<{ p_team_id: string; d_team_id: string; p_points: number; d_points: number }>(
            `SELECT b.p_team_id, b.d_team_id, b.p_points, b.d_points
             FROM ballots b WHERE b.tournament_id = $1`,
            [tournamentId]
        );
        if (ballotsResult) {
            for (const b of ballotsResult.rows) {
                if (b.p_points > b.d_points) {
                    winCounts[b.p_team_id] = (winCounts[b.p_team_id] ?? 0) + 1;
                } else if (b.d_points > b.p_points) {
                    winCounts[b.d_team_id] = (winCounts[b.d_team_id] ?? 0) + 1;
                }
            }
        }
    }

    // Order teams based on method
    const orderedTeams = [...teams];
    if (method === 'power') {
        // Sort by win count descending
        orderedTeams.sort((a, b) => (winCounts[b.id] ?? 0) - (winCounts[a.id] ?? 0));
    } else {
        // Random shuffle (Fisher-Yates)
        for (let i = orderedTeams.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [orderedTeams[i], orderedTeams[j]] = [orderedTeams[j], orderedTeams[i]];
        }
    }

    // If odd number of teams, remove the last one (bye)
    if (orderedTeams.length % 2 !== 0) {
        orderedTeams.pop();
    }

    // Try to avoid rematches by swapping within adjacent pairs if needed
    // Simple greedy: for each pair, check if they've already faced each other
    // If so, try to swap with the next pair
    for (let i = 0; i < orderedTeams.length - 1; i += 2) {
        const a = orderedTeams[i].id;
        const b = orderedTeams[i + 1].id;
        if (matchupSet.has(`${a}:${b}`) && i + 3 < orderedTeams.length) {
            // Try swapping b with the next pair's second team
            const c = orderedTeams[i + 2].id;
            const d = orderedTeams[i + 3].id;
            if (!matchupSet.has(`${a}:${d}`) && !matchupSet.has(`${c}:${b}`)) {
                [orderedTeams[i + 1], orderedTeams[i + 3]] = [orderedTeams[i + 3], orderedTeams[i + 1]];
            }
        }
    }

    // Get courtrooms for assignment
    const courtroomsResult = await dbQuery<{ id: string }>('SELECT id FROM courtrooms WHERE tournament_id = $1', [tournamentId]);
    const courtrooms = courtroomsResult?.rows ?? [];

    // Generate pairings
    const createdPairings = [];
    for (let i = 0; i < orderedTeams.length - 1; i += 2) {
        const teamA = orderedTeams[i];
        const teamB = orderedTeams[i + 1];

        // Side assignment: team with fewer prosecution appearances gets prosecution
        const aPros = prosCount[teamA.id] ?? 0;
        const bPros = prosCount[teamB.id] ?? 0;
        let prosecution: string;
        let defense: string;

        if (aPros < bPros) {
            prosecution = teamA.id;
            defense = teamB.id;
        } else if (bPros < aPros) {
            prosecution = teamB.id;
            defense = teamA.id;
        } else {
            // Equal — assign based on defense count (fewer defense → defense)
            const aDef = defCount[teamA.id] ?? 0;
            const bDef = defCount[teamB.id] ?? 0;
            if (aDef <= bDef) {
                prosecution = teamA.id;
                defense = teamB.id;
            } else {
                prosecution = teamB.id;
                defense = teamA.id;
            }
        }

        // Courtroom assignment: cycle through available courtrooms
        const courtroomId = courtrooms.length > 0
            ? courtrooms[Math.floor(i / 2) % courtrooms.length].id
            : null;

        const pairing = await organizer.createRoundPairing(roundId, prosecution, defense, courtroomId as string);
        createdPairings.push(pairing);
    }

    return res.status(201).json(createdPairings);
}));

/**
 * POST /api/organizer/tournament/:tournamentId/rounds/:round/pairings/:pairing/scorers/:assignment/resend-link
 * Resends the scorecard invite email to a specific scorer assignment.
 * Only works for registered scorers (paper scorers have no email).
 * Returns 200 with { sent: true } on success, 404 if context not found.
 */
router.post('/pairings/:pairing/scorers/:assignment/resend-link', async (req: Request, res: Response) => {
    const pairing = req.params.pairing as string;
    const assignment = req.params.assignment as string;
    if (!uuidRegex.test(pairing)) return res.status(400).json({ message: 'Invalid pairing ID' });
    if (!uuidRegex.test(assignment)) return res.status(400).json({ message: 'Invalid assignment ID' });

    const ctx = await organizer.getScorerInviteContextForAssignment(pairing, assignment);
    if (!ctx) return res.status(404).json({ message: 'Scorer not found or is a paper scorer' });

    const scorecardUrl = `${BASE_URL}/score/${assignment}`;
    const template = scorerInviteEmail(ctx.tournamentName, scorecardUrl);
    sendEmail(ctx.email, template.subject, template.html, template.text).catch(console.error);

    return res.status(200).json({ sent: true });
});

export default router;
