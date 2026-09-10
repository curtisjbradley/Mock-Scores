jest.mock('../../src/email', () => jest.requireActual('../mocks/email'));
import request from 'supertest';
import app from '../../src/appService';
import { dbQuery } from '../../src/db';
import { DbError, NotFoundError, AlreadyExistsError } from '../../src/errors';
import {
    getAllTournaments, getSchedule, getResults, getCoaches, addCoach,
    removeCoach, getStudents, addStudent, removeStudent, getWitnessCallOrder,
    setWitnessCallOrder, getStudentAssignments, upsertStudentAssignment,
    getCompetitionField, getStandingsData,
    getWitnessesForTournament, getFormatForTournament,
} from '../../src/providers/coachProvider';
import * as provider from '../../src/providers/coachProvider';
import { setupAuth, makeAuth } from '../helpers/auth';

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;
const ok = (rows: unknown[] = [], rowCount = rows.length) =>
    ({ rows, rowCount } as any);

beforeEach(() => {
    mockDbQuery.mockReset();
});

const TID  = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TEAM = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const UID  = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
const PID  = 'd4e5f6a7-b8c9-0123-defa-234567890123';
const SID  = 'e5f6a7b8-c9d0-1234-efab-345678901234';
const FID  = 'f6a7b8c9-d0e1-2345-fabc-456789012345';

const getToken = setupAuth();
const auth = () => makeAuth(getToken());
const mockTeamAccess = () =>
    mockDbQuery.mockResolvedValueOnce({ rows: [{ coach_id: 'user-1' }], rowCount: 1 } as any);

// ─── coachProvider ────────────────────────────────────────────────────────────
describe('getAllTournaments', () => {
    it('returns rows', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: TID }], rowCount: 1 } as any);
        expect(await getAllTournaments('u1')).toEqual([{ id: TID }]);
    });
    it('throws DbError when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(getAllTournaments('u1')).rejects.toThrow(DbError);
    });
});

describe('getSchedule', () => {
    it('returns rounds with pairings', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ round_id: 'r1', name: 'R1', round_time: null }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [{ pairing_id: PID }], rowCount: 1 } as any);
        const result = await getSchedule(TID, TEAM);
        expect(result[0].round_id).toBe('r1');
        expect(result[0].pairings[0].pairing_id).toBe(PID);
    });
    it('returns [] when no rounds', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await getSchedule(TID, TEAM)).toEqual([]);
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
        await expect(removeCoach(TEAM, UID)).resolves.toBeUndefined();
    });
    it('falls back to invite removal', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        await expect(removeCoach(TEAM, 'inv1')).resolves.toBeUndefined();
    });
    it('throws NotFoundError when not found', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        await expect(removeCoach(TEAM, 'nobody')).rejects.toThrow(NotFoundError);
    });
});

describe('getStudents', () => {
    it('returns students', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ student_id: SID, student_name: 'Bob', pronouns: 'he/him' }], rowCount: 1 } as any);
        expect(await getStudents(TEAM)).toHaveLength(1);
    });
});

describe('addStudent', () => {
    it('returns the new student', async () => {
        const row = { student_id: SID, team_id: TEAM, student_name: 'Bob', pronouns: null };
        mockDbQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);
        expect(await addStudent(TEAM, 'Bob', null)).toEqual(row);
    });
    it('throws AlreadyExistsError on duplicate (ON CONFLICT DO NOTHING returns empty)', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        await expect(addStudent(TEAM, 'Bob', null)).rejects.toThrow(AlreadyExistsError);
    });
});

describe('removeStudent', () => {
    it('resolves on success', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ student_id: SID }], rowCount: 1 } as any);
        await expect(removeStudent(SID)).resolves.toBeUndefined();
    });
    it('throws NotFoundError when not found', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        await expect(removeStudent(SID)).rejects.toThrow(NotFoundError);
    });
    it('throws DbError when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(removeStudent(SID)).rejects.toThrow(DbError);
    });
});

describe('getWitnessCallOrder', () => {
    it('returns witness order', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'w1' }], rowCount: 1 } as any);
        expect(await getWitnessCallOrder(PID, TEAM)).toEqual([{ id: 'w1' }]);
    });
});

describe('setWitnessCallOrder', () => {
    it('resolves with empty list (just deletes)', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        await expect(setWitnessCallOrder(PID, TEAM, [])).resolves.toBeUndefined();
    });
    it('inserts witnesses', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // DELETE
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // INSERT w1
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // INSERT w2
        await expect(setWitnessCallOrder(PID, TEAM, ['w1', 'w2'])).resolves.toBeUndefined();
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
    it('throws DbError when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(upsertStudentAssignment(PID, TEAM, FID, SID)).rejects.toThrow(DbError);
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
            .mockResolvedValueOnce({ rows: [{ standings_dsl: '(config (columns) (tiebreakers))' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [{ p_team_id: 't1', d_team_id: 't2', p_points: 5, d_points: 3, pairing_id: PID }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [{ id: TEAM, name: 'Team A', code: 'A' }], rowCount: 1 } as any);
        const result = await getStandingsData(TID);
        expect(result.config).toEqual({ dsl: '(config (columns) (tiebreakers))' });
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
        expect((await request(app).get('/coach/tournaments')).status).toBe(401);
    });
    it('returns 200 with tournaments', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: TID }], rowCount: 1 } as any);
        const res = await request(app).get('/coach/tournaments').set(auth());
        expect(res.status).toBe(200);
    });
});

describe('GET /api/coach/tournaments/:id/schedule', () => {
    it('returns 400 for invalid id', async () => {
        const res = await request(app).get('/coach/tournaments/bad/schedule').set(auth());
        expect(res.status).toBe(400);
    });
    it('returns 200', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/coach/tournaments/${TID}/schedule`).set(auth());
        expect(res.status).toBe(200);
    });
});

describe('GET /api/coach/tournaments/:id/results', () => {
    it('returns 400 for invalid id', async () => {
        const res = await request(app).get('/coach/tournaments/bad/results').set(auth());
        expect(res.status).toBe(400);
    });
    it('returns 200', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/coach/tournaments/${TID}/results`).set(auth());
        expect(res.status).toBe(200);
    });
});

describe('GET /api/coach/tournaments/:id/field', () => {
    it('returns 400 for invalid id', async () => {
        const res = await request(app).get('/coach/tournaments/bad/field').set(auth());
        expect(res.status).toBe(400);
    });
    it('returns 200', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/coach/tournaments/${TID}/field`).set(auth());
        expect(res.status).toBe(200);
    });
});

describe('GET /api/coach/tournaments/:id/standings', () => {
    it('returns 400 for invalid id', async () => {
        const res = await request(app).get('/coach/tournaments/bad/standings').set(auth());
        expect(res.status).toBe(400);
    });
    it('returns 200', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/coach/tournaments/${TID}/standings`).set(auth());
        expect(res.status).toBe(200);
    });
});

// ─── Team routes ──────────────────────────────────────────────────────────────
describe('verifyTeamAccess', () => {
    it('returns 400 for invalid teamId', async () => {
        const res = await request(app).get('/coach/teams/bad-id/coaches').set(auth());
        expect(res.status).toBe(400);
    });
    it('returns 403 when not a team member', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/coach/teams/${TEAM}/coaches`).set(auth());
        expect(res.status).toBe(403);
    });
});

describe('GET /api/coach/teams/:teamId/coaches', () => {
    it('returns 200 with coaches', async () => {
        mockTeamAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/coach/teams/${TEAM}/coaches`).set(auth());
        expect(res.status).toBe(200);
    });
});

describe('POST /api/coach/teams/:teamId/coaches', () => {
    it('returns 400 when email missing', async () => {
        mockTeamAccess();
        const res = await request(app).post(`/coach/teams/${TEAM}/coaches`).set(auth()).send({});
        expect(res.status).toBe(400);
    });
    it('returns 201 on success', async () => {
        mockTeamAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ user_id: UID, first_name: 'A', last_name: 'B', email: 'a@b.com' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [{ id: TEAM, name: 'Team A', tournament_id: 't1' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [{ tournament_id: 't1', name: 'Tournament A' }], rowCount: 1 } as any);
        const res = await request(app).post(`/coach/teams/${TEAM}/coaches`).set(auth()).send({ email: 'a@b.com' });
        await new Promise(setImmediate);
        expect(res.status).toBe(201);
    });
});

describe('DELETE /api/coach/teams/:teamId/coaches/:coachId', () => {
    it('returns 404 when not found', async () => {
        mockTeamAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).delete(`/coach/teams/${TEAM}/coaches/${UID}`).set(auth());
        expect(res.status).toBe(404);
    });
    it('returns 204 on success', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const res = await request(app).delete(`/coach/teams/${TEAM}/coaches/${UID}`).set(auth());
        expect(res.status).toBe(204);
    });
});

describe('GET /api/coach/teams/:teamId/students', () => {
    it('returns 200', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/coach/teams/${TEAM}/students`).set(auth());
        expect(res.status).toBe(200);
    });
});

describe('DELETE /api/coach/teams/:teamId/students/:studentId', () => {
    it('returns 400 for invalid studentId', async () => {
        mockTeamAccess();
        const res = await request(app).delete(`/coach/teams/${TEAM}/students/bad`).set(auth());
        expect(res.status).toBe(400);
    });
    it('returns 500 when query throws DbError', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app).delete(`/coach/teams/${TEAM}/students/${SID}`).set(auth());
        expect(res.status).toBe(500);
    });
    it('returns 404 when student not found', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).delete(`/coach/teams/${TEAM}/students/${SID}`).set(auth());
        expect(res.status).toBe(404);
    });
    it('returns 204 on success', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ student_id: SID }], rowCount: 1 } as any);
        const res = await request(app).delete(`/coach/teams/${TEAM}/students/${SID}`).set(auth());
        expect(res.status).toBe(204);
    });
});

describe('GET /api/coach/teams/:teamId/pairings/:pairingId/witness-order', () => {
    it('returns 400 for invalid pairingId', async () => {
        mockTeamAccess();
        const res = await request(app).get(`/coach/teams/${TEAM}/pairings/bad/witness-order`).set(auth());
        expect(res.status).toBe(400);
    });
    it('returns 200', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/coach/teams/${TEAM}/pairings/${PID}/witness-order`).set(auth());
        expect(res.status).toBe(200);
    });
});

describe('PUT /api/coach/teams/:teamId/pairings/:pairingId/witness-order', () => {
    it('returns 400 for invalid pairingId', async () => {
        mockTeamAccess();
        const res = await request(app).put(`/coach/teams/${TEAM}/pairings/bad/witness-order`).set(auth()).send({ witness_ids: [] });
        expect(res.status).toBe(400);
    });
    it('returns 400 when witness_ids not array', async () => {
        mockTeamAccess();
        const res = await request(app).put(`/coach/teams/${TEAM}/pairings/${PID}/witness-order`).set(auth()).send({ witness_ids: 'bad' });
        expect(res.status).toBe(400);
    });
    it('returns 200 on success', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ locked: false }], rowCount: 1 } as any); // isPairingRoundLocked
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).put(`/coach/teams/${TEAM}/pairings/${PID}/witness-order`).set(auth()).send({ witness_ids: [] });
        expect(res.status).toBe(200);
    });
    it('returns 409 when the round is locked', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ locked: true }], rowCount: 1 } as any); // isPairingRoundLocked
        const res = await request(app).put(`/coach/teams/${TEAM}/pairings/${PID}/witness-order`).set(auth()).send({ witness_ids: [] });
        expect(res.status).toBe(409);
    });
});

describe('GET /api/coach/teams/:teamId/pairings/:pairingId/assignments', () => {
    it('returns 400 for invalid pairingId', async () => {
        mockTeamAccess();
        const res = await request(app).get(`/coach/teams/${TEAM}/pairings/bad/assignments`).set(auth());
        expect(res.status).toBe(400);
    });
    it('returns 200', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/coach/teams/${TEAM}/pairings/${PID}/assignments`).set(auth());
        expect(res.status).toBe(200);
    });
});

describe('PUT /api/coach/teams/:teamId/pairings/:pairingId/assignments', () => {
    it('returns 400 for invalid pairingId', async () => {
        mockTeamAccess();
        const res = await request(app).put(`/coach/teams/${TEAM}/pairings/bad/assignments`).set(auth()).send({ field_id: FID, student_id: SID });
        expect(res.status).toBe(400);
    });
    it('returns 400 when field_id missing', async () => {
        mockTeamAccess();
        const res = await request(app).put(`/coach/teams/${TEAM}/pairings/${PID}/assignments`).set(auth()).send({ student_id: SID });
        expect(res.status).toBe(400);
    });
    it('returns 500 when upsert fails', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ locked: false }], rowCount: 1 } as any); // isPairingRoundLocked
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).put(`/coach/teams/${TEAM}/pairings/${PID}/assignments`).set(auth()).send({ field_id: FID, student_id: SID });
        expect(res.status).toBe(500);
    });
    it('returns 200 on success', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ locked: false }], rowCount: 1 } as any); // isPairingRoundLocked
        const assignment = { id: 'a1', pairing_id: PID, team_id: TEAM, field_id: FID, student_id: SID };
        mockDbQuery.mockResolvedValueOnce({ rows: [assignment], rowCount: 1 } as any);
        const res = await request(app).put(`/coach/teams/${TEAM}/pairings/${PID}/assignments`).set(auth()).send({ field_id: FID, student_id: SID });
        expect(res.status).toBe(200);
    });
    it('returns 409 when the round is locked', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ locked: true }], rowCount: 1 } as any); // isPairingRoundLocked
        const res = await request(app).put(`/coach/teams/${TEAM}/pairings/${PID}/assignments`).set(auth()).send({ field_id: FID, student_id: SID });
        expect(res.status).toBe(409);
    });
});

// ─── New routes ───────────────────────────────────────────────────────────────

describe('GET /api/coach/tournaments/:id/scoring-categories', () => {
    it('returns 400 for invalid id', async () => {
        const res = await request(app).get('/coach/tournaments/bad/scoring-categories').set(auth());
        expect(res.status).toBe(400);
    });
    it('returns 200 with categories', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/coach/tournaments/${TID}/scoring-categories`).set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});

describe('GET /api/coach/tournaments/:id/witnesses', () => {
    it('returns 400 for invalid id', async () => {
        const res = await request(app).get('/coach/tournaments/bad/witnesses').set(auth());
        expect(res.status).toBe(400);
    });
    it('returns 200 with witnesses', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'w1', name: 'Alice', side: 'P' }], rowCount: 1 } as any);
        const res = await request(app).get(`/coach/tournaments/${TID}/witnesses`).set(auth());
        expect(res.status).toBe(200);
        expect(res.body[0].name).toBe('Alice');
    });
    it('returns 200 empty when no witnesses', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/coach/tournaments/${TID}/witnesses`).set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});

describe('GET /api/coach/tournaments/:id/format', () => {
    it('returns 400 for invalid id', async () => {
        const res = await request(app).get('/coach/tournaments/bad/format').set(auth());
        expect(res.status).toBe(400);
    });
    it('returns 200 with format', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ p_witnesses_called: 2, d_witnesses_called: 2 }], rowCount: 1 } as any);
        const res = await request(app).get(`/coach/tournaments/${TID}/format`).set(auth());
        expect(res.status).toBe(200);
        expect(res.body.p_witnesses_called).toBe(2);
    });
    it('returns 200 null when not found', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/coach/tournaments/${TID}/format`).set(auth());
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

// ─── Additional coachProvider coverage ───────────────────────────────────────

// ─── sharesIndividualRankings ─────────────────────────────────────────────────

describe('sharesIndividualRankings', () => {
    it('returns the stored setting when present', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([{ share_individual_rankings: false }]));

        await expect(provider.sharesIndividualRankings('t1')).resolves.toBe(false);
    });

    it('defaults to true when the tournament row is missing', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));

        await expect(provider.sharesIndividualRankings('t1')).resolves.toBe(true);
    });

    it('throws DbError when the query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);

        await expect(provider.sharesIndividualRankings('t1')).rejects.toThrow(DbError);
    });
});

// ─── toggleNotifications ──────────────────────────────────────────────────────

describe('toggleNotifications', () => {
    it('returns the updated coach', async () => {
        const coach = {
            coach_id: 'c1',
            name: 'Coach One',
            email: 'coach@example.com',
            is_owner: false,
            has_joined: true,
            notifications_enabled: false,
        };

        mockDbQuery.mockResolvedValueOnce(ok([coach]));

        await expect(provider.toggleNotifications('team1', 'c1')).resolves.toEqual(coach);
        expect(mockDbQuery).toHaveBeenCalledWith(
            expect.stringMatching(/UPDATE team_coaches/i),
            ['c1', 'team1'],
        );
    });

    it('returns null when no coach is updated', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));

        await expect(provider.toggleNotifications('team1', 'missing')).resolves.toBeNull();
    });

    it('returns null when dbQuery returns null', async () => {
        mockDbQuery.mockResolvedValueOnce(null);

        await expect(provider.toggleNotifications('team1', 'c1')).resolves.toBeNull();
    });
});

// ─── roster columns / student custom data ────────────────────────────────────

describe('getRosterColumnsByTeam', () => {
    it('maps database rows to custom roster columns', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([
            { tournament_id: 't1', position: 0, type: 'string', column_name: 'Year' },
            { tournament_id: 't1', position: 1, type: 'int', column_name: 'Graduation' },
        ]));

        await expect(provider.getRosterColumnsByTeam('team1')).resolves.toEqual([
            { field: 'Year', type: 'string' },
            { field: 'Graduation', type: 'int' },
        ]);
    });

    it('returns an empty array when there are no columns', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));

        await expect(provider.getRosterColumnsByTeam('team1')).resolves.toEqual([]);
    });

    it('throws DbError when the query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);

        await expect(provider.getRosterColumnsByTeam('team1')).rejects.toThrow(DbError);
    });
});

describe('updateStudentCustomData', () => {
    const customData = [
        { field: 'Year', type: 'string' as const, value: 'Senior' },
        { field: 'Graduation', type: 'int' as const, value: 2027 },
    ];

    it('updates and returns the student', async () => {
        const student = {
            student_id: 's1',
            team_id: 'team1',
            student_name: 'Student',
            pronouns: null,
            custom_data: customData,
        };

        mockDbQuery.mockResolvedValueOnce(ok([student]));

        await expect(provider.updateStudentCustomData('s1', customData)).resolves.toEqual(student);
        expect(mockDbQuery).toHaveBeenCalledWith(
            expect.stringMatching(/UPDATE team_rostered_students/i),
            [JSON.stringify(customData), 's1'],
        );
    });

    it('throws NotFoundError when no student is updated', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));

        await expect(provider.updateStudentCustomData('missing', customData)).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when dbQuery returns null', async () => {
        mockDbQuery.mockResolvedValueOnce(null);

        await expect(provider.updateStudentCustomData('missing', customData)).rejects.toThrow(NotFoundError);
    });
});

// ─── bulk student assignments ────────────────────────────────────────────────

describe('bulkUpsertStudentAssignments', () => {
    it('does nothing for an empty assignment list', async () => {
        await expect(
            provider.bulkUpsertStudentAssignments('p1', 'team1', []),
        ).resolves.toBeUndefined();

        expect(mockDbQuery).not.toHaveBeenCalled();
    });

    it('upserts every assignment and normalizes missing witness_id to null', async () => {
        mockDbQuery.mockResolvedValue(ok([], 1));

        await provider.bulkUpsertStudentAssignments('p1', 'team1', [
            { field_id: 'f1', student_id: 's1' },
            { field_id: 'f2', student_id: 's2', witness_id: 'w1' },
        ]);

        expect(mockDbQuery).toHaveBeenCalledTimes(2);
        expect(mockDbQuery).toHaveBeenNthCalledWith(
            1,
            expect.stringMatching(/INSERT INTO student_assignments/i),
            ['p1', 'team1', 'f1', null, 's1'],
        );
        expect(mockDbQuery).toHaveBeenNthCalledWith(
            2,
            expect.stringMatching(/INSERT INTO student_assignments/i),
            ['p1', 'team1', 'f2', 'w1', 's2'],
        );
    });
});

// ─── default witness call order ──────────────────────────────────────────────

describe('getDefaultWitnessCallOrder', () => {
    it('returns defaults from the database', async () => {
        const rows = [
            { witness_id: 'w1', witness_name: 'Witness One', position: 1 },
            { witness_id: 'w2', witness_name: 'Witness Two', position: 2 },
        ];
        mockDbQuery.mockResolvedValueOnce(ok(rows));

        await expect(provider.getDefaultWitnessCallOrder('team1')).resolves.toEqual(rows);
    });

    it('returns an empty array when dbQuery returns null', async () => {
        mockDbQuery.mockResolvedValueOnce(null);

        await expect(provider.getDefaultWitnessCallOrder('team1')).resolves.toEqual([]);
    });
});

describe('setDefaultWitnessCallOrder', () => {
    it('deletes existing defaults and stops when the new order is empty', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));

        await provider.setDefaultWitnessCallOrder('team1', []);

        expect(mockDbQuery).toHaveBeenCalledTimes(1);
        expect(mockDbQuery).toHaveBeenCalledWith(
            expect.stringMatching(/DELETE FROM default_witness_call_order/i),
            ['team1'],
        );
    });

    it('deletes existing defaults and inserts each witness in order', async () => {
        mockDbQuery.mockResolvedValue(ok([], 1));

        await provider.setDefaultWitnessCallOrder('team1', ['w1', 'w2']);

        expect(mockDbQuery).toHaveBeenCalledTimes(3);
        expect(mockDbQuery).toHaveBeenNthCalledWith(
            2,
            expect.stringMatching(/INSERT INTO default_witness_call_order/i),
            ['team1', 'w1', 1],
        );
        expect(mockDbQuery).toHaveBeenNthCalledWith(
            3,
            expect.stringMatching(/INSERT INTO default_witness_call_order/i),
            ['team1', 'w2', 2],
        );
    });
});

// ─── default student assignments ─────────────────────────────────────────────

describe('getDefaultStudentAssignments', () => {
    it('returns defaults from the database', async () => {
        const rows = [{
            id: 'd1',
            pairing_id: null,
            team_id: 'team1',
            field_id: 'f1',
            field_label: 'Opening',
            witness_id: null,
            student_id: 's1',
            student_name: 'Student One',
        }];
        mockDbQuery.mockResolvedValueOnce(ok(rows));

        await expect(provider.getDefaultStudentAssignments('team1')).resolves.toEqual(rows);
    });

    it('returns an empty array when dbQuery returns null', async () => {
        mockDbQuery.mockResolvedValueOnce(null);

        await expect(provider.getDefaultStudentAssignments('team1')).resolves.toEqual([]);
    });
});

describe('upsertDefaultStudentAssignment', () => {
    it('stores a null witness id when none is provided', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([], 1));

        await provider.upsertDefaultStudentAssignment('team1', 'f1', 's1');

        expect(mockDbQuery).toHaveBeenCalledWith(
            expect.stringMatching(/INSERT INTO default_student_assignments/i),
            ['team1', 'f1', null, 's1'],
        );
    });

    it('passes through an explicit witness id', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([], 1));

        await provider.upsertDefaultStudentAssignment('team1', 'f1', 's1', 'w1');

        expect(mockDbQuery).toHaveBeenCalledWith(
            expect.stringMatching(/INSERT INTO default_student_assignments/i),
            ['team1', 'f1', 'w1', 's1'],
        );
    });
});

describe('deleteDefaultStudentAssignment', () => {
    it('deletes using null witness matching when witnessId is omitted', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([], 1));

        await provider.deleteDefaultStudentAssignment('team1', 'f1');

        expect(mockDbQuery).toHaveBeenCalledWith(
            expect.stringMatching(/DELETE FROM default_student_assignments/i),
            ['team1', 'f1', null],
        );
    });

    it('passes through an explicit witness id', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([], 1));

        await provider.deleteDefaultStudentAssignment('team1', 'f1', 'w1');

        expect(mockDbQuery).toHaveBeenCalledWith(
            expect.stringMatching(/DELETE FROM default_student_assignments/i),
            ['team1', 'f1', 'w1'],
        );
    });
});

// ─── coach ballot visibility ─────────────────────────────────────────────────

describe('canViewPairingResults', () => {
    it('returns true when a visible pairing row exists', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([{ pairing_id: 'p1' }]));

        await expect(provider.canViewPairingResults('p1', 'team1')).resolves.toBe(true);
        expect(mockDbQuery).toHaveBeenCalledWith(
            expect.stringMatching(/results_public = true/i),
            ['p1', 'team1'],
        );
    });

    it('returns false when no matching row exists', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));

        await expect(provider.canViewPairingResults('p1', 'team1')).resolves.toBe(false);
    });

    it('returns false when dbQuery returns null', async () => {
        mockDbQuery.mockResolvedValueOnce(null);

        await expect(provider.canViewPairingResults('p1', 'team1')).resolves.toBe(false);
    });
});

describe('isBallotInPairingWithPublicResults', () => {
    it('returns true when the ballot belongs to a public pairing for the team', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([{ ballot_id: 'b1' }]));

        await expect(
            provider.isBallotInPairingWithPublicResults('b1', 'team1'),
        ).resolves.toBe(true);

        expect(mockDbQuery).toHaveBeenCalledWith(
            expect.stringMatching(/FROM ballots b/i),
            ['b1', 'team1'],
        );
    });

    it('returns false when no matching ballot is visible', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));

        await expect(
            provider.isBallotInPairingWithPublicResults('b1', 'team1'),
        ).resolves.toBe(false);
    });

    it('returns false when dbQuery returns null', async () => {
        mockDbQuery.mockResolvedValueOnce(null);

        await expect(
            provider.isBallotInPairingWithPublicResults('b1', 'team1'),
        ).resolves.toBe(false);
    });
});

describe('getPairingBallots', () => {
    it('maps scorer_assignment_id to assignment_id', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([
            {
                p_points: 82,
                d_points: 79,
                scorer_assignment_id: 'a1',
                ballot_id: 'b1',
            },
            {
                p_points: 75,
                d_points: 80,
                scorer_assignment_id: 'a2',
                ballot_id: 'b2',
            },
        ]));

        await expect(provider.getPairingBallots('team1', 'p1')).resolves.toEqual([
            { p_points: 82, d_points: 79, assignment_id: 'a1', ballot_id: 'b1' },
            { p_points: 75, d_points: 80, assignment_id: 'a2', ballot_id: 'b2' },
        ]);

        expect(mockDbQuery).toHaveBeenCalledWith(
            expect.stringMatching(/WHERE b\.pairing_id = \$1/i),
            ['p1', 'team1'],
        );
    });

    it('returns an empty array when there are no ballots', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));

        await expect(provider.getPairingBallots('team1', 'p1')).resolves.toEqual([]);
    });

    it('returns an empty array when dbQuery returns null', async () => {
        mockDbQuery.mockResolvedValueOnce(null);

        await expect(provider.getPairingBallots('team1', 'p1')).resolves.toEqual([]);
    });
});
