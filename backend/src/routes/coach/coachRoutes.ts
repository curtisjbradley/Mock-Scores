import { Router } from "express";
import * as coach from "../../providers/coachProvider";
import { getScoringCategories } from "../../providers/organizerProvider";
import { uuidRegex } from "../../authUtils";
import { authedHandler } from "../../types/handlers";
import teamRoutes from "./coachTeamRoutes";

const router = Router();

router.get("/tournaments", authedHandler(async (req, res) => {
    return res.status(200).json(await coach.getAllTournaments(req.session.userId));
}));

router.get("/tournaments/:tournamentId/schedule", authedHandler(async (req, res) => {
    const id = req.params.tournamentId as string;
    if (!uuidRegex.test(id)) return res.status(400).json({ message: "Invalid tournament ID" });
    return res.status(200).json(await coach.getSchedule(id));
}));

router.get("/tournaments/:tournamentId/results", authedHandler(async (req, res) => {
    const id = req.params.tournamentId as string;
    if (!uuidRegex.test(id)) return res.status(400).json({ message: "Invalid tournament ID" });
    return res.status(200).json(await coach.getResults(id));
}));

router.get("/tournaments/:tournamentId/field", authedHandler(async (req, res) => {
    const id = req.params.tournamentId as string;
    if (!uuidRegex.test(id)) return res.status(400).json({ message: "Invalid tournament ID" });
    return res.status(200).json(await coach.getCompetitionField(id));
}));

router.get("/tournaments/:tournamentId/standings", authedHandler(async (req, res) => {
    const id = req.params.tournamentId as string;
    if (!uuidRegex.test(id)) return res.status(400).json({ message: "Invalid tournament ID" });
    return res.status(200).json(await coach.getStandingsData(id));
}));

router.get("/tournaments/:tournamentId/scoring-categories", authedHandler(async (req, res) => {
    const id = req.params.tournamentId as string;
    if (!uuidRegex.test(id)) return res.status(400).json({ message: "Invalid tournament ID" });
    return res.status(200).json(await getScoringCategories(id));
}));

router.get("/tournaments/:tournamentId/witnesses", authedHandler(async (req, res) => {
    const id = req.params.tournamentId as string;
    if (!uuidRegex.test(id)) return res.status(400).json({ message: "Invalid tournament ID" });
    return res.status(200).json(await coach.getWitnessesForTournament(id));
}));

router.get("/tournaments/:tournamentId/format", authedHandler(async (req, res) => {
    const id = req.params.tournamentId as string;
    if (!uuidRegex.test(id)) return res.status(400).json({ message: "Invalid tournament ID" });
    return res.status(200).json(await coach.getFormatForTournament(id));
}));

router.use("/teams/:teamId", teamRoutes);

export default router;
