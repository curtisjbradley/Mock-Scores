import { Request, Response, Router} from "express";
import type { TournamentPayload } from '@mock-scores/shared';
import {OrganizerProvider} from "../../providers/organizerProvider";
import {verifyTournamentAccess} from "../../authUtils";

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


router.use("/:tournamentId", verifyTournamentAccess, subRoutes)


export default router;