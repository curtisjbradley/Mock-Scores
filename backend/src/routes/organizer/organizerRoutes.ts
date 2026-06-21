import { Request, Response, Router } from "express";
import type { TournamentPayload } from '@mock-scores/shared';
import * as organizer from "../../providers/organizerProvider";
import { verifyTournamentAccess, verifyTournamentOwner } from "../../authUtils";
import { DbError, NotFoundError } from "../../errors";
import subRoutes from "./organizerTournamentRoutes";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
    if (!req.session) return res.status(401).json({ message: 'Invalid or expired token' });
    try {
        return res.status(200).json(await organizer.getTournaments(req.session.userId));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
});

router.get("/standings-templates", async (req: Request, res: Response) => {
    if (!req.session) return res.status(401).json({ message: 'Invalid or expired token' });
    try {
        return res.status(200).json(await organizer.getStandingsTemplates());
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
});

router.post("/", async (req: Request, res: Response) => {
    if (!req.session) return res.status(401).json({ message: 'Invalid or expired token' });
    try {
        const tournament = await organizer.createTournament(req.body as TournamentPayload);
        await organizer.addTournamentOrganizer(tournament.id, req.session.userId, "owner");
        return res.status(201).json(tournament);
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to create tournament' });
        throw e;
    }
});

router.post("/duplicate/:tournamentId", verifyTournamentAccess, async (req: Request, res: Response) => {
    if (!req.tournament || !req.session) return res.status(403).json({ message: 'No access to tournament' });
    const { scorers = false, courtrooms = false, scoringCategories = false, witnesses = false, format = false, tiebreaker = false } = req.body ?? {};
    try {
        const tournament = await organizer.duplicateTournament(req.tournament, { scorers, courtrooms, scoringCategories, witnesses, format, tiebreaker });
        await organizer.addTournamentOrganizer(tournament.id, req.session.userId, 'owner');
        return res.status(201).json(tournament);
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to duplicate tournament' });
        throw e;
    }
});

router.delete("/:tournamentId", verifyTournamentOwner, async (req: Request, res: Response) => {
    if (!req.tournament) return res.status(403).json({ message: 'No access to tournament' });
    try {
        await organizer.deleteTournament(req.tournament);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to delete tournament' });
        throw e;
    }
});

router.use("/:tournamentId", verifyTournamentAccess, subRoutes);

export default router;
