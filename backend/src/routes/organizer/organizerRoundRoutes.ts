import { Request, Response, Router} from "express";
import {OrganizerProvider} from "../../providers/organizerProvider";
import {IPairingCreationPayload, IRound} from "@mock-scores/shared";
import {uuidRegex} from "../../authUtils";

const router = Router();


const organizerProvider = new OrganizerProvider();

router.delete("/", async (req: Request, res : Response) => {
    if (!req.round) {
        return res.status(404).json({message: "No Round specified"});
    }

    const row = await organizerProvider.deleteRound(req.round.round_id)

    if (!row) {
        return res.status(404).json({message: "Unable to find row"});
    }

    const out : IRound = {...row, round_time : row.round_time?.toISOString() ?? null}

    return res.status(204).json(out);
})

router.patch("/", async (req: Request, res : Response) => {
    if (!req.round) {
        return res.status(404).json({message: "No Round specified"});
    }
    const round : IRound = req.body;


    if(round.name == undefined || round.results_public == undefined || round.teams_public == undefined) {
        return res.status(400).json({message: "Missing required fields"})
    }

    const result = await organizerProvider.updateRound(req.round.round_id, round as IRound);

    if (!result) {
        return res.status(404).json({message: "Unable to update round with round id not found"});
    }

    return res.status(201).json(result)

})

router.get("/", async (req: Request, res : Response) => {
    if (!req.round) {
        return res.status(404).json({message: "No Round specified"});
    }
    return res.status(200).json(req.round)
});


router.post('/pairings', async (req: Request, res : Response) => {
    if (!req.round || !req.tournament) {
        return res.status(404).json({message: "No Round specified"});
    }
    const { prosectionID, defenseID, courtroomID }: IPairingCreationPayload = req.body;

    if (!prosectionID || !defenseID || !courtroomID) {
        return res.status(400).json({message: "Missing required fields"})
    }
    if (prosectionID === defenseID) {
        return res.status(400).json({message: "Prosecution and defense teams must differ"})
    }

    try {
        const out = await organizerProvider.createRoundPairing(req.round.round_id, prosectionID, defenseID, courtroomID)
        if (!out) return res.status(500).json({message: "Unable to create pairing"})
        return res.status(201).json(out)
    } catch (e: unknown) {
        const detail: string = (e as { detail?: string })?.detail ?? ''
        if (detail.includes('p_team')) return res.status(409).json({message: "That team is already assigned as prosecution this round"})
        if (detail.includes('d_team')) return res.status(409).json({message: "That team is already assigned as defense this round"})
        return res.status(500).json({message: "Unable to create pairing"})
    }
})

router.get('/pairings', async (req: Request, res : Response) => {
    if (!req.round || !req.tournament) {
        return res.status(404).json({message: "No Round specified"});
    }
    return res.status(200).json(await organizerProvider.getPairings(req.round.round_id))
})

router.delete('/pairings/:pairing', async (req: Request, res: Response) => {
    const pairing = req.params.pairing as string;
    if (!uuidRegex.test(pairing)) return res.status(400).json({ message: 'Invalid pairing ID' });
    const ok = await organizerProvider.deletePairing(pairing);
    if (!ok) return res.status(404).json({ message: 'Pairing not found' });
    return res.status(204).send();
})

router.get('/pairings/:pairing/scorers', async (req: Request, res: Response) => {
    const pairing = req.params.pairing as string;
    if (!uuidRegex.test(pairing)) return res.status(400).json({ message: 'Invalid pairing ID' });
    return res.status(200).json(await organizerProvider.getPairingScorers(pairing));
})

router.post('/pairings/:pairing/scorers', async (req: Request, res: Response) => {
    const pairing = req.params.pairing as string;
    if (!uuidRegex.test(pairing)) return res.status(400).json({ message: 'Invalid pairing ID' });
    const { scorer_id, paper_name } = req.body as { scorer_id?: string; paper_name?: string };
    if (scorer_id) {
        if (!uuidRegex.test(scorer_id)) return res.status(400).json({ message: 'Invalid scorer ID' });
        const result = await organizerProvider.assignScorerToPairing(pairing, scorer_id);
        if (!result) return res.status(500).json({ message: 'Unable to assign scorer' });
        return res.status(201).json(result);
    }
    if (paper_name?.trim()) {
        const result = await organizerProvider.addPaperScorer(pairing, paper_name.trim());
        if (!result) return res.status(500).json({ message: 'Unable to add paper scorer' });
        return res.status(201).json(result);
    }
    return res.status(400).json({ message: 'Provide scorer_id or paper_name' });
})

router.delete('/pairings/:pairing/scorers/:assignment', async (req: Request, res: Response) => {
    const assignment = req.params.assignment as string;
    if (!uuidRegex.test(assignment)) return res.status(400).json({ message: 'Invalid assignment ID' });
    const ok = await organizerProvider.removeScorerAssignment(assignment);
    if (!ok) return res.status(404).json({ message: 'Assignment not found' });
    return res.status(204).send();
})

router.put('/pairings/:pairing/presider', async (req: Request, res: Response) => {
    const pairing = req.params.pairing as string;
    if (!uuidRegex.test(pairing)) return res.status(400).json({ message: 'Invalid pairing ID' });
    const { assignment_id } = req.body as { assignment_id: string };
    if (!assignment_id || !uuidRegex.test(assignment_id)) return res.status(400).json({ message: 'Invalid assignment_id' });
    const ok = await organizerProvider.setPresider(pairing, assignment_id);
    if (!ok) return res.status(500).json({ message: 'Unable to set presider' });
    return res.status(200).json({ success: true });
})

router.delete('/pairings/:pairing/presider', async (req: Request, res: Response) => {
    const pairing = req.params.pairing as string;
    if (!uuidRegex.test(pairing)) return res.status(400).json({ message: 'Invalid pairing ID' });
    await organizerProvider.clearPresider(pairing);
    return res.status(204).send();
})

export default router;