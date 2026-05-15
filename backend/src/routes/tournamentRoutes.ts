import { Request, Response, Router} from "express";
import type { TournamentPayload } from '@mock-scores/shared';
import {TournamentProvider} from "../providers/tournamentProvider";
import {verifyTournamentAccess} from "../authUtils";

const router = Router();




const tournamentProvider = new TournamentProvider();





router.get("/", async (req: Request, res: Response) => {
    if(!req?.session) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }

    const tournaments = await tournamentProvider.getTournaments(req.session.email)

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
    await tournamentProvider.addTournamentOrganizer(tournament.id,req.session.email, "owner")

    return res.status(201).json(tournament);
})


router.patch("/:tournamentId", verifyTournamentAccess, async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });

    const payload = req.body as TournamentPayload;
    const ok = await tournamentProvider.updateTournament(req.tournament, payload);

    if (!ok) return res.status(500).json({ message: 'Unable to update tournament' });
    return res.status(200).json({ success: true });
})

router.get("/:tournamentId", verifyTournamentAccess, async (req: Request, res: Response) => {
    if(!req?.tournament) {
        return res.status(403).json({ message: 'No access to tournament' });
    }

    const tournament = await tournamentProvider.getTournament(req.tournament)

    if(!tournament) {
        return res.status(404).json({ message: 'No tournament found' });
    }
    return res.status(200).json(tournament);

})


export default router;