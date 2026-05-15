import { Request, Response, Router} from "express";
import {TournamentPayload} from "@mock-scores/shared";
import {TournamentProvider} from "../providers/tournamentProvider";


const router = Router();


const tournamentProvider = new TournamentProvider();


router.patch("/", async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });

    const payload = req.body as TournamentPayload;
    const ok = await tournamentProvider.updateTournament(req.tournament, payload);

    if (!ok) return res.status(500).json({ message: 'Unable to update tournament' });
    return res.status(200).json({ success: true });
})

router.get("/", async (req: Request, res: Response) => {
    if(!req?.tournament) {
        return res.status(403).json({ message: 'No access to tournament' });
    }

    const tournament = await tournamentProvider.getTournament(req.tournament)

    if(!tournament) {
        return res.status(404).json({ message: 'No tournament found' });
    }
    return res.status(200).json(tournament);

})


router.get("/scorers", async (req: Request, res: Response) => {

    if(!req?.tournament) {
        return res.status(403).json({ message: 'No access to tournament' });
    }
    const scorers = tournamentProvider.getScorers(req.tournament);

    if(!scorers) return res.status(500).json({ message: 'Unable to reach backend' });

    return res.status(200).json(scorers);

})



export default router;