import {NextFunction, Request, Response, Router} from "express";
import {IRound, TournamentPayload, IWitnesses} from "@mock-scores/shared";
import {DuplicateDelegateError, OrganizerAlreadyJoinedError, NotFoundError} from "../../errors";
import {OrganizerProvider} from "../../providers/organizerProvider";
import type {IOrganizer, IScorer, ITeam} from "@mock-scores/shared"
import roundRoutes from "./organizerRoundRoutes";
import {uuidRegex} from "../../authUtils";
import { transferOwnership } from "../../providers/coachProvider";

const router = Router();
const organizerProvider = new OrganizerProvider();

router.get("/", async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const tournament = await organizerProvider.getTournament(req.tournament)
    if (!tournament) return res.status(404).json({ message: 'No tournament found' });
    return res.status(200).json(tournament);
})

router.patch("/", async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const { tournament: t } = req.body as { tournament: TournamentPayload['tournament'] };
    if (!t) return res.status(400).json({ message: 'Missing tournament in body' });
    const ok = await organizerProvider.updateTournamentDetails(req.tournament, t);
    if (!ok) return res.status(500).json({ message: 'Unable to update tournament' });
    return res.status(200).json({ success: true });
})

router.get("/format", async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const format = await organizerProvider.getFormat(req.tournament)
    if (!format) return res.status(404).json({ message: 'Format not found' });
    return res.status(200).json(format);
})

router.patch("/format", async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const format = req.body as TournamentPayload['caseFormat'];
    if ((format.pWitnessesCalled != null && format.pWitnessesCalled < 0) ||
        (format.dWitnessesCalled != null && format.dWitnessesCalled < 0)) {
        return res.status(400).json({ message: 'Witnesses called cannot be negative' });
    }
    if (format.pWitnessesCalled != null || format.dWitnessesCalled != null) {
        const witnesses = await organizerProvider.getWitnesses(req.tournament);
        if (witnesses) {
            const swing = witnesses.swingWitnessNames.length;
            if (format.pWitnessesCalled != null && witnesses.pWitnessNames.length + swing > 0 &&
                format.pWitnessesCalled > witnesses.pWitnessNames.length + swing)
                return res.status(400).json({ message: 'P witnesses called exceeds available witnesses' });
            if (format.dWitnessesCalled != null && witnesses.dWitnessNames.length + swing > 0 &&
                format.dWitnessesCalled > witnesses.dWitnessNames.length + swing)
                return res.status(400).json({ message: 'D witnesses called exceeds available witnesses' });
        }
    }
    const ok = await organizerProvider.updateFormat(req.tournament, format)
    if (!ok) return res.status(500).json({ message: 'Unable to update format' });
    return res.status(200).json({ success: true });
})

router.get("/witnesses", async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const witnesses = await organizerProvider.getWitnesses(req.tournament)
    if (!witnesses) return res.status(404).json({ message: 'Witnesses not found' });
    return res.status(200).json(witnesses);
})

router.patch("/witnesses", async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const witnesses = req.body as IWitnesses;
    const allNames = [...witnesses.pWitnessNames, ...witnesses.dWitnessNames, ...witnesses.swingWitnessNames];
    if (allNames.some(n => !n?.trim())) return res.status(400).json({ message: 'Witness names cannot be empty' });
    const ok = await organizerProvider.updateWitnesses(req.tournament, witnesses)
    if (!ok) return res.status(500).json({ message: 'Unable to update witnesses' });
    return res.status(200).json({ success: true });
})

router.get("/standings-config", async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const config = await organizerProvider.getStandingsConfig(req.tournament);
    return res.status(200).json(config ?? null);
})

router.patch("/standings-config", async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const { statsXml, standingsXml } = req.body as { statsXml: string; standingsXml: string };
    if (!statsXml || !standingsXml) return res.status(400).json({ message: 'Missing statsXml or standingsXml' });
    const ok = await organizerProvider.upsertStandingsConfig(req.tournament, statsXml, standingsXml);
    if (!ok) return res.status(500).json({ message: 'Unable to update standings config' });
    return res.status(200).json({ success: true });
})

router.get("/scoring-categories", async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const categories = await organizerProvider.getScoringCategories(req.tournament)
    return res.status(200).json(categories);
})

router.patch("/scoring-categories", async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const ok = await organizerProvider.updateScoringCategories(req.tournament, req.body as TournamentPayload['scoringCategories'])
    if (!ok) return res.status(500).json({ message: 'Unable to update scoring categories' });
    return res.status(200).json({ success: true });
})


router.get("/scorers", async (req: Request, res: Response) => {

    if(!req?.tournament) {
        return res.status(403).json({ message: 'No access to tournament' });
    }


    const scorers = await organizerProvider.getScorers(req.tournament);


    if(!scorers) return res.status(500).json({ message: 'Unable to reach backend' });

    return res.status(200).json(scorers);

})

function verifyScorer(req: Request, res: Response, next : NextFunction) {
    if(!req?.tournament) {
        return res.status(403).json({ message: 'No access to tournament' });
    }
    const scorer : IScorer = req.body

    if(!scorer?.email || !scorer?.first_name || !scorer?.last_name || !scorer?.scorer_id) {
        return res.status(409).json({ message: 'Missing required field(s)' });
    }
    req.scorer = scorer;
    next();
}

router.post("/scorers", verifyScorer, async (req: Request, res: Response) => {
    if (!req?.scorer){
        return res.status(400).json({ message: 'Unable to get scorer' });
    }
    if (!req.tournament) {
        return res.status(400).json({ message: 'Unable to parse tournament' });

    }
    const result = await organizerProvider.addScorer(req.scorer, req.tournament);

    if (!result) {
        return res.status(500).json({ message: 'Unable to communicate with database' });
    }

    return res.status(200).json(req.scorer);
});

router.put("/scorers", verifyScorer, async (req: Request, res: Response) => {
    if (!req?.scorer){
        return res.status(400).json({ message: 'Unable to get scorer' });
    }
    if(!req?.tournament){
        return res.status(400).json({ message: 'Unable to get tournament' });
    }


    const result = await organizerProvider.updateScorer(req.scorer, req.tournament );

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

    const result = await organizerProvider.deleteScorer(scorer_id);
    if (!result) {
        return res.status(500).json({ message: 'Unable to delete scorer' });
    }
    return res.status(204).send();
});

router.get('/scorer-conflicts', async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const conflicts = await organizerProvider.getAllConflicts(req.tournament);
    return res.status(200).json(conflicts);
});

router.get('/scorers/:scorerId/conflicts', async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const scorerId = req.params.scorerId as string;
    if (!uuidRegex.test(scorerId)) return res.status(400).json({ message: 'Invalid scorer ID' });
    const conflicts = await organizerProvider.getConflicts(scorerId);
    return res.status(200).json(conflicts);
});

router.post('/scorers/:scorerId/conflicts', async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const scorerId = req.params.scorerId as string;
    const { team_id } = req.body;
    if (!uuidRegex.test(scorerId) || !uuidRegex.test(team_id)) return res.status(400).json({ message: 'Invalid ID' });
    const result = await organizerProvider.addConflict(scorerId, team_id);
    if (!result) return res.status(409).json({ message: 'Conflict already exists' });
    return res.status(201).json(result);
});

router.delete('/scorers/:scorerId/conflicts', async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const scorerId = req.params.scorerId as string;
    const { team_id } = req.body;
    if (!uuidRegex.test(scorerId) || !uuidRegex.test(team_id)) return res.status(400).json({ message: 'Invalid ID' });
    const ok = await organizerProvider.removeConflict(scorerId, team_id);
    if (!ok) return res.status(404).json({ message: 'Conflict not found' });
    return res.status(204).send();
});






router.get("/organizers", async (req: Request, res: Response) => {
    if(!req?.tournament) {
        return res.status(403).json({ message: 'No access to tournament' });
    }
    const organizers = await organizerProvider.getOrganizers(req.tournament)
    return res.status(200).json(organizers);
});


async function verifyOrganizerPayload(req: Request, res: Response, next: NextFunction) {
    if(!req?.tournament) {
        return res.status(403).json({ message: 'No access to tournament' });
    }
    const {organizer} = req.body

    if (!organizer){
        return res.status(400).json({ message: 'No organizer in body' });
    }
    const org : IOrganizer = organizer

    if (!org.name || !org.email || !org.role){
        return res.status(400).json({ message: 'Missing required fields' });
    }

    req.selectedOrganizer = org

    next()
}

router.post("/organizers", verifyOrganizerPayload, async (req: Request, res: Response) => {
    if (!req?.selectedOrganizer) {
        return res.status(400).json({ message: 'Missing required fields' });
    }
    if (!req?.tournament) {
        return res.status(404).json({ message: 'How did you even get here?' });
    }

    const org : IOrganizer =  req.selectedOrganizer

    let createdOrganizer;
    try {
        createdOrganizer = await organizerProvider.addOrganizer(req.tournament, org.name, org.email, org.role)
    } catch (e) {
        if (e instanceof DuplicateDelegateError) return res.status(409).json({ message: 'Email is already a delegate' });
        throw e;
    }

    if (!createdOrganizer){
        return res.status(500).json({ message: 'Unable to speak to database' });
    }

    return res.status(201).json(createdOrganizer);
});

router.put("/organizers", verifyOrganizerPayload, async (req: Request, res: Response) => {
    if (!req?.selectedOrganizer) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const org : IOrganizer =  req.selectedOrganizer

    if (!org.id){
        return res.status(400).json({ message: 'Missing id field' });
    }

    if(!uuidRegex.test(org.id)){
        return res.status(400).json({ message: 'Invalid organizer ID' });
    }

    const result = await organizerProvider.updateOrganizer(org).catch(e => {
        if (e instanceof OrganizerAlreadyJoinedError) return res.status(409).json({ message: 'Organizer has already joined' });
        throw e;
    });

    if(!result){
        return res.status(500).json({ message: 'Unable to update organizer' });
    }
    return res.status(201).json(result);
})

router.delete("/organizers", verifyOrganizerPayload, async (req: Request, res: Response) => {
    if (!req?.selectedOrganizer) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const org : IOrganizer =  req.selectedOrganizer

    if (!org.id){
        return res.status(400).json({ message: 'Missing id field in body' });
    }

    if(!uuidRegex.test(org.id)){
        return res.status(400).json({ message: 'Invalid organizer ID' });
    }

    const result = await organizerProvider.deleteOrganizer(org)

    if(!result){
        return res.status(500).json({ message: 'Unable to delete organizer' });
    }
    return res.status(204).json(result);
})

router.get('/courtrooms', async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(400).json({ message: 'Invalid tournament' });
    const result = await organizerProvider.getCourtrooms(req.tournament)
    if (!result) return res.status(500).json({ message: 'Unable to get courtrooms' });
    return res.status(200).json(result);
})

router.post('/courtrooms', async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const courtroom = req.body
    if (!courtroom?.name) return res.status(400).json({ message: 'Missing name' });
    const result = await organizerProvider.addCourtroom(req.tournament, courtroom)
    if (!result) return res.status(500).json({ message: 'Unable to add courtroom' });
    return res.status(201).json(result);
})

router.put('/courtrooms', async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const courtroom = req.body
    if (!courtroom?.id || !courtroom?.name) return res.status(400).json({ message: 'Missing id or name' });
    const result = await organizerProvider.updateCourtroom(courtroom)
    if (!result) return res.status(500).json({ message: 'Unable to update courtroom' });
    return res.status(200).json(result);
})

router.delete('/courtrooms', async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const { id } = req.body
    if (!id) return res.status(400).json({ message: 'Missing id' });
    const result = await organizerProvider.deleteCourtroom(id)
    if (!result) return res.status(500).json({ message: 'Unable to delete courtroom' });
    return res.status(204).send();
})



async function verifyRound(req: Request, res: Response, next : NextFunction) {
    if(!req?.tournament) {
        return res.status(403).json({ message: 'No access to tournament' });
    }

    const {round} = req.params
    if(!round){
        return res.status(400).json({ message: 'No round id provided' });
    }

    const roundID = Array.isArray(round) ? round[0] : round;

    if(!uuidRegex.test(roundID)){
        return res.status(400).json({ message: 'Invalid UUID' });
    }

    const result : IRound | null = await organizerProvider.getRound(req.tournament, roundID).then(round => {
        if(!round){
            return null
        }
        return {...round, round_time: round.round_time == null ? null : round.round_time.toISOString()};
    })
    if (!result){
        return res.status(404).json({ message: 'No round found' });
    }

    req.round = result;

    next();

}


router.get('/teams', async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const teams = await organizerProvider.getTeams(req.tournament);
    return res.status(200).json(teams);
});

function verifyTeamPayload(req: Request, res: Response, next: NextFunction) {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const { team } = req.body;
    if (!team) return res.status(400).json({ message: 'No team in body' });
    const t: ITeam = team;
    if (!t.name || !t.coach_email) return res.status(400).json({ message: 'Missing required fields' });
    req.selectedTeam = t;
    next();
}

router.post('/teams', verifyTeamPayload, async (req: Request, res: Response) => {
    if (!req.selectedTeam || !req.tournament) return res.status(400).json({ message: 'Missing required fields' });
    const { name, coach_email, code } = req.selectedTeam;
    if (await organizerProvider.teamNameExists(req.tournament, name)) return res.status(409).json({ message: 'A team with that name already exists' });
    const result = await organizerProvider.addTeam(req.tournament, name, coach_email, code || name);
    if (!result) return res.status(500).json({ message: 'Unable to add team' });
    return res.status(201).json(result);
});

router.put('/teams', verifyTeamPayload, async (req: Request, res: Response) => {
    if (!req.selectedTeam) return res.status(400).json({ message: 'Missing required fields' });
    const { id, name, coach_email, code } = req.selectedTeam;
    if (!id) return res.status(400).json({ message: 'Missing id field' });
    if (!uuidRegex.test(id)) return res.status(400).json({ message: 'Invalid team ID' });
    if (req.tournament && await organizerProvider.teamNameExists(req.tournament, name, id)) return res.status(409).json({ message: 'A team with that name already exists' });
    const result = await organizerProvider.updateTeam(id, name, coach_email, code || name).catch(e => {
        if (e instanceof NotFoundError) return res.status(404).json({ message: 'Team not found' });
        throw e;
    });
    if (!result) return res.status(500).json({ message: 'Unable to update team' });
    return res.status(200).json(result);
});

router.delete('/teams', async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const { id } = req.body;
    if (!id) return res.status(400).json({ message: 'Missing id' });
    if (!uuidRegex.test(id)) return res.status(400).json({ message: 'Invalid team ID' });
    const result = await organizerProvider.deleteTeam(id);
    if (!result) return res.status(500).json({ message: 'Unable to delete team' });
    return res.status(204).send();
});

router.put('/teams/:teamId/owner', async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const teamId = req.params.teamId as string;
    if (!uuidRegex.test(teamId)) return res.status(400).json({ message: 'Invalid team ID' });
    const { coachId } = req.body as { coachId?: string };
    if (!coachId || !uuidRegex.test(coachId)) return res.status(400).json({ message: 'Missing or invalid coachId' });
    const ok = await transferOwnership(teamId, coachId);
    if (!ok) return res.status(404).json({ message: 'Coach not found on this team' });
    return res.status(204).send();
});


router.get("/rounds", async (req: Request, res: Response) => {
    if(!req?.tournament) {
        return res.status(403).json({ message: 'No access to tournament' });
    }
    const rounds = await organizerProvider.getRounds(req.tournament)
    return res.status(200).json(rounds);
});



router.post("/rounds", async (req: Request, res: Response) => {
    if(!req?.tournament) {
        return res.status(403).json({ message: 'No access to tournament' });
    }
    const newRound = await organizerProvider.createRound(req.tournament)

    if (!newRound) {
        return res.status(400).json({message: "Unable to create round"});
    }

    const out : IRound = {...newRound, round_time : newRound.round_time?.toISOString() ?? null}

    return res.status(201).json(out);
});

router.use('/rounds/:round', verifyRound,  roundRoutes)



// ── Organizer view of team management (mirrors coach team routes) ─────────────
import * as coachProvider from '../../providers/coachProvider';

router.get('/teams/:teamId/coaches', async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    return res.status(200).json(await coachProvider.getCoaches(req.params.teamId as string));
});

router.post('/teams/:teamId/coaches', async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const { email } = req.body as { email?: string };
    if (!email) return res.status(400).json({ message: 'Missing email' });
    return res.status(201).json(await coachProvider.addCoach(req.params.teamId as string, email));
});

router.delete('/teams/:teamId/coaches/:coachId', async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const ok = await coachProvider.removeCoach(req.params.teamId as string, req.params.coachId as string);
    if (!ok) return res.status(404).json({ message: 'Coach not found or is team owner' });
    return res.status(204).send();
});

router.get('/teams/:teamId/students', async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    return res.status(200).json(await coachProvider.getStudents(req.params.teamId as string));
});

router.post('/teams/:teamId/students', async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const { student_name, pronouns } = req.body as { student_name?: string; pronouns?: string };
    if (!student_name?.trim()) return res.status(400).json({ message: 'Missing student_name' });
    const result = await coachProvider.addStudent(req.params.teamId as string, student_name.trim(), pronouns ?? null);
    if (!result) return res.status(409).json({ message: 'Student already on roster' });
    return res.status(201).json(result);
});

router.delete('/teams/:teamId/students/:studentId', async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const ok = await coachProvider.removeStudent(req.params.studentId as string);
    if (!ok) return res.status(404).json({ message: 'Student not found' });
    return res.status(204).send();
});

router.get('/teams/:teamId/pairings/:pairingId/witness-order', async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    return res.status(200).json(await coachProvider.getWitnessCallOrder(req.params.pairingId as string, req.params.teamId as string));
});

router.put('/teams/:teamId/pairings/:pairingId/witness-order', async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const { witness_ids } = req.body as { witness_ids?: string[] };
    if (!Array.isArray(witness_ids)) return res.status(400).json({ message: 'witness_ids must be an array' });
    await coachProvider.setWitnessCallOrder(req.params.pairingId as string, req.params.teamId as string, witness_ids);
    return res.status(200).json({ success: true });
});

router.get('/teams/:teamId/pairings/:pairingId/assignments', async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    return res.status(200).json(await coachProvider.getStudentAssignments(req.params.pairingId as string, req.params.teamId as string));
});

router.put('/teams/:teamId/pairings/:pairingId/assignments', async (req: Request, res: Response) => {
    if (!req?.tournament) return res.status(403).json({ message: 'No access to tournament' });
    const { field_id, student_id } = req.body as { field_id?: string; student_id?: string };
    if (!field_id || !student_id) return res.status(400).json({ message: 'Missing field_id or student_id' });
    const result = await coachProvider.upsertStudentAssignment(req.params.pairingId as string, req.params.teamId as string, field_id, student_id);
    if (!result) return res.status(500).json({ message: 'Unable to save assignment' });
    return res.status(200).json(result);
});

export default router;