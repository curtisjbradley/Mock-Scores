import request from 'supertest';
import app from '../../src/appService';
import { dbQuery } from '../../src/db';
import { signToken } from '../../src/authUtils';
import {
    getAllTournaments, getSchedule, getResults, getCoaches, addCoach,
    removeCoach, getStudents, removeStudent, getWitnessCallOrder,
    setWitnessCallOrder, getStudentAssignments, upsertStudentAssignment,
    getCompetitionField, getStandingsData,
    getWitnessesForTournament, getFormatForTournament,
} from '../../src/providers/coachProvider';

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;

const TID  = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TEAM = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const UID  = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
const PID  = 'd4e5f6a7-b8c9-0123-defa-234567890123';
const SID  = 'e5f6a7b8-c9d0-1234-efab-345678901234';
const FID  = 'f6a7b8c9-d0e1-2345-fabc-456789012345';

let token: string;
beforeAll(async () => { token = await signToken('user-1', 't@t.com', 'T', 'U'); });
beforeEach(() => jest.clearAllMocks());

const auth = () => ({ Authorization: `Bearer ${token}` });
const mockTeamAccess = () =>
    mockDbQuery.mockResolvedValueOnce({ rows: [{ coach_id: 'user-1' }], rowCount: 1 } as any);

// ─── coachProvider ────────────────────────────────────────────────────────────
describe('getAllTournaments', () => {
    it('returns rows', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: TID }], rowCount: 1 } as any);
        expect(await getAllTournaments('u1')).toEqual([{ id: TID }]);
    });
    it('returns [] on null', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        expect(await getAllTournaments('u1')).toEqual([]);
    });
});

describe('getSchedule', () => {
    it('returns rounds with pairings', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ round_id: 'r1', name: 'R1', round_time: null }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [{ pairing_id: PID }], rowCount: 1 } as any);
        const result = await getSchedule(TID);
        expect(result[0].round_id).toBe('r1');
        expect(result[0].pairings[0].pairing_id).toBe(PID);
    });
    it('returns [] when no rounds', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await getSchedule(TID)).toEqual([]);
    });
});

describe('getResults', () => {
    it('returns rounds with pairings', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ round_id: 'r1', name: 'R1', round_time: null }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [{ pairing_id: PID, p_points: 10, d_points: 8 }], rowCount: 1 } as any);
        const result = await getResults(TID);
        expect(result[0].pairings[0].p_points).toBe(10);
    });
    it('returns [] when no rounds', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await getResults(TID)).toEqual([]);
    });
});

describe('getCoaches', () => {
    it('returns joined and invited coaches', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ coach_id: UID, name: 'Alice', email: 'a@b.com', is_owner: true, has_joined: true }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [{ coach_id: 'inv1', name: 'b@c.com', email: 'b@c.com', is_owner: false, has_joined: false }], rowCount: 1 } as any);
        const result = await getCoaches(TEAM);
        expect(result).toHaveLength(2);
    });
});

describe('addCoach', () => {
    it('adds existing user directly', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ user_id: UID, first_name: 'Alice', last_name: 'Smith', email: 'a@b.com' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const result = await addCoach(TEAM, 'a@b.com');
        expect(result.has_joined).toBe(true);
        expect(result.email).toBe('a@b.com');
    });
    it('creates invite for unknown email', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [{ id: 'inv1' }], rowCount: 1 } as any);
        const result = await addCoach(TEAM, 'new@b.com');
        expect(result.has_joined).toBe(false);
        expect(result.coach_id).toBe('inv1');
    });
});

describe('removeCoach', () => {
    it('removes registered coach', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        expect(await removeCoach(TEAM, UID)).toBe(true);
    });
    it('falls back to invite removal', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        expect(await removeCoach(TEAM, 'inv1')).toBe(true);
    });
    it('returns false when not found', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await removeCoach(TEAM, 'nobody')).toBe(false);
    });
});

describe('getStudents', () => {
    it('returns students', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ student_id: SID, student_name: 'Bob', pronouns: 'he/him' }], rowCount: 1 } as any);
        expect(await getStudents(TEAM)).toHaveLength(1);
    });
});

describe('removeStudent', () => {
    it('returns true on success', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        expect(await removeStudent(SID)).toBe(true);
    });
});

describe('getWitnessCallOrder', () => {
    it('returns witness order', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'w1' }], rowCount: 1 } as any);
        expect(await getWitnessCallOrder(PID, TEAM)).toEqual([{ id: 'w1' }]);
    });
});

describe('setWitnessCallOrder', () => {
    it('returns true with empty list (just deletes)', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await setWitnessCallOrder(PID, TEAM, [])).toBe(true);
    });
    it('inserts witnesses', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // DELETE
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // INSERT w1
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // INSERT w2
        expect(await setWitnessCallOrder(PID, TEAM, ['w1', 'w2'])).toBe(true);
    });
});

describe('getStudentAssignments', () => {
    it('returns assignments', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'a1' }], rowCount: 1 } as any);
        expect(await getStudentAssignments(PID, TEAM)).toEqual([{ id: 'a1' }]);
    });
});

describe('upsertStudentAssignment', () => {
    it('returns assignment on success', async () => {
        const assignment = { id: 'a1', pairing_id: PID, team_id: TEAM, field_id: FID, student_id: SID };
        mockDbQuery.mockResolvedValueOnce({ rows: [assignment], rowCount: 1 } as any);
        expect(await upsertStudentAssignment(PID, TEAM, FID, SID)).toEqual(assignment);
    });
    it('returns null on failure', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await upsertStudentAssignment(PID, TEAM, FID, SID)).toBeNull();
    });
});

describe('getCompetitionField', () => {
    it('returns teams', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: TEAM, name: 'Team A', code: 'A' }], rowCount: 1 } as any);
        expect(await getCompetitionField(TID)).toHaveLength(1);
    });
});

describe('getStandingsData', () => {
    it('returns config, teams, and ballots', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ stats_xml: '<s/>', standings_xml: '<st/>' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [{ p_team_id: 't1', d_team_id: 't2', p_points: 5, d_points: 3, pairing_id: PID }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [{ id: TEAM, name: 'Team A', code: 'A' }], rowCount: 1 } as any);
        const result = await getStandingsData(TID);
        expect(result.config).toEqual({ statsXml: '<s/>', standingsXml: '<st/>' });
        expect(result.teams).toHaveLength(1);
        expect(result.ballots).toHaveLength(1);
    });
    it('returns null config when not found', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const result = await getStandingsData(TID);
        expect(result.config).toBeNull();
    });
});

// ─── GET /api/coach/tournaments ───────────────────────────────────────────────
describe('GET /api/coach/tournaments', () => {
    it('returns 401 without token', async () => {
        expect((await request(app).get('/api/coach/tournaments')).status).toBe(401);
    });
    it('returns 200 with tournaments', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: TID }], rowCount: 1 } as any);
        const res = await request(app).get('/api/coach/tournaments').set(auth());
        expect(res.status).toBe(200);
    });
});

describe('GET /api/coach/tournaments/:id/schedule', () => {
    it('returns 400 for invalid id', async () => {
        const res = await request(app).get('/api/coach/tournaments/bad/schedule').set(auth());
        expect(res.status).toBe(400);
    });
    it('returns 200', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/coach/tournaments/${TID}/schedule`).set(auth());
        expect(res.status).toBe(200);
    });
});

describe('GET /api/coach/tournaments/:id/results', () => {
    it('returns 400 for invalid id', async () => {
        const res = await request(app).get('/api/coach/tournaments/bad/results').set(auth());
        expect(res.status).toBe(400);
    });
    it('returns 200', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/coach/tournaments/${TID}/results`).set(auth());
        expect(res.status).toBe(200);
    });
});

describe('GET /api/coach/tournaments/:id/field', () => {
    it('returns 400 for invalid id', async () => {
        const res = await request(app).get('/api/coach/tournaments/bad/field').set(auth());
        expect(res.status).toBe(400);
    });
    it('returns 200', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/coach/tournaments/${TID}/field`).set(auth());
        expect(res.status).toBe(200);
    });
});

describe('GET /api/coach/tournaments/:id/standings', () => {
    it('returns 400 for invalid id', async () => {
        const res = await request(app).get('/api/coach/tournaments/bad/standings').set(auth());
        expect(res.status).toBe(400);
    });
    it('returns 200', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/coach/tournaments/${TID}/standings`).set(auth());
        expect(res.status).toBe(200);
    });
});

// ─── Team routes ──────────────────────────────────────────────────────────────
describe('verifyTeamAccess', () => {
    it('returns 400 for invalid teamId', async () => {
        const res = await request(app).get('/api/coach/teams/bad-id/coaches').set(auth());
        expect(res.status).toBe(400);
    });
    it('returns 403 when not a team member', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/coach/teams/${TEAM}/coaches`).set(auth());
        expect(res.status).toBe(403);
    });
});

describe('GET /api/coach/teams/:teamId/coaches', () => {
    it('returns 200 with coaches', async () => {
        mockTeamAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/coach/teams/${TEAM}/coaches`).set(auth());
        expect(res.status).toBe(200);
    });
});

describe('POST /api/coach/teams/:teamId/coaches', () => {
    it('returns 400 when email missing', async () => {
        mockTeamAccess();
        const res = await request(app).post(`/api/coach/teams/${TEAM}/coaches`).set(auth()).send({});
        expect(res.status).toBe(400);
    });
    it('returns 201 on success', async () => {
        mockTeamAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ user_id: UID, first_name: 'A', last_name: 'B', email: 'a@b.com' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const res = await request(app).post(`/api/coach/teams/${TEAM}/coaches`).set(auth()).send({ email: 'a@b.com' });
        expect(res.status).toBe(201);
    });
});

describe('DELETE /api/coach/teams/:teamId/coaches/:coachId', () => {
    it('returns 404 when not found', async () => {
        mockTeamAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).delete(`/api/coach/teams/${TEAM}/coaches/${UID}`).set(auth());
        expect(res.status).toBe(404);
    });
    it('returns 204 on success', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const res = await request(app).delete(`/api/coach/teams/${TEAM}/coaches/${UID}`).set(auth());
        expect(res.status).toBe(204);
    });
});

describe('GET /api/coach/teams/:teamId/students', () => {
    it('returns 200', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/coach/teams/${TEAM}/students`).set(auth());
        expect(res.status).toBe(200);
    });
});

describe('DELETE /api/coach/teams/:teamId/students/:studentId', () => {
    it('returns 400 for invalid studentId', async () => {
        mockTeamAccess();
        const res = await request(app).delete(`/api/coach/teams/${TEAM}/students/bad`).set(auth());
        expect(res.status).toBe(400);
    });
    it('returns 404 when query fails', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app).delete(`/api/coach/teams/${TEAM}/students/${SID}`).set(auth());
        expect(res.status).toBe(404);
    });
    it('returns 204 on success', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const res = await request(app).delete(`/api/coach/teams/${TEAM}/students/${SID}`).set(auth());
        expect(res.status).toBe(204);
    });
});

describe('GET /api/coach/teams/:teamId/pairings/:pairingId/witness-order', () => {
    it('returns 400 for invalid pairingId', async () => {
        mockTeamAccess();
        const res = await request(app).get(`/api/coach/teams/${TEAM}/pairings/bad/witness-order`).set(auth());
        expect(res.status).toBe(400);
    });
    it('returns 200', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/coach/teams/${TEAM}/pairings/${PID}/witness-order`).set(auth());
        expect(res.status).toBe(200);
    });
});

describe('PUT /api/coach/teams/:teamId/pairings/:pairingId/witness-order', () => {
    it('returns 400 for invalid pairingId', async () => {
        mockTeamAccess();
        const res = await request(app).put(`/api/coach/teams/${TEAM}/pairings/bad/witness-order`).set(auth()).send({ witness_ids: [] });
        expect(res.status).toBe(400);
    });
    it('returns 400 when witness_ids not array', async () => {
        mockTeamAccess();
        const res = await request(app).put(`/api/coach/teams/${TEAM}/pairings/${PID}/witness-order`).set(auth()).send({ witness_ids: 'bad' });
        expect(res.status).toBe(400);
    });
    it('returns 200 on success', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).put(`/api/coach/teams/${TEAM}/pairings/${PID}/witness-order`).set(auth()).send({ witness_ids: [] });
        expect(res.status).toBe(200);
    });
});

describe('GET /api/coach/teams/:teamId/pairings/:pairingId/assignments', () => {
    it('returns 400 for invalid pairingId', async () => {
        mockTeamAccess();
        const res = await request(app).get(`/api/coach/teams/${TEAM}/pairings/bad/assignments`).set(auth());
        expect(res.status).toBe(400);
    });
    it('returns 200', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/coach/teams/${TEAM}/pairings/${PID}/assignments`).set(auth());
        expect(res.status).toBe(200);
    });
});

describe('PUT /api/coach/teams/:teamId/pairings/:pairingId/assignments', () => {
    it('returns 400 for invalid pairingId', async () => {
        mockTeamAccess();
        const res = await request(app).put(`/api/coach/teams/${TEAM}/pairings/bad/assignments`).set(auth()).send({ field_id: FID, student_id: SID });
        expect(res.status).toBe(400);
    });
    it('returns 400 when field_id missing', async () => {
        mockTeamAccess();
        const res = await request(app).put(`/api/coach/teams/${TEAM}/pairings/${PID}/assignments`).set(auth()).send({ student_id: SID });
        expect(res.status).toBe(400);
    });
    it('returns 500 when upsert fails', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).put(`/api/coach/teams/${TEAM}/pairings/${PID}/assignments`).set(auth()).send({ field_id: FID, student_id: SID });
        expect(res.status).toBe(500);
    });
    it('returns 200 on success', async () => {
        mockTeamAccess();
        const assignment = { id: 'a1', pairing_id: PID, team_id: TEAM, field_id: FID, student_id: SID };
        mockDbQuery.mockResolvedValueOnce({ rows: [assignment], rowCount: 1 } as any);
        const res = await request(app).put(`/api/coach/teams/${TEAM}/pairings/${PID}/assignments`).set(auth()).send({ field_id: FID, student_id: SID });
        expect(res.status).toBe(200);
    });
});

// ─── New routes ───────────────────────────────────────────────────────────────

describe('GET /api/coach/tournaments/:id/scoring-categories', () => {
    it('returns 400 for invalid id', async () => {
        const res = await request(app).get('/api/coach/tournaments/bad/scoring-categories').set(auth());
        expect(res.status).toBe(400);
    });
    it('returns 200 with categories', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/coach/tournaments/${TID}/scoring-categories`).set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});

describe('GET /api/coach/tournaments/:id/witnesses', () => {
    it('returns 400 for invalid id', async () => {
        const res = await request(app).get('/api/coach/tournaments/bad/witnesses').set(auth());
        expect(res.status).toBe(400);
    });
    it('returns 200 with witnesses', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'w1', name: 'Alice', side: 'P' }], rowCount: 1 } as any);
        const res = await request(app).get(`/api/coach/tournaments/${TID}/witnesses`).set(auth());
        expect(res.status).toBe(200);
        expect(res.body[0].name).toBe('Alice');
    });
    it('returns 200 empty when no witnesses', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/coach/tournaments/${TID}/witnesses`).set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});

describe('GET /api/coach/tournaments/:id/format', () => {
    it('returns 400 for invalid id', async () => {
        const res = await request(app).get('/api/coach/tournaments/bad/format').set(auth());
        expect(res.status).toBe(400);
    });
    it('returns 200 with format', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ p_witnesses_called: 2, d_witnesses_called: 2 }], rowCount: 1 } as any);
        const res = await request(app).get(`/api/coach/tournaments/${TID}/format`).set(auth());
        expect(res.status).toBe(200);
        expect(res.body.p_witnesses_called).toBe(2);
    });
    it('returns 200 null when not found', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/coach/tournaments/${TID}/format`).set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toBeNull();
    });
});

describe('getWitnessesForTournament', () => {
    it('returns witnesses with id/name/side', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'w1', name: 'Alice', side: 'P' }, { id: 'w2', name: 'Bob', side: 'S' }], rowCount: 2 } as any);
        const result = await getWitnessesForTournament(TID);
        expect(result).toHaveLength(2);
        expect(result[0].side).toBe('P');
    });
    it('returns [] on null', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        expect(await getWitnessesForTournament(TID)).toEqual([]);
    });
});

describe('getFormatForTournament', () => {
    it('returns format counts', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ p_witnesses_called: 3, d_witnesses_called: 2 }], rowCount: 1 } as any);
        const result = await getFormatForTournament(TID);
        expect(result?.p_witnesses_called).toBe(3);
    });
    it('returns null when not found', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await getFormatForTournament(TID)).toBeNull();
    });
});
