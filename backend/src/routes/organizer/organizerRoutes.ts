import { Request, Response, Router } from "express";
import type { TournamentPayload } from '@mock-scores/shared';
import * as organizer from "../../providers/organizerProvider";
import { verifyTournamentAccess, verifyTournamentOwner } from "../../authUtils";
import { DbError, NotFoundError } from "../../errors";
import { authedHandler, tournamentHandler } from "../../types/handlers";
import subRoutes from "./organizerTournamentRoutes";

const router = Router();

router.get("/", authedHandler(async (req, res) => {
    try {
        return res.status(200).json(await organizer.getTournaments(req.session.userId));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
}));

router.get("/standings-templates", async (req: Request, res: Response) => {
    try {
        return res.status(200).json(await organizer.getStandingsTemplates());
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
});

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
