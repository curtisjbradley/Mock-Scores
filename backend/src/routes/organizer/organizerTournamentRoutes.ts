import { NextFunction, Request, Response, Router } from "express";
import { IRound, TournamentPayload, IWitnesses, IOrganizer, IScorer, ITeam } from "@mock-scores/shared";
import { AlreadyExistsError, DbError, NotFoundError, OrganizerAlreadyJoinedError } from "../../errors";
import * as organizer from "../../providers/organizerProvider";
import * as coachProvider from "../../providers/coachProvider";
import roundRoutes from "./organizerRoundRoutes";
import { uuidRegex } from "../../authUtils";
import { transferOwnership } from "../../providers/coachProvider";
import { TournamentRequest } from "../../types/express";
import { tournamentHandler, scorerHandler, organizerHandler, teamHandler } from "../../types/handlers";

const router = Router();

// ── Tournament ────────────────────────────────────────────────────────────────

router.get("/", tournamentHandler(async (req, res) => {
    try {
        return res.status(200).json(await organizer.getTournament(req.tournament));
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
}));

router.patch("/", tournamentHandler(async (req, res) => {
    const { tournament: t } = req.body as { tournament: TournamentPayload['tournament'] };
    if (!t) return res.status(400).json({ message: 'Missing tournament in body' });
    try {
        await organizer.updateTournamentDetails(req.tournament, t);
        return res.status(200).json({ success: true });
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to update tournament' });
        throw e;
    }
}));

// ── Format & Witnesses ────────────────────────────────────────────────────────

router.get("/format", tournamentHandler(async (req, res) => {
    try {
        return res.status(200).json(await organizer.getFormat(req.tournament));
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
}));

router.patch("/format", tournamentHandler(async (req, res) => {
    const format = req.body as TournamentPayload['caseFormat'];
    if ((format.pWitnessesCalled != null && format.pWitnessesCalled < 0) ||
        (format.dWitnessesCalled != null && format.dWitnessesCalled < 0))
        return res.status(400).json({ message: 'Witnesses called cannot be negative' });
    if (format.pWitnessesCalled != null || format.dWitnessesCalled != null) {
        try {
            const witnesses = await organizer.getWitnesses(req.tournament);
            const swing = witnesses.swingWitnessNames.length;
            if (format.pWitnessesCalled != null && witnesses.pWitnessNames.length + swing > 0 &&
                format.pWitnessesCalled > witnesses.pWitnessNames.length + swing)
                return res.status(400).json({ message: 'P witnesses called exceeds available witnesses' });
            if (format.dWitnessesCalled != null && witnesses.dWitnessNames.length + swing > 0 &&
                format.dWitnessesCalled > witnesses.dWitnessNames.length + swing)
                return res.status(400).json({ message: 'D witnesses called exceeds available witnesses' });
        } catch (e) {
            if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
            throw e;
        }
    }
    try {
        await organizer.updateFormat(req.tournament, format);
        return res.status(200).json({ success: true });
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to update format' });
        throw e;
    }
}));

router.get("/witnesses", tournamentHandler(async (req, res) => {
    try {
        return res.status(200).json(await organizer.getWitnesses(req.tournament));
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
}));

router.patch("/witnesses", tournamentHandler(async (req, res) => {
    const witnesses = req.body as IWitnesses;
    const allNames = [...witnesses.pWitnessNames, ...witnesses.dWitnessNames, ...witnesses.swingWitnessNames];
    if (allNames.some(n => !n?.trim())) return res.status(400).json({ message: 'Witness names cannot be empty' });
    try {
        await organizer.updateWitnesses(req.tournament, witnesses);
        return res.status(200).json({ success: true });
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to update witnesses' });
        throw e;
    }
}));

// ── Standings Config ──────────────────────────────────────────────────────────

router.get("/standings-config", tournamentHandler(async (req, res) => {
    try {
        return res.status(200).json((await organizer.getStandingsConfig(req.tournament)) ?? null);
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
}));

router.patch("/standings-config", tournamentHandler(async (req, res) => {
    const { statsXml, standingsXml } = req.body as { statsXml: string; standingsXml: string };
    if (!statsXml || !standingsXml) return res.status(400).json({ message: 'Missing statsXml or standingsXml' });
    try {
        await organizer.upsertStandingsConfig(req.tournament, statsXml, standingsXml);
        return res.status(200).json({ success: true });
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to update standings config' });
        throw e;
    }
}));

// ── Scoring Categories ────────────────────────────────────────────────────────

router.get("/scoring-categories", tournamentHandler(async (req, res) => {
    return res.status(200).json(await organizer.getScoringCategories(req.tournament));
}));

router.patch("/scoring-categories", tournamentHandler(async (req, res) => {
    try {
        await organizer.updateScoringCategories(req.tournament, req.body as TournamentPayload['scoringCategories']);
        return res.status(200).json({ success: true });
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to update scoring categories' });
        throw e;
    }
}));

// ── Scorers ───────────────────────────────────────────────────────────────────

router.get("/scorers", tournamentHandler(async (req, res) => {
    try {
        return res.status(200).json(await organizer.getScorers(req.tournament));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to reach backend' });
        throw e;
    }
}));

function verifyScorer(req: Request, res: Response, next: NextFunction) {
    const scorer: IScorer = req.body;
    if (!scorer?.email || !scorer?.first_name || !scorer?.last_name || !scorer?.scorer_id)
        return res.status(409).json({ message: 'Missing required field(s)' });
    req.scorer = scorer;
    next();
}

router.post("/scorers", verifyScorer, scorerHandler(async (req, res) => {
    try {
        await organizer.addScorer(req.scorer, req.tournament);
        return res.status(200).json(req.scorer);
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to communicate with database' });
        throw e;
    }
}));

router.put("/scorers", verifyScorer, scorerHandler(async (req, res) => {
    try {
        await organizer.updateScorer(req.scorer, req.tournament);
        return res.status(200).json(req.scorer);
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to communicate with database' });
        throw e;
    }
}));

router.delete("/scorers", tournamentHandler(async (req, res) => {
    const { scorer_id } = req.body;
    if (!scorer_id) return res.status(400).json({ message: 'Did not provide a scorer_id' });
    try {
        await organizer.deleteScorer(scorer_id);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to delete scorer' });
        throw e;
    }
}));

router.get('/scorer-conflicts', tournamentHandler(async (req, res) => {
    try {
        return res.status(200).json(await organizer.getAllConflicts(req.tournament));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
}));

router.get('/scorers/:scorerId/conflicts', async (req: Request, res: Response) => {
    const scorerId = req.params.scorerId as string;
    if (!uuidRegex.test(scorerId)) return res.status(400).json({ message: 'Invalid scorer ID' });
    try {
        return res.status(200).json(await organizer.getConflicts(scorerId));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
});

router.post('/scorers/:scorerId/conflicts', async (req: Request, res: Response) => {
    const scorerId = req.params.scorerId as string;
    const { team_id } = req.body;
    if (!uuidRegex.test(scorerId) || !uuidRegex.test(team_id)) return res.status(400).json({ message: 'Invalid ID' });
    try {
        return res.status(201).json(await organizer.addConflict(scorerId, team_id));
    } catch (e) {
        if (e instanceof AlreadyExistsError) return res.status(409).json({ message: 'Conflict already exists' });
        throw e;
    }
});

router.delete('/scorers/:scorerId/conflicts', async (req: Request, res: Response) => {
    const scorerId = req.params.scorerId as string;
    const { team_id } = req.body;
    if (!uuidRegex.test(scorerId) || !uuidRegex.test(team_id)) return res.status(400).json({ message: 'Invalid ID' });
    try {
        await organizer.removeConflict(scorerId, team_id);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
});

// ── Organizers ────────────────────────────────────────────────────────────────

router.get("/organizers", tournamentHandler(async (req, res) => {
    try {
        return res.status(200).json(await organizer.getOrganizers(req.tournament));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
}));

async function verifyOrganizerPayload(req: Request, res: Response, next: NextFunction) {
    const { organizer: org } = req.body;
    if (!org) return res.status(400).json({ message: 'No organizer in body' });
    const o: IOrganizer = org;
    if (!o.name || !o.email || !o.role) return res.status(400).json({ message: 'Missing required fields' });
    req.selectedOrganizer = o;
    next();
}

router.post("/organizers", verifyOrganizerPayload, organizerHandler(async (req, res) => {
    try {
        return res.status(201).json(await organizer.addOrganizer(req.tournament, req.selectedOrganizer.name, req.selectedOrganizer.email, req.selectedOrganizer.role));
    } catch (e) {
        if (e instanceof AlreadyExistsError) return res.status(409).json({ message: 'Email is already a delegate' });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to speak to database' });
        throw e;
    }
}));

router.put("/organizers", verifyOrganizerPayload, organizerHandler(async (req, res) => {
    if (!req.selectedOrganizer.id) return res.status(400).json({ message: 'Missing id field' });
    if (!uuidRegex.test(req.selectedOrganizer.id)) return res.status(400).json({ message: 'Invalid organizer ID' });
    try {
        return res.status(200).json(await organizer.updateOrganizer(req.selectedOrganizer));
    } catch (e) {
        if (e instanceof OrganizerAlreadyJoinedError) return res.status(409).json({ message: 'Organizer has already joined' });
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
}));

router.delete("/organizers", verifyOrganizerPayload, organizerHandler(async (req, res) => {
    if (!req.selectedOrganizer.id) return res.status(400).json({ message: 'Missing id field in body' });
    if (!uuidRegex.test(req.selectedOrganizer.id)) return res.status(400).json({ message: 'Invalid organizer ID' });
    try {
        await organizer.deleteOrganizer(req.selectedOrganizer);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
}));

// ── Courtrooms ────────────────────────────────────────────────────────────────

router.get('/courtrooms', tournamentHandler(async (req, res) => {
    try {
        return res.status(200).json(await organizer.getCourtrooms(req.tournament));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to get courtrooms' });
        throw e;
    }
}));

router.post('/courtrooms', tournamentHandler(async (req, res) => {
    if (!req.body?.name) return res.status(400).json({ message: 'Missing name' });
    try {
        return res.status(201).json(await organizer.addCourtroom(req.tournament, req.body));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to add courtroom' });
        throw e;
    }
}));

router.put('/courtrooms', async (req: Request, res: Response) => {
    if (!req.body?.id || !req.body?.name) return res.status(400).json({ message: 'Missing id or name' });
    try {
        return res.status(200).json(await organizer.updateCourtroom(req.body));
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
});

router.delete('/courtrooms', async (req: Request, res: Response) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ message: 'Missing id' });
    try {
        await organizer.deleteCourtroom(id);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
});

// ── Teams ─────────────────────────────────────────────────────────────────────

router.get('/teams', tournamentHandler(async (req, res) => {
    return res.status(200).json(await organizer.getTeams(req.tournament));
}));

function verifyTeamPayload(req: Request, res: Response, next: NextFunction) {
    const { team } = req.body;
    if (!team) return res.status(400).json({ message: 'No team in body' });
    const t: ITeam = team;
    if (!t.name || !t.coach_email) return res.status(400).json({ message: 'Missing required fields' });
    req.selectedTeam = t;
    next();
}

router.post('/teams', verifyTeamPayload, teamHandler(async (req, res) => {
    const { name, coach_email, code } = req.selectedTeam;
    if (await organizer.teamNameExists(req.tournament, name)) return res.status(409).json({ message: 'A team with that name already exists' });
    try {
        return res.status(201).json(await organizer.addTeam(req.tournament, name, coach_email, code || name));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to add team' });
        throw e;
    }
}));

router.put('/teams', verifyTeamPayload, teamHandler(async (req, res) => {
    const { id, name, coach_email, code } = req.selectedTeam;
    if (!id) return res.status(400).json({ message: 'Missing id field' });
    if (!uuidRegex.test(id)) return res.status(400).json({ message: 'Invalid team ID' });
    if (await organizer.teamNameExists(req.tournament, name, id))
        return res.status(409).json({ message: 'A team with that name already exists' });
    try {
        return res.status(200).json(await organizer.updateTeam(id, name, coach_email, code || name));
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to update team' });
        throw e;
    }
}));

router.delete('/teams', async (req: Request, res: Response) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ message: 'Missing id' });
    if (!uuidRegex.test(id)) return res.status(400).json({ message: 'Invalid team ID' });
    try {
        await organizer.deleteTeam(id);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
});

router.put('/teams/:teamId/owner', async (req: Request, res: Response) => {
    const teamId = req.params.teamId as string;
    if (!uuidRegex.test(teamId)) return res.status(400).json({ message: 'Invalid team ID' });
    const { coachId } = req.body as { coachId?: string };
    if (!coachId || !uuidRegex.test(coachId)) return res.status(400).json({ message: 'Missing or invalid coachId' });
    try {
        await transferOwnership(teamId, coachId);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
});

// ── Organizer view of team roster (delegates to coachProvider) ────────────────

router.get('/teams/:teamId/coaches', async (req: Request, res: Response) => {
    return res.status(200).json(await coachProvider.getCoaches(req.params.teamId as string));
});

router.post('/teams/:teamId/coaches', async (req: Request, res: Response) => {
    const { email } = req.body as { email?: string };
    if (!email) return res.status(400).json({ message: 'Missing email' });
    return res.status(201).json(await coachProvider.addCoach(req.params.teamId as string, email));
});

router.delete('/teams/:teamId/coaches/:coachId', async (req: Request, res: Response) => {
    try {
        await coachProvider.removeCoach(req.params.teamId as string, req.params.coachId as string);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
});

router.get('/teams/:teamId/students', async (req: Request, res: Response) => {
    return res.status(200).json(await coachProvider.getStudents(req.params.teamId as string));
});

router.post('/teams/:teamId/students', async (req: Request, res: Response) => {
    const { student_name, pronouns } = req.body as { student_name?: string; pronouns?: string };
    if (!student_name?.trim()) return res.status(400).json({ message: 'Missing student_name' });
    try {
        return res.status(201).json(await coachProvider.addStudent(req.params.teamId as string, student_name.trim(), pronouns ?? null));
    } catch (e) {
        if (e instanceof AlreadyExistsError) return res.status(409).json({ message: 'Student already on roster' });
        throw e;
    }
});

router.delete('/teams/:teamId/students/:studentId', async (req: Request, res: Response) => {
    try {
        await coachProvider.removeStudent(req.params.studentId as string);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
});

router.get('/teams/:teamId/pairings/:pairingId/witness-order', async (req: Request, res: Response) => {
    return res.status(200).json(await coachProvider.getWitnessCallOrder(req.params.pairingId as string, req.params.teamId as string));
});

router.put('/teams/:teamId/pairings/:pairingId/witness-order', async (req: Request, res: Response) => {
    const { witness_ids } = req.body as { witness_ids?: string[] };
    if (!Array.isArray(witness_ids)) return res.status(400).json({ message: 'witness_ids must be an array' });
    await coachProvider.setWitnessCallOrder(req.params.pairingId as string, req.params.teamId as string, witness_ids);
    return res.status(200).json({ success: true });
});

router.get('/teams/:teamId/pairings/:pairingId/assignments', async (req: Request, res: Response) => {
    return res.status(200).json(await coachProvider.getStudentAssignments(req.params.pairingId as string, req.params.teamId as string));
});

router.put('/teams/:teamId/pairings/:pairingId/assignments', async (req: Request, res: Response) => {
    const { field_id, student_id } = req.body as { field_id?: string; student_id?: string };
    if (!field_id || !student_id) return res.status(400).json({ message: 'Missing field_id or student_id' });
    try {
        return res.status(200).json(await coachProvider.upsertStudentAssignment(req.params.pairingId as string, req.params.teamId as string, field_id, student_id));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to save assignment' });
        throw e;
    }
});

// ── Rounds ────────────────────────────────────────────────────────────────────

router.get("/rounds", tournamentHandler(async (req, res) => {
    try {
        return res.status(200).json(await organizer.getRounds(req.tournament));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Database error' });
        throw e;
    }
}));

router.post("/rounds", tournamentHandler(async (req, res) => {
    try {
        const newRound = await organizer.createRound(req.tournament);
        const out: IRound = { ...newRound, round_time: newRound.round_time?.toISOString() ?? null };
        return res.status(201).json(out);
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to create round' });
        throw e;
    }
}));

async function verifyRound(req: Request, res: Response, next: NextFunction) {
    const { tournament } = req as TournamentRequest;
    const { round } = req.params;
    if (!round) return res.status(400).json({ message: 'No round id provided' });
    const roundID = Array.isArray(round) ? round[0] : round;
    if (!uuidRegex.test(roundID)) return res.status(400).json({ message: 'Invalid UUID' });
    try {
        const r = await organizer.getRound(tournament, roundID);
        req.round = { ...r, round_time: r.round_time == null ? null : r.round_time.toISOString() };
        next();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: 'No round found' });
        throw e;
    }
}

router.use('/rounds/:round', verifyRound, roundRoutes);

export default router;
