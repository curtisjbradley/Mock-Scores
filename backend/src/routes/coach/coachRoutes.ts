import { Router, Request, Response } from "express";
import * as coach from "../../providers/coachProvider";
import { uuidRegex } from "../../authUtils";
import teamRoutes from "./coachTeamRoutes";

const router = Router();

router.get("/tournaments", async (req: Request, res: Response) => {
    if (!req.session) return res.status(401).json({ message: "not authenticated" });
    return res.status(200).json(await coach.getAllTournaments(req.session.userId));
});

router.get("/tournaments/:tournamentId/schedule", async (req: Request, res: Response) => {
    if (!req.session) return res.status(401).json({ message: "not authenticated" });
    const id = req.params.tournamentId as string;
    if (!uuidRegex.test(id)) return res.status(400).json({ message: "Invalid tournament ID" });
    return res.status(200).json(await coach.getSchedule(id));
});

router.get("/tournaments/:tournamentId/results", async (req: Request, res: Response) => {
    if (!req.session) return res.status(401).json({ message: "not authenticated" });
    const id = req.params.tournamentId as string;
    if (!uuidRegex.test(id)) return res.status(400).json({ message: "Invalid tournament ID" });
    return res.status(200).json(await coach.getResults(id));
});

router.get("/tournaments/:tournamentId/field", async (req: Request, res: Response) => {
    if (!req.session) return res.status(401).json({ message: "not authenticated" });
    const id = req.params.tournamentId as string;
    if (!uuidRegex.test(id)) return res.status(400).json({ message: "Invalid tournament ID" });
    return res.status(200).json(await coach.getCompetitionField(id));
});

router.get("/tournaments/:tournamentId/standings", async (req: Request, res: Response) => {
    if (!req.session) return res.status(401).json({ message: "not authenticated" });
    const id = req.params.tournamentId as string;
    if (!uuidRegex.test(id)) return res.status(400).json({ message: "Invalid tournament ID" });
    return res.status(200).json(await coach.getStandingsData(id));
});

router.use("/teams/:teamId", teamRoutes);

export default router;
