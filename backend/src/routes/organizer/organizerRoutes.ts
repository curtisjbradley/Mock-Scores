import { Request, Response, Router } from "express";
import type { TournamentPayload } from '@mock-scores/shared';
import * as organizer from "../../providers/organizerProvider";
import { verifyTournamentAccess, verifyTournamentOwner } from "../../authUtils";
import { DbError, NotFoundError } from "../../errors";
import { authedHandler, tournamentHandler } from "../../types/handlers";
import subRoutes from "./organizerTournamentRoutes";

const router = Router();

/**
 * @swagger
 * /organizer/tournament:
 *   get:
 *     summary: List tournaments for the authenticated organizer
 *     tags: [Organizer - Tournaments]
 *     responses:
 *       200: { description: Array of tournaments }
 *       500: { description: Database error }
 */
router.get("/", authedHandler(async (req, res) => {
    try {
        return res.status(200).json(await organizer.getTournaments(req.session.userId));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/standings-templates:
 *   get:
 *     summary: Get available standings templates
 *     tags: [Organizer - Tournaments]
 *     responses:
 *       200: { description: Array of templates }
 *       500: { description: Database error }
 */
router.get("/standings-templates", async (req: Request, res: Response) => {
    try {
        return res.status(200).json(await organizer.getStandingsTemplates());
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
});

/**
 * @swagger
 * /organizer/tournament:
 *   post:
 *     summary: Create a new tournament
 *     tags: [Organizer - Tournaments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: TournamentPayload
 *     responses:
 *       201: { description: Created tournament }
 *       500: { description: Unable to create tournament }
 */
router.post("/", authedHandler(async (req, res) => {
    try {
        const tournament = await organizer.createTournament(req.body as TournamentPayload);
        await organizer.addTournamentOrganizer(tournament.id, req.session.userId, "owner");
        return res.status(201).json(tournament);
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to create tournament' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/duplicate/{tournamentId}:
 *   post:
 *     summary: Duplicate an existing tournament
 *     tags: [Organizer - Tournaments]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scorers: { type: boolean }
 *               courtrooms: { type: boolean }
 *               scoringCategories: { type: boolean }
 *               witnesses: { type: boolean }
 *               format: { type: boolean }
 *               tiebreaker: { type: boolean }
 *     responses:
 *       201: { description: Duplicated tournament }
 *       404: { description: Tournament not found }
 *       500: { description: Unable to duplicate tournament }
 */
router.post("/duplicate/:tournamentId", verifyTournamentAccess, tournamentHandler(async (req, res) => {
    const { scorers = false, courtrooms = false, scoringCategories = false, witnesses = false, format = false, tiebreaker = false } = req.body ?? {};
    try {
        const dup = await organizer.duplicateTournament(req.tournament, { scorers, courtrooms, scoringCategories, witnesses, format, tiebreaker });
        await organizer.addTournamentOrganizer(dup.id, req.session.userId, 'owner');
        return res.status(201).json(dup);
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to duplicate tournament' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}:
 *   delete:
 *     summary: Delete a tournament (owner only)
 *     tags: [Organizer - Tournaments]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Deleted }
 *       404: { description: Not found }
 *       500: { description: Unable to delete tournament }
 */
router.delete("/:tournamentId", verifyTournamentOwner, tournamentHandler(async (req, res) => {
    try {
        await organizer.deleteTournament(req.tournament);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to delete tournament' });
        throw e;
    }
}));

router.use("/:tournamentId", verifyTournamentAccess, subRoutes);

export default router;
