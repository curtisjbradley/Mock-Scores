import { Request, Response, Router} from "express";
import type { TournamentPayload } from '@mock-scores/shared';
import {OrganizerProvider} from "../../providers/organizerProvider";
import {verifyTournamentAccess, verifyTournamentOwner} from "../../authUtils";

import subRoutes from "./organizerTournamentRoutes";

const router = Router();




const tournamentProvider = new OrganizerProvider();


router.get("/", async (req: Request, res: Response) => {
    if(!req?.session) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }

    const tournaments = await tournamentProvider.getTournaments(req.session.userId)

    if (tournaments == null) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }

   return res.status(200).json(tournaments);
})


router.get("/standings-templates", async (req: Request, res: Response) => {
    if (!req?.session) return res.status(401).json({ message: 'Invalid or expired token' });
    return res.status(200).json(await tournamentProvider.getStandingsTemplates());
})

router.post("/", async (req: Request, res: Response) => {
    if (!req?.session) return res.status(401).json({ message: 'Invalid or expired token' });

    const payload = req.body as TournamentPayload;

    const tournament = await tournamentProvider.createTournament(payload);

    if (!tournament) {
        return res.status(500).json({ message: 'Unable to create tournament' });
    }
    await tournamentProvider.addTournamentOrganizer(tournament.id,req.session.userId, "owner")

    return res.status(201).json(tournament);
})


router.post("/duplicate/:tournamentId", verifyTournamentAccess, async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const { scorers = false, courtrooms = false, scoringCategories = false, witnesses = false, format = false, tiebreaker = false } = req.body ?? {};
    const tournament = await tournamentProvider.duplicateTournament(req.tournament, { scorers, courtrooms, scoringCategories, witnesses, format, tiebreaker });
    if (!tournament) return res.status(500).json({ message: 'Unable to duplicate tournament' });
    if (!req.session) return res.status(401).json({ message: 'Invalid session' });
    await tournamentProvider.addTournamentOrganizer(tournament.id, req.session.userId, 'owner');
    return res.status(201).json(tournament);
})

router.delete("/:tournamentId", verifyTournamentOwner, async (req: Request, res: Response) => {
    if (!req.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const ok = await tournamentProvider.deleteTournament(req.tournament);
    if (!ok) return res.status(500).json({ message: 'Unable to delete tournament' });
    return res.status(204).send();
})

router.use("/:tournamentId", verifyTournamentAccess, subRoutes)




export default router;