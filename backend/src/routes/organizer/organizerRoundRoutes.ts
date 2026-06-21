import { Request, Response, Router } from "express";
import * as organizer from "../../providers/organizerProvider";
import { IPairingCreationPayload, IRound } from "@mock-scores/shared";
import { DbError, NotFoundError } from "../../errors";
import { uuidRegex } from "../../authUtils";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
    if (!req.round) return res.status(404).json({ message: "No Round specified" });
    return res.status(200).json(req.round);
});

router.patch("/", async (req: Request, res: Response) => {
    if (!req.round) return res.status(404).json({ message: "No Round specified" });
    const round: IRound = req.body;
    if (round.name == undefined || round.results_public == undefined || round.teams_public == undefined)
        return res.status(400).json({ message: "Missing required fields" });
    try {
        return res.status(200).json(await organizer.updateRound(req.round.round_id, round));
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
});

router.delete("/", async (req: Request, res: Response) => {
    if (!req.round) return res.status(404).json({ message: "No Round specified" });
    try {
        const row = await organizer.deleteRound(req.round.round_id);
        return res.status(204).json({ ...row, round_time: row.round_time?.toISOString() ?? null });
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
});

router.get('/pairings', async (req: Request, res: Response) => {
    if (!req.round) return res.status(404).json({ message: "No Round specified" });
    try {
        return res.status(200).json(await organizer.getPairings(req.round.round_id));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
});

router.post('/pairings', async (req: Request, res: Response) => {
    if (!req.round || !req.tournament) return res.status(404).json({ message: "No Round specified" });
    const { prosectionID, defenseID, courtroomID }: IPairingCreationPayload = req.body;
    if (!prosectionID || !defenseID || !courtroomID) return res.status(400).json({ message: "Missing required fields" });
    if (prosectionID === defenseID) return res.status(400).json({ message: "Prosecution and defense teams must differ" });
    try {
        return res.status(201).json(await organizer.createRoundPairing(req.round.round_id, prosectionID, defenseID, courtroomID));
    } catch (e: unknown) {
        const detail: string = (e as { detail?: string })?.detail ?? '';
        if (detail.includes('p_team')) return res.status(409).json({ message: "That team is already assigned as prosecution this round" });
        if (detail.includes('d_team')) return res.status(409).json({ message: "That team is already assigned as defense this round" });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to create pairing' });
        throw e;
    }
});

router.delete('/pairings/:pairing', async (req: Request, res: Response) => {
    const pairing = req.params.pairing as string;
    if (!uuidRegex.test(pairing)) return res.status(400).json({ message: 'Invalid pairing ID' });
    try {
        await organizer.deletePairing(pairing);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
});

router.get('/pairings/:pairing/scorers', async (req: Request, res: Response) => {
    const pairing = req.params.pairing as string;
    if (!uuidRegex.test(pairing)) return res.status(400).json({ message: 'Invalid pairing ID' });
    return res.status(200).json(await organizer.getPairingScorers(pairing));
});

router.post('/pairings/:pairing/scorers', async (req: Request, res: Response) => {
    const pairing = req.params.pairing as string;
    if (!uuidRegex.test(pairing)) return res.status(400).json({ message: 'Invalid pairing ID' });
    const { scorer_id, paper_name } = req.body as { scorer_id?: string; paper_name?: string };
    try {
        if (scorer_id) {
            if (!uuidRegex.test(scorer_id)) return res.status(400).json({ message: 'Invalid scorer ID' });
            return res.status(201).json(await organizer.assignScorerToPairing(pairing, scorer_id));
        }
        if (paper_name?.trim()) {
            return res.status(201).json(await organizer.addPaperScorer(pairing, paper_name.trim()));
        }
        return res.status(400).json({ message: 'Provide scorer_id or paper_name' });
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to assign scorer' });
        throw e;
    }
});

router.delete('/pairings/:pairing/scorers/:assignment', async (req: Request, res: Response) => {
    const assignment = req.params.assignment as string;
    if (!uuidRegex.test(assignment)) return res.status(400).json({ message: 'Invalid assignment ID' });
    try {
        await organizer.removeScorerAssignment(assignment);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
});

router.put('/pairings/:pairing/presider', async (req: Request, res: Response) => {
    const pairing = req.params.pairing as string;
    if (!uuidRegex.test(pairing)) return res.status(400).json({ message: 'Invalid pairing ID' });
    const { assignment_id } = req.body as { assignment_id: string };
    if (!assignment_id || !uuidRegex.test(assignment_id)) return res.status(400).json({ message: 'Invalid assignment_id' });
    try {
        await organizer.setPresider(pairing, assignment_id);
        return res.status(200).json({ success: true });
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to set presider' });
        throw e;
    }
});

router.delete('/pairings/:pairing/presider', async (req: Request, res: Response) => {
    const pairing = req.params.pairing as string;
    if (!uuidRegex.test(pairing)) return res.status(400).json({ message: 'Invalid pairing ID' });
    await organizer.clearPresider(pairing);
    return res.status(204).send();
});

export default router;
