import { Router } from "express";
import * as coach from "../../providers/coachProvider";
import { getScoringCategories } from "../../providers/organizerProvider";
import { uuidRegex } from "../../authUtils";
import { authedHandler } from "../../types/handlers";
import teamRoutes from "./coachTeamRoutes";

const router = Router();

/**
 * @swagger
 * /api/coach/tournaments:
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
 * /api/coach/tournaments/{tournamentId}/schedule:
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
    return res.status(200).json(await coach.getSchedule(id));
}));

/**
 * @swagger
 * /api/coach/tournaments/{tournamentId}/results:
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
 * /api/coach/tournaments/{tournamentId}/field:
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
 * /api/coach/tournaments/{tournamentId}/standings:
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
 * /api/coach/tournaments/{tournamentId}/scoring-categories:
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
 * /api/coach/tournaments/{tournamentId}/witnesses:
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
 * /api/coach/tournaments/{tournamentId}/format:
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

export default router;
