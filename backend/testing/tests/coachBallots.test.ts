/**
 * Coverage gap tests for coachRoutes.ts and coachTeamRoutes.ts:
 * - GET /tournaments/:id/pairings/:pairingId/ballots (pairing ballot list)
 * - GET /tournaments/:id/pairings/:pairingId/ballots/:assignmentId (ballot detail)
 * - GET /teams/:teamId/default-witness-order
 * - PUT /teams/:teamId/default-witness-order
 * - GET /teams/:teamId/default-assignments
 * - PUT /teams/:teamId/default-assignments
 * - DELETE /teams/:teamId/default-assignments
 * - POST /teams/:teamId/pairings/:pairingId/assignments/bulk
 */
jest.mock('../../src/email', () => jest.requireActual('../mocks/email'));
import request from 'supertest';
import app from '../../src/appService';
import { dbQuery } from '../../src/db';
import { setupAuth, makeAuth } from '../helpers/auth';

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;

const TID  = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TEAM = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const PID  = 'd4e5f6a7-b8c9-0123-defa-234567890123';
const AID  = 'e5f6a7b8-c9d0-1234-efab-345678901234';
const FID  = 'f6a7b8c9-d0e1-2345-fabc-456789012345';
const SID  = 'a7b8c9d0-e1f2-3456-abcd-567890123456';

const getToken = setupAuth();
const auth = () => makeAuth(getToken());
const mockTeamAccess = () =>
    mockDbQuery.mockResolvedValueOnce({ rows: [{ coach_id: 'user-1' }], rowCount: 1 } as any);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /tournaments/:id/pairings/:pairingId/ballots
// ═══════════════════════════════════════════════════════════════════════════════
describe('GET /api/coach/tournaments/:id/pairings/:pairingId/ballots', () => {
    const url = `/coach/tournaments/${TID}/pairings/${PID}/ballots`;

    it('returns 400 for invalid tournament ID', async () => {
        const res = await request(app).get('/coach/tournaments/bad/pairings/' + PID + '/ballots').set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 400 for invalid pairing ID', async () => {
        const res = await request(app).get(`/coach/tournaments/${TID}/pairings/bad/ballots`).set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 404 when pairing results are not published', async () => {
        // canViewPairingResults returns false
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(404);
    });

    it('returns 200 with ballot summaries when results are public', async () => {
        // canViewPairingResults returns true
        mockDbQuery.mockResolvedValueOnce({ rows: [{ pairing_id: PID }], rowCount: 1 } as any);
        // getPairingBallots
        mockDbQuery.mockResolvedValueOnce({
            rows: [
                { p_points: 80, d_points: 70, scorer_assignment_id: AID },
            ],
            rowCount: 1,
        } as any);
        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].p_points).toBe(80);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /tournaments/:id/pairings/:pairingId/ballots/:assignmentId
// ═══════════════════════════════════════════════════════════════════════════════
describe('GET /api/coach/tournaments/:id/pairings/:pairingId/ballots/:assignmentId', () => {
    const url = `/coach/tournaments/${TID}/pairings/${PID}/ballots/${AID}`;

    it('returns 400 for invalid tournament ID', async () => {
        const res = await request(app).get(`/coach/tournaments/bad/pairings/${PID}/ballots/${AID}`).set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 400 for invalid pairing ID', async () => {
        const res = await request(app).get(`/coach/tournaments/${TID}/pairings/bad/ballots/${AID}`).set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 400 for invalid assignment ID', async () => {
        const res = await request(app).get(`/coach/tournaments/${TID}/pairings/${PID}/ballots/bad`).set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 404 when assignment is not in a public-results pairing', async () => {
        // isAssignmentInPairingWithPublicResults returns false
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(404);
    });

    it('returns 200 with redacted scoresheet and ballot data', async () => {
        // isAssignmentInPairingWithPublicResults returns true
        mockDbQuery.mockResolvedValueOnce({ rows: [{ assignment_id: AID }], rowCount: 1 } as any);
        // getScoreSheet (skipGuards): assignment lookup
        mockDbQuery.mockResolvedValueOnce({
            rows: [{
                pairing_id: PID,
                registered_scorer_id: 's1',
                paper_scorer_id: null,
                p_team: 't1',
                d_team: 't2',
                courtroom_name: 'Room 1',
                tournament_id: TID,
                presider_scorer_assignment_id: null,
                show_scores: null,
                conflict_reported: false,
            }],
            rowCount: 1,
        } as any);
        // scorer name
        mockDbQuery.mockResolvedValueOnce({ rows: [{ first_name: 'Jane', last_name: 'Judge' }], rowCount: 1 } as any);
        // tournament/format
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ case_name: 'Case', criminal_case: false, p_witnesses_called: 2, d_witnesses_called: 2, has_swing: false, format_id: 'f1' }],
            rowCount: 1,
        } as any);
        // teams
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 't1', code: '101', name: 'A' }, { id: 't2', code: '202', name: 'B' }], rowCount: 2 } as any);
        // scoring categories
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        // scoring fields
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        // witnesses
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        // witness call order
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        // student assignments
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        // award categories
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        // getBallot
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ ballot_json: { scores: [], nominations: [] } }],
            rowCount: 1,
        } as any);

        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(200);
        expect(res.body.sheet).toBeTruthy();
        // Scorer identity should be redacted
        expect(res.body.sheet.scorer.firstName).toBe('');
        expect(res.body.sheet.scorer.lastName).toBe('');
        expect(res.body.ballot).toBeTruthy();
    });

    it('returns 404 when both sheet and ballot are null', async () => {
        // isAssignmentInPairingWithPublicResults
        mockDbQuery.mockResolvedValueOnce({ rows: [{ assignment_id: AID }], rowCount: 1 } as any);
        // getScoreSheet throws (assignment not found) → caught → null
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        // getBallot returns null
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(404);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Default witness call order
// ═══════════════════════════════════════════════════════════════════════════════
describe('GET /api/coach/teams/:teamId/default-witness-order', () => {
    it('returns 200 with default witness order', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ witness_id: 'w1', witness_name: 'Alice', position: 1 }],
            rowCount: 1,
        } as any);
        const res = await request(app).get(`/coach/teams/${TEAM}/default-witness-order`).set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].witness_name).toBe('Alice');
    });

    it('returns 200 empty array when no defaults set', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/coach/teams/${TEAM}/default-witness-order`).set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});

describe('PUT /api/coach/teams/:teamId/default-witness-order', () => {
    it('returns 400 when witness_ids is not an array', async () => {
        mockTeamAccess();
        const res = await request(app).put(`/coach/teams/${TEAM}/default-witness-order`).set(auth())
            .send({ witness_ids: 'not-array' });
        expect(res.status).toBe(400);
    });

    it('returns 200 on success with empty array', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // DELETE
        const res = await request(app).put(`/coach/teams/${TEAM}/default-witness-order`).set(auth())
            .send({ witness_ids: [] });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('returns 200 on success with witness IDs', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // DELETE
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // INSERT w1
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // INSERT w2
        const res = await request(app).put(`/coach/teams/${TEAM}/default-witness-order`).set(auth())
            .send({ witness_ids: ['w1', 'w2'] });
        expect(res.status).toBe(200);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Default student assignments
// ═══════════════════════════════════════════════════════════════════════════════
describe('GET /api/coach/teams/:teamId/default-assignments', () => {
    it('returns 200 with default assignments', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ id: 'da1', team_id: TEAM, field_id: FID, student_id: SID, witness_id: null, field_label: 'Opening', student_name: 'Bob' }],
            rowCount: 1,
        } as any);
        const res = await request(app).get(`/coach/teams/${TEAM}/default-assignments`).set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
    });

    it('returns 200 empty when no defaults', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/coach/teams/${TEAM}/default-assignments`).set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});

describe('PUT /api/coach/teams/:teamId/default-assignments', () => {
    it('returns 400 when field_id is missing', async () => {
        mockTeamAccess();
        const res = await request(app).put(`/coach/teams/${TEAM}/default-assignments`).set(auth())
            .send({ student_id: SID });
        expect(res.status).toBe(400);
    });

    it('returns 400 when student_id is missing', async () => {
        mockTeamAccess();
        const res = await request(app).put(`/coach/teams/${TEAM}/default-assignments`).set(auth())
            .send({ field_id: FID });
        expect(res.status).toBe(400);
    });

    it('returns 200 on success', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // UPSERT
        const res = await request(app).put(`/coach/teams/${TEAM}/default-assignments`).set(auth())
            .send({ field_id: FID, student_id: SID });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('returns 200 with witness_id', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const res = await request(app).put(`/coach/teams/${TEAM}/default-assignments`).set(auth())
            .send({ field_id: FID, student_id: SID, witness_id: 'w1' });
        expect(res.status).toBe(200);
    });
});

describe('DELETE /api/coach/teams/:teamId/default-assignments', () => {
    it('returns 400 when field_id is missing', async () => {
        mockTeamAccess();
        const res = await request(app).delete(`/coach/teams/${TEAM}/default-assignments`).set(auth())
            .send({});
        expect(res.status).toBe(400);
    });

    it('returns 200 on success', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // DELETE
        const res = await request(app).delete(`/coach/teams/${TEAM}/default-assignments`).set(auth())
            .send({ field_id: FID });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('returns 200 with witness_id', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const res = await request(app).delete(`/coach/teams/${TEAM}/default-assignments`).set(auth())
            .send({ field_id: FID, witness_id: 'w1' });
        expect(res.status).toBe(200);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /teams/:teamId/pairings/:pairingId/assignments/bulk
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /api/coach/teams/:teamId/pairings/:pairingId/assignments/bulk', () => {
    const url = `/coach/teams/${TEAM}/pairings/${PID}/assignments/bulk`;

    it('returns 400 for invalid pairing ID', async () => {
        mockTeamAccess();
        const res = await request(app).post(`/coach/teams/${TEAM}/pairings/bad/assignments/bulk`).set(auth())
            .send({ assignments: [] });
        expect(res.status).toBe(400);
    });

    it('returns 400 when assignments is not an array', async () => {
        mockTeamAccess();
        const res = await request(app).post(url).set(auth())
            .send({ assignments: 'not-array' });
        expect(res.status).toBe(400);
    });

    it('returns 200 with empty assignments array', async () => {
        mockTeamAccess();
        const res = await request(app).post(url).set(auth())
            .send({ assignments: [] });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('returns 200 on success with assignments', async () => {
        mockTeamAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // UPSERT 1
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // UPSERT 2
        const res = await request(app).post(url).set(auth())
            .send({ assignments: [
                { field_id: FID, student_id: SID },
                { field_id: 'f2', student_id: 's2', witness_id: 'w1' },
            ] });
        expect(res.status).toBe(200);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Coach schedule with teamId query param
// ═══════════════════════════════════════════════════════════════════════════════
describe('GET /api/coach/tournaments/:id/schedule — teamId query param', () => {
    it('returns 400 for invalid teamId query param', async () => {
        const res = await request(app)
            .get(`/coach/tournaments/${TID}/schedule?teamId=bad`)
            .set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 200 empty when coach has no team in tournament', async () => {
        // getTeamIdForCoach returns null
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app)
            .get(`/coach/tournaments/${TID}/schedule`)
            .set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('returns schedule when explicit teamId provided', async () => {
        // getSchedule: rounds query
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app)
            .get(`/coach/tournaments/${TID}/schedule?teamId=${TEAM}`)
            .set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/coach/teams/:teamId/students — pronouns
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /api/coach/teams/:teamId/students — pronouns', () => {
    const TEAM_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

    it('returns 400 when student_name is missing', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ coach_id: 'user-1' }], rowCount: 1 } as any);
        const res = await request(app)
            .post(`/coach/teams/${TEAM_ID}/students`)
            .set(auth()).send({ pronouns: 'he/him' });
        expect(res.status).toBe(400);
    });

    it('stores and returns pronouns', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ coach_id: 'user-1' }], rowCount: 1 } as any);
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ student_id: 'stu1', team_id: TEAM_ID, student_name: 'Bob', pronouns: 'he/him' }],
            rowCount: 1,
        } as any);
        const res = await request(app)
            .post(`/coach/teams/${TEAM_ID}/students`)
            .set(auth()).send({ student_name: 'Bob', pronouns: 'he/him' });
        expect(res.status).toBe(201);
        expect(res.body.pronouns).toBe('he/him');
    });

    it('accepts null pronouns', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ coach_id: 'user-1' }], rowCount: 1 } as any);
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ student_id: 'stu1', team_id: TEAM_ID, student_name: 'Sam', pronouns: null }],
            rowCount: 1,
        } as any);
        const res = await request(app)
            .post(`/coach/teams/${TEAM_ID}/students`)
            .set(auth()).send({ student_name: 'Sam' });
        expect(res.status).toBe(201);
        expect(res.body.pronouns).toBeNull();
    });
});
