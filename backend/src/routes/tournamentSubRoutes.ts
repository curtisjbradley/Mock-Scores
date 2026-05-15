import {NextFunction, Request, Response, Router} from "express";
import {TournamentPayload} from "@mock-scores/shared";
import {TournamentProvider} from "../providers/tournamentProvider";

import type {IScorer} from "@mock-scores/shared"


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


    const scorers = await tournamentProvider.getScorers(req.tournament);


    if(!scorers) return res.status(500).json({ message: 'Unable to reach backend' });

    return res.status(200).json(scorers);

})

function verifyScorer(req: Request, res: Response, next : NextFunction) {
    if(!req?.tournament) {
        return res.status(403).json({ message: 'No access to tournament' });
    }
    const scorer : IScorer = req.body

    if(!scorer?.tournament_id || !scorer?.email || !scorer?.first_name || !scorer?.last_name || !scorer?.scorer_id) {
        return res.status(409).json({ message: 'Missing required field(s)' });
    }
    req.scorer = scorer;
    next();
}

router.post("/scorers", verifyScorer, async (req: Request, res: Response) => {
    if (!req?.scorer){
        return res.status(401).json({ message: 'Unable to get scorer' });
    }
    const result = await tournamentProvider.addScorer(req.scorer);

    if (!result) {
        return res.status(500).json({ message: 'Unable to communicate with database' });
    }

    return res.status(200).json(req.scorer);
});

router.put("/scorers", verifyScorer, async (req: Request, res: Response) => {
    if (!req?.scorer){
        return res.status(401).json({ message: 'Unable to get scorer' });
    }

    const result = await tournamentProvider.updateScorer(req.scorer);

    if (!result) {
        return res.status(500).json({ message: 'Unable to communicate with database' });
    }

    return res.status(200).json(req.scorer);
});

router.delete("/scorers", async (req: Request, res: Response) => {
    const {scorer_id} = req.body;

    if(!scorer_id){
        return res.status(409).json({ message: 'Did not provide a scorer_id' });
    }

    const result = await tournamentProvider.deleteScorer(scorer_id);
    if (!result) {
        return res.status(500).json({ message: 'Unable to delete scorer' });
    }
    return res.status(204).send();
});

export default router;