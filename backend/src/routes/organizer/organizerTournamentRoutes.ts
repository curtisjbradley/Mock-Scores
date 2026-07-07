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
import {EmailTemplate, organizerAddedEmail, sendEmail, teamAddedEmail} from "../../email";
import { removeCoachHandler, addStudentHandler } from "../teamHandlers";

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
 * /api/organizer/tournament/{tournamentId}:
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
 * /api/organizer/tournament/{tournamentId}:
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

// ── Format & Witnesses ────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/organizer/tournament/{tournamentId}/format:
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
 * /api/organizer/tournament/{tournamentId}/format:
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
 * /api/organizer/tournament/{tournamentId}/witnesses:
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
 * /api/organizer/tournament/{tournamentId}/witnesses:
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
 * /api/organizer/tournament/{tournamentId}/standings-config:
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
 * /api/organizer/tournament/{tournamentId}/standings:
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
 * /api/organizer/tournament/{tournamentId}/standings-config:
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
 * /api/organizer/tournament/{tournamentId}/scoring-categories:
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
 * /api/organizer/tournament/{tournamentId}/scoring-categories:
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
 * /api/organizer/tournament/{tournamentId}/scorers:
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
    req.scorer = scorer;
    next();
}

/**
 * @swagger
 * /api/organizer/tournament/{tournamentId}/scorers:
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
 * /api/organizer/tournament/{tournamentId}/scorers:
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
 * /api/organizer/tournament/{tournamentId}/scorers:
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
 * /api/organizer/tournament/{tournamentId}/scorer-conflicts:
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
 * /api/organizer/tournament/{tournamentId}/scorers/{scorerId}/conflicts:
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
 * /api/organizer/tournament/{tournamentId}/scorers/{scorerId}/conflicts:
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
 * /api/organizer/tournament/{tournamentId}/scorers/{scorerId}/conflicts:
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
 * /api/organizer/tournament/{tournamentId}/organizers:
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
    req.selectedOrganizer = o;
    next();
}

/**
 * @swagger
 * /api/organizer/tournament/{tournamentId}/organizers:
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
 * /api/organizer/tournament/{tournamentId}/organizers:
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
 * /api/organizer/tournament/{tournamentId}/organizers:
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
 * /api/organizer/tournament/{tournamentId}/courtrooms:
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
 * /api/organizer/tournament/{tournamentId}/courtrooms:
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
 * /api/organizer/tournament/{tournamentId}/courtrooms:
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
 * /api/organizer/tournament/{tournamentId}/courtrooms:
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
 * /api/organizer/tournament/{tournamentId}/teams:
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
    req.selectedTeam = t;
    next();
}

/**
 * @swagger
 * /api/organizer/tournament/{tournamentId}/teams:
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
 * /api/organizer/tournament/{tournamentId}/teams:
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
 * /api/organizer/tournament/{tournamentId}/teams:
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
 * /api/organizer/tournament/{tournamentId}/teams/{teamId}/owner:
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
 * /api/organizer/tournament/{tournamentId}/teams/{teamId}/coaches:
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
 * /api/organizer/tournament/{tournamentId}/teams/{teamId}/coaches:
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
    return res.status(201).json(await coachProvider.addCoach(req.params.teamId as string, email));
});

/**
 * @swagger
 * /api/organizer/tournament/{tournamentId}/teams/{teamId}/coaches/{coachId}:
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
 * /api/organizer/tournament/{tournamentId}/teams/{teamId}/students:
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
 * /api/organizer/tournament/{tournamentId}/teams/{teamId}/students:
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
 * /api/organizer/tournament/{tournamentId}/teams/{teamId}/students/{studentId}:
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
 * /api/organizer/tournament/{tournamentId}/teams/{teamId}/pairings/{pairingId}/witness-order:
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
 * /api/organizer/tournament/{tournamentId}/teams/{teamId}/pairings/{pairingId}/witness-order:
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
 * /api/organizer/tournament/{tournamentId}/teams/{teamId}/pairings/{pairingId}/assignments:
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
 * /api/organizer/tournament/{tournamentId}/teams/{teamId}/pairings/{pairingId}/assignments:
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
 * /api/organizer/tournament/{tournamentId}/rounds:
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
 * /api/organizer/tournament/{tournamentId}/rounds:
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

// ── Scorecard viewer ──────────────────────────────────────────────────────────

/**
 * GET /api/organizer/tournament/:tournamentId/pairings/:pairingId/scoresheets/:assignmentId
 * Returns the stored ballot for a scorer assignment, or null if not yet submitted.
 * Used by the organizer's ScorecardViewer page.
 * No round ID is needed because the assignment ID uniquely identifies the ballot.
 */
router.get('/pairings/:pairingId/scoresheets/:assignmentId', tournamentHandler(async (req, res) => {
    const assignmentId = req.params.assignmentId as string;
    if (!uuidRegex.test(assignmentId)) return res.status(400).json({ message: 'Invalid assignment ID' });
    const ballot = await scorerProv.getBallot(assignmentId);
    return res.status(200).json(ballot);
}));

export default router;
