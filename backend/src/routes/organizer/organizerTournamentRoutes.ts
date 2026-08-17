import { NextFunction, Request, Response, Router } from "express";
import { IRound, TournamentPayload, IWitnesses, IOrganizer, IScorer, ITeam } from "@mock-scores/shared";
import { AlreadyExistsError, DbError, NotFoundError, OrganizerAlreadyJoinedError } from "../../errors";
import * as organizer from "../../providers/organizerProvider";
import * as coachProvider from "../../providers/coachProvider";
import * as scorerProv from "../../providers/scorerProvider";
import roundRoutes from "./organizerRoundRoutes";
import { uuidRegex } from "../../authUtils";
import { transferOwnership } from "../../providers/coachProvider";
import { TournamentRequest } from "../../types/express";
import { tournamentHandler, scorerHandler, organizerHandler, teamHandler } from "../../types/handlers";
import {EmailTemplate, isValidEmail, organizerAddedEmail, sendEmail, teamAddedEmail} from "../../email";
import { removeCoachHandler, addStudentHandler } from "../teamHandlers";
import { dbQuery } from "../../db";

function validateWitnessCounts(format: TournamentPayload['caseFormat'], witnesses: IWitnesses): string | null {
    const swing = witnesses.swingWitnessNames.length;
    if (format.pWitnessesCalled != null && witnesses.pWitnessNames.length + swing > 0 &&
        format.pWitnessesCalled > witnesses.pWitnessNames.length + swing)
        return 'P witnesses called exceeds available witnesses';
    if (format.dWitnessesCalled != null && witnesses.dWitnessNames.length + swing > 0 &&
        format.dWitnessesCalled > witnesses.dWitnessNames.length + swing)
        return 'D witnesses called exceeds available witnesses';
    return null;
}
import {getTournament} from "../../providers/organizerProvider";

const router = Router();

// ── Tournament ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /organizer/tournament/{tournamentId}:
 *   get:
 *     summary: Get tournament details
 *     tags: [Organizer - Tournament]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Tournament object }
 *       404: { description: Not found }
 */
router.get("/", tournamentHandler(async (req, res) => {
    try {
        return res.status(200).json(await organizer.getTournament(req.tournament));
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}:
 *   patch:
 *     summary: Update tournament details
 *     tags: [Organizer - Tournament]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tournament]
 *             properties:
 *               tournament: { type: object }
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Missing tournament in body }
 *       404: { description: Not found }
 *       500: { description: Unable to update tournament }
 */
router.patch("/", tournamentHandler(async (req, res) => {
    const { tournament: t } = req.body as { tournament: TournamentPayload['tournament'] };
    if (!t) return res.status(400).json({ message: 'Missing tournament in body' });
    try {
        await organizer.updateTournamentDetails(req.tournament, t);
        return res.status(200).json({ success: true });
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to update tournament' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/status:
 *   patch:
 *     summary: Update tournament status (active, completed, or archived)
 *     tags: [Organizer - Tournament]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [active, completed, archived] }
 *     responses:
 *       200: { description: Status updated }
 *       400: { description: Invalid status value }
 *       404: { description: Not found }
 *       500: { description: Unable to update status }
 */
router.patch("/status", tournamentHandler(async (req, res) => {
    const { status } = req.body as { status?: string };
    if (!status || !['active', 'completed', 'archived'].includes(status))
        return res.status(400).json({ message: 'Status must be active, completed, or archived' });
    try {
        await organizer.updateTournamentStatus(req.tournament, status as 'active' | 'completed' | 'archived');
        return res.status(200).json({ success: true });
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to update status' });
        throw e;
    }
}));

// ── Format & Witnesses ────────────────────────────────────────────────────────

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/format:
 *   get:
 *     summary: Get case format
 *     tags: [Organizer - Tournament]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Case format }
 *       404: { description: Not found }
 */
router.get("/format", tournamentHandler(async (req, res) => {
    try {
        return res.status(200).json(await organizer.getFormat(req.tournament));
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/format:
 *   patch:
 *     summary: Update case format
 *     tags: [Organizer - Tournament]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pWitnessesCalled: { type: integer }
 *               dWitnessesCalled: { type: integer }
 *               isCriminal: { type: boolean }
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Validation error }
 *       404: { description: Not found }
 *       500: { description: Unable to update format }
 */
async function checkWitnessCountsForFormat(tournament: string, format: TournamentPayload['caseFormat']): Promise<string | null> {
    if (format.pWitnessesCalled == null && format.dWitnessesCalled == null) return null;
    const witnesses = await organizer.getWitnesses(tournament);
    return validateWitnessCounts(format, witnesses);
}

router.patch("/format", tournamentHandler(async (req, res) => {
    const format = req.body as TournamentPayload['caseFormat'];
    if ((format.pWitnessesCalled != null && format.pWitnessesCalled < 0) ||
        (format.dWitnessesCalled != null && format.dWitnessesCalled < 0))
        return res.status(400).json({ message: 'Witnesses called cannot be negative' });
    try {
        const countError = await checkWitnessCountsForFormat(req.tournament, format);
        if (countError) return res.status(400).json({ message: countError });
        await organizer.updateFormat(req.tournament, format);
        return res.status(200).json({ success: true });
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to update format' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/witnesses:
 *   get:
 *     summary: Get witnesses
 *     tags: [Organizer - Tournament]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Witnesses }
 *       404: { description: Not found }
 */
router.get("/witnesses", tournamentHandler(async (req, res) => {
    try {
        return res.status(200).json(await organizer.getWitnesses(req.tournament));
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/witnesses:
 *   patch:
 *     summary: Update witnesses
 *     tags: [Organizer - Tournament]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pWitnessNames: { type: array, items: { type: string } }
 *               dWitnessNames: { type: array, items: { type: string } }
 *               swingWitnessNames: { type: array, items: { type: string } }
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Empty witness name }
 *       404: { description: Not found }
 *       500: { description: Unable to update witnesses }
 */
router.patch("/witnesses", tournamentHandler(async (req, res) => {
    const witnesses = req.body as IWitnesses;
    const allNames = [...witnesses.pWitnessNames, ...witnesses.dWitnessNames, ...witnesses.swingWitnessNames];
    if (allNames.some(n => !n?.trim())) return res.status(400).json({ message: 'Witness names cannot be empty' });
    try {
        await organizer.updateWitnesses(req.tournament, witnesses);
        return res.status(200).json({ success: true });
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to update witnesses' });
        throw e;
    }
}));

// ── Standings Config ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/standings-config:
 *   get:
 *     summary: Get standings configuration
 *     tags: [Organizer - Tournament]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Standings config or null }
 *       500: { description: Database error }
 */
router.get("/standings-config", tournamentHandler(async (req, res) => {
    try {
        return res.status(200).json((await organizer.getStandingsConfig(req.tournament)) ?? null);
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/standings:
 *   get:
 *     summary: Get standings data (ballot totals + config) for the organizer view
 *     tags: [Organizer - Tournament]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: rounds
 *         required: false
 *         schema: { type: string }
 *         description: Comma-separated round UUIDs to filter by. Omit for all rounds.
 *     responses:
 *       200: { description: Standings data }
 *       500: { description: Database error }
 */
router.get("/standings", tournamentHandler(async (req, res) => {
    try {
        return res.status(200).json(await organizer.getOrganizerStandingsData(req.tournament));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/standings-config:
 *   patch:
 *     summary: Upsert standings configuration
 *     tags: [Organizer - Tournament]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [statsXml, standingsXml]
 *             properties:
 *               statsXml: { type: string }
 *               standingsXml: { type: string }
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Missing statsXml or standingsXml }
 *       500: { description: Unable to update standings config }
 */
router.patch("/standings-config", tournamentHandler(async (req, res) => {
    const { statsXml, standingsXml } = req.body as { statsXml: string; standingsXml: string };
    if (!statsXml || !standingsXml) return res.status(400).json({ message: 'Missing statsXml or standingsXml' });
    try {
        await organizer.upsertStandingsConfig(req.tournament, statsXml, standingsXml);
        return res.status(200).json({ success: true });
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to update standings config' });
        throw e;
    }
}));

// ── Scoring Categories ────────────────────────────────────────────────────────

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/scoring-categories:
 *   get:
 *     summary: Get scoring categories
 *     tags: [Organizer - Tournament]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Scoring categories }
 */
router.get("/scoring-categories", tournamentHandler(async (req, res) => {
    return res.status(200).json(await organizer.getScoringCategories(req.tournament));
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/scoring-categories:
 *   patch:
 *     summary: Update scoring categories
 *     tags: [Organizer - Tournament]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items: { type: object }
 *     responses:
 *       200: { description: Updated }
 *       500: { description: Unable to update scoring categories }
 */
router.patch("/scoring-categories", tournamentHandler(async (req, res) => {
    try {
        await organizer.updateScoringCategories(req.tournament, req.body as TournamentPayload['scoringCategories']);
        return res.status(200).json({ success: true });
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to update scoring categories' });
        throw e;
    }
}));

// ── Scorers ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/scorers:
 *   get:
 *     summary: List scorers for a tournament
 *     tags: [Organizer - Scorers]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Array of scorers }
 *       500: { description: Database error }
 */
router.get("/scorers", tournamentHandler(async (req, res) => {
    try {
        return res.status(200).json(await organizer.getScorers(req.tournament));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to reach backend' });
        throw e;
    }
}));

function verifyScorer(req: Request, res: Response, next: NextFunction) {
    const scorer: IScorer = req.body;
    if (!scorer?.email || !scorer?.first_name || !scorer?.last_name || !scorer?.scorer_id)
        return res.status(409).json({ message: 'Missing required field(s)' });
    if (!isValidEmail(scorer.email)) return res.status(400).json({ message: 'Invalid email address' });
    req.scorer = scorer;
    next();
}

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/scorers:
 *   post:
 *     summary: Add a scorer to the tournament
 *     tags: [Organizer - Scorers]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, first_name, last_name, scorer_id]
 *             properties:
 *               email: { type: string, format: email }
 *               first_name: { type: string }
 *               last_name: { type: string }
 *               scorer_id: { type: string, format: uuid }
 *     responses:
 *       200: { description: Scorer added }
 *       409: { description: Missing required fields }
 *       500: { description: Database error }
 */
router.post("/scorers", verifyScorer, scorerHandler(async (req, res) => {
    try {
        await organizer.addScorer(req.scorer, req.tournament);
        return res.status(200).json(req.scorer);
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to communicate with database' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/scorers:
 *   put:
 *     summary: Update a scorer
 *     tags: [Organizer - Scorers]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, first_name, last_name, scorer_id]
 *             properties:
 *               email: { type: string, format: email }
 *               first_name: { type: string }
 *               last_name: { type: string }
 *               scorer_id: { type: string, format: uuid }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 *       500: { description: Database error }
 */
router.put("/scorers", verifyScorer, scorerHandler(async (req, res) => {
    try {
        await organizer.updateScorer(req.scorer, req.tournament);
        return res.status(200).json(req.scorer);
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to communicate with database' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/scorers:
 *   delete:
 *     summary: Remove a scorer from the tournament
 *     tags: [Organizer - Scorers]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [scorer_id]
 *             properties:
 *               scorer_id: { type: string, format: uuid }
 *     responses:
 *       204: { description: Deleted }
 *       400: { description: Missing scorer_id }
 *       404: { description: Not found }
 *       500: { description: Database error }
 */
router.delete("/scorers", tournamentHandler(async (req, res) => {
    const { scorer_id } = req.body;
    if (!scorer_id) return res.status(400).json({ message: 'Did not provide a scorer_id' });
    try {
        await organizer.deleteScorer(scorer_id);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to delete scorer' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/scorer-conflicts:
 *   get:
 *     summary: Get all scorer conflicts for the tournament
 *     tags: [Organizer - Scorers]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: All conflicts }
 *       500: { description: Database error }
 */
router.get('/scorer-conflicts', tournamentHandler(async (req, res) => {
    try {
        return res.status(200).json(await organizer.getAllConflicts(req.tournament));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/scorers/{scorerId}/conflicts:
 *   get:
 *     summary: Get conflicts for a specific scorer
 *     tags: [Organizer - Scorers]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: scorerId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Conflicts }
 *       400: { description: Invalid scorer ID }
 *       500: { description: Database error }
 */
router.get('/scorers/:scorerId/conflicts', async (req: Request, res: Response) => {
    const scorerId = req.params.scorerId as string;
    if (!uuidRegex.test(scorerId)) return res.status(400).json({ message: 'Invalid scorer ID' });
    try {
        return res.status(200).json(await organizer.getConflicts(scorerId));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
});

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/scorers/{scorerId}/conflicts:
 *   post:
 *     summary: Add a conflict between a scorer and a team
 *     tags: [Organizer - Scorers]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: scorerId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [team_id]
 *             properties:
 *               team_id: { type: string, format: uuid }
 *     responses:
 *       201: { description: Conflict added }
 *       400: { description: Invalid ID }
 *       409: { description: Conflict already exists }
 */
router.post('/scorers/:scorerId/conflicts', async (req: Request, res: Response) => {
    const scorerId = req.params.scorerId as string;
    const { team_id } = req.body;
    if (!uuidRegex.test(scorerId) || !uuidRegex.test(team_id)) return res.status(400).json({ message: 'Invalid ID' });
    try {
        return res.status(201).json(await organizer.addConflict(scorerId, team_id));
    } catch (e) {
        if (e instanceof AlreadyExistsError) return res.status(409).json({ message: 'Conflict already exists' });
        throw e;
    }
});

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/scorers/{scorerId}/conflicts:
 *   delete:
 *     summary: Remove a conflict between a scorer and a team
 *     tags: [Organizer - Scorers]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: scorerId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [team_id]
 *             properties:
 *               team_id: { type: string, format: uuid }
 *     responses:
 *       204: { description: Removed }
 *       400: { description: Invalid ID }
 *       404: { description: Not found }
 */
router.delete('/scorers/:scorerId/conflicts', async (req: Request, res: Response) => {
    const scorerId = req.params.scorerId as string;
    const { team_id } = req.body;
    if (!uuidRegex.test(scorerId) || !uuidRegex.test(team_id)) return res.status(400).json({ message: 'Invalid ID' });
    try {
        await organizer.removeConflict(scorerId, team_id);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
});

// ── Organizers ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/organizers:
 *   get:
 *     summary: List organizers/delegates for a tournament
 *     tags: [Organizer - Delegates]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Array of organizers }
 *       500: { description: Database error }
 */
router.get("/organizers", tournamentHandler(async (req, res) => {
    try {
        return res.status(200).json(await organizer.getOrganizers(req.tournament));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
}));

async function verifyOrganizerPayload(req: Request, res: Response, next: NextFunction) {
    const { organizer: org } = req.body;
    if (!org) return res.status(400).json({ message: 'No organizer in body' });
    const o: IOrganizer = org;
    if (!o.name || !o.email || !o.role) return res.status(400).json({ message: 'Missing required fields' });
    if (!isValidEmail(o.email)) return res.status(400).json({ message: 'Invalid email address' });
    req.selectedOrganizer = o;
    next();
}

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/organizers:
 *   post:
 *     summary: Add a delegate to the tournament
 *     tags: [Organizer - Delegates]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [organizer]
 *             properties:
 *               organizer:
 *                 type: object
 *                 required: [name, email, role]
 *                 properties:
 *                   name: { type: string }
 *                   email: { type: string, format: email }
 *                   role: { type: string }
 *     responses:
 *       201: { description: Delegate added }
 *       400: { description: Missing fields }
 *       409: { description: Already a delegate }
 *       500: { description: Database error }
 */
router.post("/organizers", verifyOrganizerPayload, organizerHandler(async (req, res) => {
    try {

        const newOrganizer = await organizer.addOrganizer(req.tournament, req.selectedOrganizer.name, req.selectedOrganizer.email, req.selectedOrganizer.role);


       getTournament(req.tournament).then((tournament) => {
           const message : EmailTemplate = organizerAddedEmail(newOrganizer.name, tournament.name)
           sendEmail(newOrganizer.email, message.subject, message.html, message.text);
       })


        return res.status(201).json(newOrganizer);
    } catch (e) {
        if (e instanceof AlreadyExistsError) return res.status(409).json({ message: 'Email is already a delegate' });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to speak to database' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/organizers:
 *   put:
 *     summary: Update a delegate
 *     tags: [Organizer - Delegates]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [organizer]
 *             properties:
 *               organizer:
 *                 type: object
 *                 required: [id, name, email, role]
 *                 properties:
 *                   id: { type: string, format: uuid }
 *                   name: { type: string }
 *                   email: { type: string, format: email }
 *                   role: { type: string }
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Missing or invalid fields }
 *       404: { description: Not found }
 *       409: { description: Organizer already joined }
 */
router.put("/organizers", verifyOrganizerPayload, organizerHandler(async (req, res) => {
    if (!req.selectedOrganizer.id) return res.status(400).json({ message: 'Missing id field' });
    if (!uuidRegex.test(req.selectedOrganizer.id)) return res.status(400).json({ message: 'Invalid organizer ID' });
    try {
        return res.status(200).json(await organizer.updateOrganizer(req.selectedOrganizer));
    } catch (e) {
        if (e instanceof OrganizerAlreadyJoinedError) return res.status(409).json({ message: 'Organizer has already joined' });
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/organizers:
 *   delete:
 *     summary: Remove a delegate from the tournament
 *     tags: [Organizer - Delegates]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [organizer]
 *             properties:
 *               organizer:
 *                 type: object
 *                 required: [id]
 *                 properties:
 *                   id: { type: string, format: uuid }
 *     responses:
 *       204: { description: Removed }
 *       400: { description: Missing or invalid id }
 *       404: { description: Not found }
 */
router.delete("/organizers", verifyOrganizerPayload, organizerHandler(async (req, res) => {
    if (!req.selectedOrganizer.id) return res.status(400).json({ message: 'Missing id field in body' });
    if (!uuidRegex.test(req.selectedOrganizer.id)) return res.status(400).json({ message: 'Invalid organizer ID' });
    try {
        await organizer.deleteOrganizer(req.selectedOrganizer);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
}));

// ── Courtrooms ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/courtrooms:
 *   get:
 *     summary: List courtrooms
 *     tags: [Organizer - Courtrooms]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Array of courtrooms }
 *       500: { description: Database error }
 */
router.get('/courtrooms', tournamentHandler(async (req, res) => {
    try {
        return res.status(200).json(await organizer.getCourtrooms(req.tournament));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to get courtrooms' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/courtrooms:
 *   post:
 *     summary: Add a courtroom
 *     tags: [Organizer - Courtrooms]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *     responses:
 *       201: { description: Courtroom created }
 *       400: { description: Missing name }
 *       500: { description: Database error }
 */
router.post('/courtrooms', tournamentHandler(async (req, res) => {
    if (!req.body?.name) return res.status(400).json({ message: 'Missing name' });
    try {
        return res.status(201).json(await organizer.addCourtroom(req.tournament, req.body));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to add courtroom' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/courtrooms:
 *   put:
 *     summary: Update a courtroom
 *     tags: [Organizer - Courtrooms]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id, name]
 *             properties:
 *               id: { type: string, format: uuid }
 *               name: { type: string }
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Missing id or name }
 *       404: { description: Not found }
 */
router.put('/courtrooms', async (req: Request, res: Response) => {
    if (!req.body?.id || !req.body?.name) return res.status(400).json({ message: 'Missing id or name' });
    try {
        return res.status(200).json(await organizer.updateCourtroom(req.body));
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
});

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/courtrooms:
 *   delete:
 *     summary: Delete a courtroom
 *     tags: [Organizer - Courtrooms]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id]
 *             properties:
 *               id: { type: string, format: uuid }
 *     responses:
 *       204: { description: Deleted }
 *       400: { description: Missing id }
 *       404: { description: Not found }
 */
router.delete('/courtrooms', async (req: Request, res: Response) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ message: 'Missing id' });
    try {
        await organizer.deleteCourtroom(id);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
});

// ── Teams ─────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/teams:
 *   get:
 *     summary: List teams in the tournament
 *     tags: [Organizer - Teams]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Array of teams }
 */
router.get('/teams', tournamentHandler(async (req, res) => {
    return res.status(200).json(await organizer.getTeams(req.tournament));
}));

function verifyTeamPayload(req: Request, res: Response, next: NextFunction) {
    const { team } = req.body;
    if (!team) return res.status(400).json({ message: 'No team in body' });
    const t: ITeam = team;
    if (!t.name || !t.coach_email) return res.status(400).json({ message: 'Missing required fields' });
    if (!isValidEmail(t.coach_email)) return res.status(400).json({ message: 'Invalid coach email address' });
    req.selectedTeam = t;
    next();
}

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/teams:
 *   post:
 *     summary: Add a team to the tournament
 *     tags: [Organizer - Teams]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [team]
 *             properties:
 *               team:
 *                 type: object
 *                 required: [name, coach_email]
 *                 properties:
 *                   name: { type: string }
 *                   coach_email: { type: string, format: email }
 *                   code: { type: string }
 *     responses:
 *       201: { description: Team created }
 *       400: { description: Missing fields }
 *       409: { description: Team name already exists }
 *       500: { description: Database error }
 */
router.post('/teams', verifyTeamPayload, teamHandler(async (req, res) => {
    const { name, coach_email, code } = req.selectedTeam;
    if (await organizer.teamNameExists(req.tournament, name)) return res.status(409).json({ message: 'A team with that name already exists' });
    try {
        const newTeam = await organizer.addTeam(req.tournament, name, coach_email, code || name)

        getTournament(req.tournament).then(tournament => {
            const template = teamAddedEmail(name, tournament.name, newTeam.id)
            sendEmail(coach_email, template.subject, template.html, template.text)
        }).catch(e => console.error(e))

        return res.status(201).json(newTeam);
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to add team' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/teams:
 *   put:
 *     summary: Update a team
 *     tags: [Organizer - Teams]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [team]
 *             properties:
 *               team:
 *                 type: object
 *                 required: [id, name, coach_email]
 *                 properties:
 *                   id: { type: string, format: uuid }
 *                   name: { type: string }
 *                   coach_email: { type: string, format: email }
 *                   code: { type: string }
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Missing or invalid fields }
 *       404: { description: Not found }
 *       409: { description: Name already taken }
 *       500: { description: Database error }
 */
router.put('/teams', verifyTeamPayload, teamHandler(async (req, res) => {
    const { id, name, coach_email, code } = req.selectedTeam;
    if (!id) return res.status(400).json({ message: 'Missing id field' });
    if (!uuidRegex.test(id)) return res.status(400).json({ message: 'Invalid team ID' });
    if (await organizer.teamNameExists(req.tournament, name, id))
        return res.status(409).json({ message: 'A team with that name already exists' });
    try {
        return res.status(200).json(await organizer.updateTeam(id, name, coach_email, code || name));
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to update team' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/teams:
 *   delete:
 *     summary: Delete a team
 *     tags: [Organizer - Teams]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id]
 *             properties:
 *               id: { type: string, format: uuid }
 *     responses:
 *       204: { description: Deleted }
 *       400: { description: Missing or invalid id }
 *       404: { description: Not found }
 */
router.delete('/teams', async (req: Request, res: Response) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ message: 'Missing id' });
    if (!uuidRegex.test(id)) return res.status(400).json({ message: 'Invalid team ID' });
    try {
        await organizer.deleteTeam(id);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
});

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/teams/{teamId}/owner:
 *   put:
 *     summary: Transfer team ownership to another coach
 *     tags: [Organizer - Teams]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [coachId]
 *             properties:
 *               coachId: { type: string, format: uuid }
 *     responses:
 *       204: { description: Ownership transferred }
 *       400: { description: Invalid ID }
 *       404: { description: Not found }
 */
router.put('/teams/:teamId/owner', async (req: Request, res: Response) => {
    const teamId = req.params.teamId as string;
    if (!uuidRegex.test(teamId)) return res.status(400).json({ message: 'Invalid team ID' });
    const { coachId } = req.body as { coachId?: string };
    if (!coachId || !uuidRegex.test(coachId)) return res.status(400).json({ message: 'Missing or invalid coachId' });
    try {
        await transferOwnership(teamId, coachId);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
});

// ── Organizer view of team roster (delegates to coachProvider) ────────────────

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/teams/{teamId}/coaches:
 *   get:
 *     summary: List coaches on a team
 *     tags: [Organizer - Teams]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Array of coaches }
 */
router.get('/teams/:teamId/coaches', async (req: Request, res: Response) => {
    return res.status(200).json(await coachProvider.getCoaches(req.params.teamId as string));
});

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/teams/{teamId}/coaches:
 *   post:
 *     summary: Add a coach to a team by email
 *     tags: [Organizer - Teams]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       201: { description: Coach added }
 *       400: { description: Missing email }
 */
router.post('/teams/:teamId/coaches', async (req: Request, res: Response) => {
    const { email } = req.body as { email?: string };
    if (!email) return res.status(400).json({ message: 'Missing email' });
    if (!isValidEmail(email)) return res.status(400).json({ message: 'Invalid email address' });
    return res.status(201).json(await coachProvider.addCoach(req.params.teamId as string, email));
});

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/teams/{teamId}/coaches/{coachId}:
 *   delete:
 *     summary: Remove a coach from a team
 *     tags: [Organizer - Teams]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: coachId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Removed }
 *       404: { description: Not found }
 */
router.delete('/teams/:teamId/coaches/:coachId', removeCoachHandler);

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/teams/{teamId}/students:
 *   get:
 *     summary: List students on a team
 *     tags: [Organizer - Teams]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Array of students }
 */
router.get('/teams/:teamId/students', async (req: Request, res: Response) => {
    return res.status(200).json(await coachProvider.getStudents(req.params.teamId as string));
});

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/teams/{teamId}/students:
 *   post:
 *     summary: Add a student to a team roster
 *     tags: [Organizer - Teams]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [student_name]
 *             properties:
 *               student_name: { type: string }
 *               pronouns: { type: string }
 *     responses:
 *       201: { description: Student added }
 *       400: { description: Missing student_name }
 *       409: { description: Student already on roster }
 */
router.post('/teams/:teamId/students', addStudentHandler);

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/teams/{teamId}/students/{studentId}:
 *   delete:
 *     summary: Remove a student from a team roster
 *     tags: [Organizer - Teams]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Removed }
 *       404: { description: Not found }
 */
router.delete('/teams/:teamId/students/:studentId', async (req: Request, res: Response) => {
    try {
        await coachProvider.removeStudent(req.params.studentId as string);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
});

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/teams/{teamId}/pairings/{pairingId}/witness-order:
 *   get:
 *     summary: Get witness call order for a team in a pairing
 *     tags: [Organizer - Teams]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: pairingId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Witness call order }
 */
router.get('/teams/:teamId/pairings/:pairingId/witness-order', async (req: Request, res: Response) => {
    return res.status(200).json(await coachProvider.getWitnessCallOrder(req.params.pairingId as string, req.params.teamId as string));
});

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/teams/{teamId}/pairings/{pairingId}/witness-order:
 *   put:
 *     summary: Set witness call order for a team in a pairing
 *     tags: [Organizer - Teams]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: pairingId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [witness_ids]
 *             properties:
 *               witness_ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *     responses:
 *       200: { description: Updated }
 *       400: { description: witness_ids must be an array }
 */
router.put('/teams/:teamId/pairings/:pairingId/witness-order', async (req: Request, res: Response) => {
    const { witness_ids } = req.body as { witness_ids?: string[] };
    if (!Array.isArray(witness_ids)) return res.status(400).json({ message: 'witness_ids must be an array' });
    await coachProvider.setWitnessCallOrder(req.params.pairingId as string, req.params.teamId as string, witness_ids);
    return res.status(200).json({ success: true });
});

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/teams/{teamId}/pairings/{pairingId}/assignments:
 *   get:
 *     summary: Get student assignments for a team in a pairing
 *     tags: [Organizer - Teams]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: pairingId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Assignments }
 */
router.get('/teams/:teamId/pairings/:pairingId/assignments', async (req: Request, res: Response) => {
    return res.status(200).json(await coachProvider.getStudentAssignments(req.params.pairingId as string, req.params.teamId as string));
});

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/teams/{teamId}/pairings/{pairingId}/assignments:
 *   put:
 *     summary: Upsert a student assignment for a scoring field
 *     tags: [Organizer - Teams]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: pairingId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [field_id, student_id]
 *             properties:
 *               field_id: { type: string, format: uuid }
 *               student_id: { type: string, format: uuid }
 *     responses:
 *       200: { description: Assignment saved }
 *       400: { description: Missing field_id or student_id }
 *       500: { description: Unable to save assignment }
 */
router.put('/teams/:teamId/pairings/:pairingId/assignments', async (req: Request, res: Response) => {
    const { field_id, student_id } = req.body as { field_id?: string; student_id?: string };
    if (!field_id || !student_id) return res.status(400).json({ message: 'Missing field_id or student_id' });
    try {
        return res.status(200).json(await coachProvider.upsertStudentAssignment(req.params.pairingId as string, req.params.teamId as string, field_id, student_id));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to save assignment' });
        throw e;
    }
});

// ── Rounds ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/rounds:
 *   get:
 *     summary: List rounds for a tournament
 *     tags: [Organizer - Rounds]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Array of rounds }
 *       500: { description: Database error }
 */
router.get("/rounds", tournamentHandler(async (req, res) => {
    try {
        return res.status(200).json(await organizer.getRounds(req.tournament));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/rounds:
 *   post:
 *     summary: Create a new round
 *     tags: [Organizer - Rounds]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201: { description: Round created }
 *       500: { description: Unable to create round }
 */
router.post("/rounds", tournamentHandler(async (req, res) => {
    try {
        const newRound = await organizer.createRound(req.tournament);
        const out: IRound = { ...newRound, round_time: newRound.round_time?.toISOString() ?? null };
        return res.status(201).json(out);
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to create round' });
        throw e;
    }
}));

async function verifyRound(req: Request, res: Response, next: NextFunction) {
    const { tournament } = req as TournamentRequest;
    const { round } = req.params;
    if (!round) return res.status(400).json({ message: 'No round id provided' });
    const roundID = Array.isArray(round) ? round[0] : round;
    if (!uuidRegex.test(roundID)) return res.status(400).json({ message: 'Invalid UUID' });
    try {
        const r = await organizer.getRound(tournament, roundID);
        req.round = { ...r, round_time: r.round_time == null ? null : r.round_time.toISOString() };
        next();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: 'No round found' });
        throw e;
    }
}

router.use('/rounds/:round', verifyRound, roundRoutes);

// ── Bulk Import ───────────────────────────────────────────────────────────────

/** Simple CSV parser — handles quoted fields and commas within quotes */
function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    for (const line of lines) {
        if (!line.trim()) continue;
        const fields: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
                else if (ch === '"') inQuotes = false;
                else current += ch;
            } else {
                if (ch === '"') inQuotes = true;
                else if (ch === ',') { fields.push(current.trim()); current = ''; }
                else current += ch;
            }
        }
        fields.push(current.trim());
        rows.push(fields);
    }
    return rows;
}

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/import/scorers:
 *   post:
 *     summary: Bulk import scorers from CSV
 *     tags: [Organizer - Import]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [csv]
 *             properties:
 *               csv: { type: string, description: "Raw CSV text with columns: first_name, last_name, email" }
 *     responses:
 *       200: { description: Import results with created count and errors }
 *       400: { description: Missing CSV or invalid format }
 */
router.post('/import/scorers', tournamentHandler(async (req, res) => {
    const { csv } = req.body as { csv?: string };
    if (!csv?.trim()) return res.status(400).json({ message: 'No CSV data provided' });

    const rows = parseCsv(csv);
    if (rows.length === 0) return res.status(400).json({ message: 'CSV is empty' });

    // Detect header row — if first row looks like headers, skip it
    const firstRow = rows[0].map(f => f.toLowerCase());
    const hasHeader = firstRow.includes('first_name') || firstRow.includes('first name') ||
                      firstRow.includes('email') || firstRow.includes('lastname');
    const dataRows = hasHeader ? rows.slice(1) : rows;

    const results: { created: number; errors: { row: number; message: string }[] } = { created: 0, errors: [] };

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const [firstName, lastName, email] = row;
        const rowNum = i + (hasHeader ? 2 : 1); // 1-indexed, accounting for header

        if (!firstName?.trim() || !lastName?.trim()) {
            results.errors.push({ row: rowNum, message: 'Missing first or last name' });
            continue;
        }
        if (!email?.trim() || !isValidEmail(email.trim())) {
            results.errors.push({ row: rowNum, message: `Invalid email: ${email ?? '(empty)'}` });
            continue;
        }

        try {
            const scorer: IScorer = { scorer_id: crypto.randomUUID(), first_name: firstName.trim(), last_name: lastName.trim(), email: email.trim() };
            await organizer.addScorer(scorer, req.tournament);
            results.created++;
        } catch (e) {
            results.errors.push({ row: rowNum, message: e instanceof Error ? e.message : 'Unknown error' });
        }
    }

    return res.status(200).json(results);
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/import/teams:
 *   post:
 *     summary: Bulk import teams from CSV
 *     tags: [Organizer - Import]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [csv]
 *             properties:
 *               csv: { type: string, description: "Raw CSV text with columns: name, coach_email, code (code is optional)" }
 *     responses:
 *       200: { description: Import results with created count and errors }
 *       400: { description: Missing CSV or invalid format }
 */
router.post('/import/teams', tournamentHandler(async (req, res) => {
    const { csv } = req.body as { csv?: string };
    if (!csv?.trim()) return res.status(400).json({ message: 'No CSV data provided' });

    const rows = parseCsv(csv);
    if (rows.length === 0) return res.status(400).json({ message: 'CSV is empty' });

    // Detect header row
    const firstRow = rows[0].map(f => f.toLowerCase());
    const hasHeader = firstRow.includes('name') || firstRow.includes('team') ||
                      firstRow.includes('coach_email') || firstRow.includes('email');
    const dataRows = hasHeader ? rows.slice(1) : rows;

    const results: { created: number; errors: { row: number; message: string }[] } = { created: 0, errors: [] };

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const [name, coachEmail, code] = row;
        const rowNum = i + (hasHeader ? 2 : 1);

        if (!name?.trim()) {
            results.errors.push({ row: rowNum, message: 'Missing team name' });
            continue;
        }
        if (!coachEmail?.trim() || !isValidEmail(coachEmail.trim())) {
            results.errors.push({ row: rowNum, message: `Invalid coach email: ${coachEmail ?? '(empty)'}` });
            continue;
        }

        // Check for duplicate name
        if (await organizer.teamNameExists(req.tournament, name.trim())) {
            results.errors.push({ row: rowNum, message: `Team "${name.trim()}" already exists` });
            continue;
        }

        try {
            await organizer.addTeam(req.tournament, name.trim(), coachEmail.trim(), code?.trim() || name.trim());
            results.created++;
        } catch (e) {
            results.errors.push({ row: rowNum, message: e instanceof Error ? e.message : 'Unknown error' });
        }
    }

    return res.status(200).json(results);
}));

// ── Export / Download ─────────────────────────────────────────────────────────

function escapeCsvField(value: string): string {
    const sanitized = /^[=+\-@]/.test(value) ? `'${value}` : value;
    if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n'))
        return `"${sanitized.replace(/"/g, '""')}"`;
    return sanitized;
}

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/export/standings:
 *   get:
 *     summary: Download standings as CSV
 *     tags: [Organizer - Export]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: CSV file }
 *       500: { description: Database error }
 */
router.get('/export/standings', tournamentHandler(async (req, res) => {
    try {
        const data = await organizer.getOrganizerStandingsData(req.tournament);
        const { teams, ballots } = data;

        // Build a map of team stats
        const statsMap = new Map<string, { name: string; code: string; won: number; lost: number; pointsFor: number; pointsAgainst: number }>();
        for (const t of teams)
            statsMap.set(t.id, { name: t.name, code: t.code, won: 0, lost: 0, pointsFor: 0, pointsAgainst: 0 });

        // Aggregate ballots per pairing, then determine wins/losses per ballot
        for (const b of ballots) {
            const pStats = statsMap.get(b.p_team_id);
            const dStats = statsMap.get(b.d_team_id);
            if (pStats) {
                pStats.pointsFor += b.p_points;
                pStats.pointsAgainst += b.d_points;
                if (b.p_points > b.d_points) pStats.won++;
                else if (b.d_points > b.p_points) pStats.lost++;
            }
            if (dStats) {
                dStats.pointsFor += b.d_points;
                dStats.pointsAgainst += b.p_points;
                if (b.d_points > b.p_points) dStats.won++;
                else if (b.p_points > b.d_points) dStats.lost++;
            }
        }

        const header = 'Team Name,Team Code,Ballots Won,Ballots Lost,Total Points For,Total Points Against';
        const rows = [...statsMap.values()].map(s =>
            `${escapeCsvField(s.name)},${escapeCsvField(s.code)},${s.won},${s.lost},${s.pointsFor},${s.pointsAgainst}`
        );

        const csv = [header, ...rows].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="standings.csv"');
        return res.status(200).send(csv);
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/export/results:
 *   get:
 *     summary: Download round results as CSV
 *     tags: [Organizer - Export]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: CSV file }
 *       500: { description: Database error }
 */
router.get('/export/results', tournamentHandler(async (req, res) => {
    try {
        const data = await organizer.getOrganizerStandingsData(req.tournament);
        const { teams, ballots, rounds } = data;

        const teamNameMap = new Map<string, string>();
        for (const t of teams) teamNameMap.set(t.id, t.name);

        const roundNameMap = new Map<string, string>();
        for (const r of rounds) roundNameMap.set(r.round_id, r.name);

        const header = 'Round,Prosecution,Defense,P Points,D Points';
        const rows = ballots.map(b =>
            `${escapeCsvField(roundNameMap.get(b.round_id) ?? 'Unknown')},${escapeCsvField(teamNameMap.get(b.p_team_id) ?? 'Unknown')},${escapeCsvField(teamNameMap.get(b.d_team_id) ?? 'Unknown')},${b.p_points},${b.d_points}`
        );

        const csv = [header, ...rows].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="results.csv"');
        return res.status(200).send(csv);
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
}));

// ── Award Categories ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/award-categories:
 *   get:
 *     summary: List individual award categories for a tournament
 *     tags: [Organizer - Tournament]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Array of award categories }
 *       500: { description: Database error }
 */
router.get("/award-categories", tournamentHandler(async (req, res) => {
    try {
        return res.status(200).json(await organizer.getAwardCategories(req.tournament));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/award-categories:
 *   post:
 *     summary: Create an individual award category
 *     tags: [Organizer - Tournament]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, minNominees, maxNominees]
 *             properties:
 *               name: { type: string }
 *               minNominees: { type: integer, minimum: 0 }
 *               maxNominees: { type: integer, minimum: 1 }
 *     responses:
 *       201: { description: Award category created }
 *       400: { description: Missing or invalid fields }
 *       500: { description: Database error }
 */
router.post("/award-categories", tournamentHandler(async (req, res) => {
    const { name, minNominees, maxNominees } = req.body as { name?: string; minNominees?: number; maxNominees?: number };
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });
    if (minNominees == null || maxNominees == null) return res.status(400).json({ message: 'minNominees and maxNominees are required' });
    if (minNominees < 0) return res.status(400).json({ message: 'minNominees must be >= 0' });
    if (maxNominees < 1) return res.status(400).json({ message: 'maxNominees must be >= 1' });
    if (minNominees > maxNominees) return res.status(400).json({ message: 'minNominees cannot exceed maxNominees' });
    try {
        return res.status(201).json(await organizer.createAwardCategory(req.tournament, name.trim(), minNominees, maxNominees));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to create award category' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/award-categories/{categoryId}:
 *   put:
 *     summary: Update an individual award category
 *     tags: [Organizer - Tournament]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, minNominees, maxNominees]
 *             properties:
 *               name: { type: string }
 *               minNominees: { type: integer, minimum: 0 }
 *               maxNominees: { type: integer, minimum: 1 }
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Invalid fields }
 *       404: { description: Not found }
 *       500: { description: Database error }
 */
router.put("/award-categories/:categoryId", tournamentHandler(async (req, res) => {
    const categoryId = req.params.categoryId as string;
    if (!uuidRegex.test(categoryId)) return res.status(400).json({ message: 'Invalid category ID' });
    const { name, minNominees, maxNominees } = req.body as { name?: string; minNominees?: number; maxNominees?: number };
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });
    if (minNominees == null || maxNominees == null) return res.status(400).json({ message: 'minNominees and maxNominees are required' });
    if (minNominees < 0) return res.status(400).json({ message: 'minNominees must be >= 0' });
    if (maxNominees < 1) return res.status(400).json({ message: 'maxNominees must be >= 1' });
    if (minNominees > maxNominees) return res.status(400).json({ message: 'minNominees cannot exceed maxNominees' });
    try {
        return res.status(200).json(await organizer.updateAwardCategory(categoryId, name.trim(), minNominees, maxNominees));
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to update award category' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/award-categories/{categoryId}:
 *   delete:
 *     summary: Delete an individual award category
 *     tags: [Organizer - Tournament]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Deleted }
 *       400: { description: Invalid category ID }
 *       404: { description: Not found }
 */
router.delete("/award-categories/:categoryId", tournamentHandler(async (req, res) => {
    const categoryId = req.params.categoryId as string;
    if (!uuidRegex.test(categoryId)) return res.status(400).json({ message: 'Invalid category ID' });
    try {
        await organizer.deleteAwardCategory(categoryId);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
}));

// ── Awards / Nominations ──────────────────────────────────────────────────────

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/awards:
 *   get:
 *     summary: Get aggregated nomination awards for the tournament
 *     tags: [Organizer - Tournament]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Array of nomination summaries sorted by total nominations desc, average rank asc
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   student_id: { type: string, format: uuid }
 *                   student_name: { type: string }
 *                   team_name: { type: string }
 *                   team_code: { type: string }
 *                   total_nominations: { type: integer }
 *                   average_rank: { type: number }
 *       500: { description: Database error }
 */
router.get('/awards', tournamentHandler(async (req, res) => {
    try {
        // Query aggregated nominations directly from the nominations table
        const nominationsResult = await dbQuery<{
            award_category_id: string;
            student_id: string;
            total_nominations: number;
            average_rank: number;
        }>(
            `SELECT n.award_category_id, n.student_id,
                    COUNT(*)::int AS total_nominations,
                    ROUND(AVG(n.rank)::numeric, 2) AS average_rank
             FROM nominations n
             JOIN ballots b ON b.ballot_id = n.ballot_id
             WHERE b.tournament_id = $1
             GROUP BY n.award_category_id, n.student_id
             ORDER BY n.award_category_id, COUNT(*) DESC, AVG(n.rank) ASC`,
            [req.tournament]
        );

        if (!nominationsResult || nominationsResult.rows.length === 0) {
            return res.status(200).json([]);
        }

        // Fetch student and team info
        const studentIds = [...new Set(nominationsResult.rows.map(r => r.student_id))];
        const studentsResult = await dbQuery<{ student_id: string; student_name: string; team_name: string; team_code: string }>(
            `SELECT s.student_id, s.student_name, t.name AS team_name, t.code AS team_code
             FROM team_rostered_students s
             JOIN teams t ON t.id = s.team_id
             WHERE s.student_id = ANY($1)`,
            [studentIds]
        );

        const studentInfo = new Map<string, { student_name: string; team_name: string; team_code: string }>();
        if (studentsResult) {
            for (const row of studentsResult.rows) {
                studentInfo.set(row.student_id, { student_name: row.student_name, team_name: row.team_name, team_code: row.team_code });
            }
        }

        // Fetch award category names
        const awardCats = await organizer.getAwardCategories(req.tournament);
        const catNameMap = new Map(awardCats.map(c => [c.id, c.name]));

        // Build response array
        const awards = nominationsResult.rows.map(entry => {
            const info = studentInfo.get(entry.student_id);
            return {
                award_category_id: entry.award_category_id,
                award_category_name: catNameMap.get(entry.award_category_id) ?? 'Uncategorized',
                student_id: entry.student_id,
                student_name: info?.student_name ?? 'Unknown',
                team_name: info?.team_name ?? 'Unknown',
                team_code: info?.team_code ?? '',
                total_nominations: entry.total_nominations,
                average_rank: Number(entry.average_rank),
            };
        });

        return res.status(200).json(awards);
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/awards/details:
 *   get:
 *     summary: Get raw nomination details with round and side info for client-side aggregation
 *     tags: [Organizer - Tournament]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Array of individual nominations with round_id and side
 *       500: { description: Database error }
 */
router.get('/awards/details', tournamentHandler(async (req, res) => {
    try {
        // Return each nomination row with round_id and the side the student was on
        const result = await dbQuery<{
            award_category_id: string;
            student_id: string;
            student_name: string;
            team_name: string;
            team_code: string;
            rank: number;
            round_id: string;
            side: 'P' | 'D';
        }>(
            `SELECT n.award_category_id, n.student_id, n.rank,
                    s.student_name, t.name AS team_name, t.code AS team_code,
                    p.round_id,
                    CASE WHEN s.team_id = p.p_team THEN 'P' ELSE 'D' END AS side
             FROM nominations n
             JOIN ballots b ON b.ballot_id = n.ballot_id
             JOIN team_rostered_students s ON s.student_id = n.student_id
             JOIN teams t ON t.id = s.team_id
             JOIN pairings p ON p.pairing_id = b.pairing_id
             WHERE b.tournament_id = $1
             ORDER BY n.award_category_id, n.student_id, n.rank`,
            [req.tournament]
        );

        if (!result) return res.status(500).json({ message: 'Database error' });

        // Also return award category names
        const categories = await organizer.getAwardCategories(req.tournament);

        return res.status(200).json({
            nominations: result.rows,
            categories,
        });
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
}));

// ── Email delivery status ─────────────────────────────────────────────────────

/**
 * /organizer/tournament/{tournamentId}/bounced-emails:
 *   get:
 *     summary: Get list of emails that have bounced (delivery failures)
 *     tags: [Organizer - Tournament]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Set of bounced email addresses relevant to this tournament }
 */
router.get('/bounced-emails', tournamentHandler(async (req, res) => {
    const result = await dbQuery<{ email: string }>(
        `SELECT DISTINCT be.email FROM bounced_emails be
         WHERE be.email IN (
             SELECT email FROM scorers WHERE tournament_id = $1
             UNION SELECT coach_email FROM (
                 SELECT a.email AS coach_email FROM teams t
                 JOIN team_coaches tc ON tc.team_id = t.id
                 JOIN auth a ON a.user_id = tc.coach_id
                 WHERE t.tournament_id = $1
                 UNION
                 SELECT ti.invite_email FROM teams t
                 JOIN team_invites ti ON ti.team_id = t.id
                 WHERE t.tournament_id = $1
             ) coaches
             UNION SELECT email FROM tournament_delegate_invites WHERE tournament_id = $1
             UNION SELECT a.email FROM tournament_owners tow JOIN auth a ON a.user_id = tow.delegate_id WHERE tow.tournament_id = $1
         )`,
        [req.tournament]
    );
    return res.status(200).json(result?.rows.map(r => r.email) ?? []);
}));

// ── Scorecard viewer ──────────────────────────────────────────────────────────


/**
 * GET /organizer/tournament/:tournamentId/pairings/:pairingId/scoresheets/:assignmentId
 * Returns the stored ballot for a scorer assignment, or null if not yet submitted.
 * Used by the organizer's ScorecardViewer page.
 */
router.get('/pairings/:pairingId/scoresheets/:assignmentId', tournamentHandler(async (req, res) => {
    const assignmentId = req.params.assignmentId as string;
    if (!uuidRegex.test(assignmentId)) return res.status(400).json({ message: 'Invalid assignment ID' });
    const [sheet, ballot, editLog] = await Promise.all([
        scorerProv.getScoreSheet(assignmentId, { skipGuards: true }).catch(() => null),
        scorerProv.getBallot(assignmentId),
        organizer.getBallotEditLog(assignmentId),
    ]);
    return res.status(200).json({ sheet, ballot, editLog });
}));
/**
 * @swagger
 * /organizer/tournament/{tournamentId}/pairings/{pairingId}/scoresheets/{assignmentId}:
 *   put:
 *     summary: Edit a submitted ballot's scores
 *     tags: [Organizer - Scorecards]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: pairingId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [scores, reason]
 *             properties:
 *               scores: { type: array }
 *               reason: { type: string }
 *     responses:
 *       200: { description: Ballot updated }
 *       400: { description: Invalid input }
 *       404: { description: Ballot not found }
 *       500: { description: Database error }
 */
router.put('/pairings/:pairingId/scoresheets/:assignmentId', tournamentHandler(async (req, res) => {
    const assignmentId = req.params.assignmentId as string;
    if (!uuidRegex.test(assignmentId)) return res.status(400).json({ message: 'Invalid assignment ID' });
    const { scores, reason } = req.body as { scores?: { assignmentKey: string; side: 'P' | 'D'; score: number; studentId: string | null; categoryId: string }[]; reason?: string };
    if (!Array.isArray(scores) || !reason?.trim()) return res.status(400).json({ message: 'scores array and reason are required' });
    try {
        await organizer.editBallot(assignmentId, { scores }, req.session.email, reason.trim());
        return res.status(200).json({ success: true });
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to update ballot' });
        throw e;
    }
}));
/**
 * @swagger
 * /organizer/tournament/{tournamentId}/pairings/{pairingId}/scoresheets/{assignmentId}:
 *   delete:
 *     summary: Delete a submitted ballot
 *     tags: [Organizer - Scorecards]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: pairingId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Ballot deleted }
 *       400: { description: Invalid assignment ID }
 *       404: { description: Ballot not found }
 *       500: { description: Database error }
 */
router.delete('/pairings/:pairingId/scoresheets/:assignmentId', tournamentHandler(async (req, res) => {
    const assignmentId = req.params.assignmentId as string;
    if (!uuidRegex.test(assignmentId)) return res.status(400).json({ message: 'Invalid assignment ID' });
    try {
        await organizer.deleteBallot(assignmentId);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to delete ballot' });
        throw e;
    }
}));

export default router;
