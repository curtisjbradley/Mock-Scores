import { Router } from "express";
import * as coach from "../../providers/coachProvider";
import { getScoringCategories } from "../../providers/organizerProvider";
import { getScoreSheet, getBallot } from "../../providers/scorerProvider";
import { uuidRegex } from "../../authUtils";
import { authedHandler } from "../../types/handlers";
import teamRoutes from "./coachTeamRoutes";

const router = Router();

/**
 * @swagger
 * /coach/tournaments:
 *   get:
 *     summary: List all tournaments the coach is associated with
 *     tags: [Coach]
 *     responses:
 *       200: { description: Array of tournaments }
 */
router.get("/tournaments", authedHandler(async (req, res) => {
    return res.status(200).json(await coach.getAllTournaments(req.session.userId));
}));

/**
 * @swagger
 * /coach/tournaments/{tournamentId}/schedule:
 *   get:
 *     summary: Get tournament schedule
 *     tags: [Coach]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Schedule data }
 *       400: { description: Invalid tournament ID }
 */
router.get("/tournaments/:tournamentId/schedule", authedHandler(async (req, res) => {
    const id = req.params.tournamentId as string;
    if (!uuidRegex.test(id)) return res.status(400).json({ message: "Invalid tournament ID" });

    // Accept an explicit teamId query param (used by organizer preview view).
    // Fall back to deriving it from the session for regular coach access.
    const queryTeamId = typeof req.query.teamId === 'string' ? req.query.teamId : null;
    if (queryTeamId && !uuidRegex.test(queryTeamId)) return res.status(400).json({ message: "Invalid team ID" });

    const teamId = queryTeamId ?? await coach.getTeamIdForCoach(id, req.session.userId);
    if (!teamId) return res.status(200).json([]);
    return res.status(200).json(await coach.getSchedule(id, teamId));
}));

/**
 * @swagger
 * /coach/tournaments/{tournamentId}/results:
 *   get:
 *     summary: Get tournament results
 *     tags: [Coach]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Results data }
 *       400: { description: Invalid tournament ID }
 */
router.get("/tournaments/:tournamentId/results", authedHandler(async (req, res) => {
    const id = req.params.tournamentId as string;
    if (!uuidRegex.test(id)) return res.status(400).json({ message: "Invalid tournament ID" });
    return res.status(200).json(await coach.getResults(id));
}));

/**
 * @swagger
 * /coach/tournaments/{tournamentId}/field:
 *   get:
 *     summary: Get competition field (all teams in the tournament)
 *     tags: [Coach]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Competition field }
 *       400: { description: Invalid tournament ID }
 */
router.get("/tournaments/:tournamentId/field", authedHandler(async (req, res) => {
    const id = req.params.tournamentId as string;
    if (!uuidRegex.test(id)) return res.status(400).json({ message: "Invalid tournament ID" });
    return res.status(200).json(await coach.getCompetitionField(id));
}));

/**
 * @swagger
 * /coach/tournaments/{tournamentId}/standings:
 *   get:
 *     summary: Get standings data for a tournament
 *     tags: [Coach]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Standings data }
 *       400: { description: Invalid tournament ID }
 */
router.get("/tournaments/:tournamentId/standings", authedHandler(async (req, res) => {
    const id = req.params.tournamentId as string;
    if (!uuidRegex.test(id)) return res.status(400).json({ message: "Invalid tournament ID" });
    return res.status(200).json(await coach.getStandingsData(id));
}));

/**
 * @swagger
 * /coach/tournaments/{tournamentId}/scoring-categories:
 *   get:
 *     summary: Get scoring categories for a tournament
 *     tags: [Coach]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Scoring categories }
 *       400: { description: Invalid tournament ID }
 */
router.get("/tournaments/:tournamentId/scoring-categories", authedHandler(async (req, res) => {
    const id = req.params.tournamentId as string;
    if (!uuidRegex.test(id)) return res.status(400).json({ message: "Invalid tournament ID" });
    return res.status(200).json(await getScoringCategories(id));
}));

/**
 * @swagger
 * /coach/tournaments/{tournamentId}/witnesses:
 *   get:
 *     summary: Get witnesses for a tournament
 *     tags: [Coach]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Witnesses }
 *       400: { description: Invalid tournament ID }
 */
router.get("/tournaments/:tournamentId/witnesses", authedHandler(async (req, res) => {
    const id = req.params.tournamentId as string;
    if (!uuidRegex.test(id)) return res.status(400).json({ message: "Invalid tournament ID" });
    return res.status(200).json(await coach.getWitnessesForTournament(id));
}));

/**
 * @swagger
 * /coach/tournaments/{tournamentId}/format:
 *   get:
 *     summary: Get case format for a tournament
 *     tags: [Coach]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Case format }
 *       400: { description: Invalid tournament ID }
 */
router.get("/tournaments/:tournamentId/format", authedHandler(async (req, res) => {
    const id = req.params.tournamentId as string;
    if (!uuidRegex.test(id)) return res.status(400).json({ message: "Invalid tournament ID" });
    return res.status(200).json(await coach.getFormatForTournament(id));
}));

router.use("/teams/:teamId", teamRoutes);

/**
 * @swagger
 * /coach/tournaments/{tournamentId}/pairings/{pairingId}/ballots:
 *   get:
 *     summary: Get individual ballot breakdowns for a pairing (only if results are published)
 *     tags: [Coach]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: pairingId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Array of individual ballot summaries }
 *       400: { description: Invalid ID }
 *       403: { description: Results not published }
 */
router.get("/tournaments/:tournamentId/pairings/:pairingId/ballots", authedHandler(async (req, res) => {
    const tournamentId = req.params.tournamentId as string;
    const pairingId = req.params.pairingId as string;
    if (!uuidRegex.test(tournamentId)) return res.status(400).json({ message: "Invalid tournament ID" });
    if (!uuidRegex.test(pairingId)) return res.status(400).json({ message: "Invalid pairing ID" });
    if (!await coach.canViewPairingResults(tournamentId, pairingId)) return res.status(404).json({ message: "Pairing not found" });
    return res.status(200).json(await coach.getPairingBallots(tournamentId, pairingId));
}));


/**
 * @swagger
 * /coach/tournaments/{tournamentId}/pairings/{pairingId}/ballots/{assignmentId}:
 *   get:
 *     summary: Get full ballot detail (scoresheet format + scores) for a specific ballot
 *     tags: [Coach]
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
 *       200: { description: Scoresheet format + ballot data (scorer name redacted) }
 *       400: { description: Invalid ID }
 *       404: { description: Ballot not found }
 */
router.get("/tournaments/:tournamentId/pairings/:pairingId/ballots/:assignmentId", authedHandler(async (req, res) => {
    const tournamentId = req.params.tournamentId as string;
    const pairingId = req.params.pairingId as string;
    const assignmentId = req.params.assignmentId as string;
    if (!uuidRegex.test(tournamentId)) return res.status(400).json({ message: "Invalid tournament ID" });
    if (!uuidRegex.test(pairingId)) return res.status(400).json({ message: "Invalid pairing ID" });
    if (!uuidRegex.test(assignmentId)) return res.status(400).json({ message: "Invalid assignment ID" });

    if (!await coach.isAssignmentInPairingWithPublicResults(tournamentId, pairingId, assignmentId))
        return res.status(404).json({ message: "Ballot not found" });

    const sheet = await getScoreSheet(assignmentId, { skipGuards: true }).catch(() => null);
    const ballot = await getBallot(assignmentId);

    if (!sheet && !ballot) return res.status(404).json({ message: "Ballot not found" });

    // Redact scorer identity from the sheet
    if (sheet) {
        sheet.scorer = { firstName: '', lastName: '', scorerID: '', isPaper: false };
        sheet.presiderName = '';
    }

    return res.status(200).json({ sheet, ballot });
}));

export default router;
