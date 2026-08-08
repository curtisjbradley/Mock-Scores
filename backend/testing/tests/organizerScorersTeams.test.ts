/**
 * Coverage gaps: organizerTournamentRoutes — scorers, scorer-conflicts,
 * organizers, courtrooms, teams error branches
 */
jest.mock('../../src/email', () => jest.requireActual('../mocks/email'));
import request from 'supertest';
import app from '../../src/appService';
import { dbQuery } from '../../src/db';
import { setupAuth, makeAuth, makeMockAccess } from '../helpers/auth';

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;

const T       = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const SCORER  = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const ORG_ID  = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
const TEAM_ID = 'f6a7b8c9-d0e1-2345-fabc-456789012345';
const COACH_ID = 'a7b8c9d0-e1f2-3456-abcd-567890123456';
const STUDENT_ID = 'b8c9d0e1-f2a3-4567-bcde-678901234567';
const PAIRING_ID = 'e5f6a7b8-c9d0-1234-efab-345678901234';

const getToken = setupAuth();
const auth = () => makeAuth(getToken());
const mockAccess = () => makeMockAccess(mockDbQuery as jest.MockedFunction<(...args: unknown[]) => unknown>);

// ─── Scorers ──────────────────────────────────────────────────────────────────
describe('GET /scorers — DbError', () => {
    it('returns 500 on db failure', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app).get(`/api/organizer/tournament/${T}/scorers`).set(auth());
        expect(res.status).toBe(500);
    });
});

describe('POST /scorers — DbError', () => {
    it('returns 500 on db failure', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app).post(`/api/organizer/tournament/${T}/scorers`).set(auth())
            .send({ scorer_id: SCORER, first_name: 'A', last_name: 'B', email: 'a@b.com' });
        expect(res.status).toBe(500);
    });
});

describe('POST /scorers — invalid email', () => {
    it('returns 400 for invalid email', async () => {
        mockAccess();
        const res = await request(app).post(`/api/organizer/tournament/${T}/scorers`).set(auth())
            .send({ scorer_id: SCORER, first_name: 'A', last_name: 'B', email: 'not-email' });
        expect(res.status).toBe(400);
    });
});

describe('PUT /scorers', () => {
    it('returns 404 when scorer not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).put(`/api/organizer/tournament/${T}/scorers`).set(auth())
            .send({ scorer_id: SCORER, first_name: 'A', last_name: 'B', email: 'a@b.com' });
        expect(res.status).toBe(404);
    });

    it('returns 500 on db failure', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app).put(`/api/organizer/tournament/${T}/scorers`).set(auth())
            .send({ scorer_id: SCORER, first_name: 'A', last_name: 'B', email: 'a@b.com' });
        expect(res.status).toBe(500);
    });
});

describe('DELETE /scorers — errors', () => {
    it('returns 404 when scorer not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).delete(`/api/organizer/tournament/${T}/scorers`).set(auth())
            .send({ scorer_id: SCORER });
        expect(res.status).toBe(404);
    });

    it('returns 500 on db failure', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app).delete(`/api/organizer/tournament/${T}/scorers`).set(auth())
            .send({ scorer_id: SCORER });
        expect(res.status).toBe(500);
    });
});

// ─── Scorer conflicts ─────────────────────────────────────────────────────────
describe('GET /scorer-conflicts', () => {
    it('returns 200 with conflicts', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ scorer_id: SCORER, team_id: TEAM_ID }], rowCount: 1 } as any);
        const res = await request(app).get(`/api/organizer/tournament/${T}/scorer-conflicts`).set(auth());
        expect(res.status).toBe(200);
    });

    it('returns 500 on db failure', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app).get(`/api/organizer/tournament/${T}/scorer-conflicts`).set(auth());
        expect(res.status).toBe(500);
    });
});

describe('GET /scorers/:scorerId/conflicts', () => {
    it('returns 400 for invalid scorerId', async () => {
        mockAccess();
        const res = await request(app).get(`/api/organizer/tournament/${T}/scorers/bad-id/conflicts`).set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 200 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/organizer/tournament/${T}/scorers/${SCORER}/conflicts`).set(auth());
        expect(res.status).toBe(200);
    });

    it('returns 500 on db failure', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app).get(`/api/organizer/tournament/${T}/scorers/${SCORER}/conflicts`).set(auth());
        expect(res.status).toBe(500);
    });
});

describe('POST /scorers/:scorerId/conflicts', () => {
    it('returns 400 for invalid scorerId', async () => {
        mockAccess();
        const res = await request(app).post(`/api/organizer/tournament/${T}/scorers/bad-id/conflicts`).set(auth())
            .send({ team_id: TEAM_ID });
        expect(res.status).toBe(400);
    });

    it('returns 400 for invalid team_id', async () => {
        mockAccess();
        const res = await request(app).post(`/api/organizer/tournament/${T}/scorers/${SCORER}/conflicts`).set(auth())
            .send({ team_id: 'bad-id' });
        expect(res.status).toBe(400);
    });

    it('returns 201 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'cf1', scorer_id: SCORER, team_id: TEAM_ID, team_name: 'Eagles' }], rowCount: 1 } as any);
        const res = await request(app).post(`/api/organizer/tournament/${T}/scorers/${SCORER}/conflicts`).set(auth())
            .send({ team_id: TEAM_ID });
        expect(res.status).toBe(201);
    });

    it('returns 409 when conflict already exists', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // ON CONFLICT DO NOTHING returns empty
        const res = await request(app).post(`/api/organizer/tournament/${T}/scorers/${SCORER}/conflicts`).set(auth())
            .send({ team_id: TEAM_ID });
        expect(res.status).toBe(409);
    });
});

describe('DELETE /scorers/:scorerId/conflicts', () => {
    it('returns 400 for invalid scorerId', async () => {
        mockAccess();
        const res = await request(app).delete(`/api/organizer/tournament/${T}/scorers/bad-id/conflicts`).set(auth())
            .send({ team_id: TEAM_ID });
        expect(res.status).toBe(400);
    });

    it('returns 400 for invalid team_id', async () => {
        mockAccess();
        const res = await request(app).delete(`/api/organizer/tournament/${T}/scorers/${SCORER}/conflicts`).set(auth())
            .send({ team_id: 'bad-id' });
        expect(res.status).toBe(400);
    });

    it('returns 204 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ scorer_id: SCORER }], rowCount: 1 } as any);
        const res = await request(app).delete(`/api/organizer/tournament/${T}/scorers/${SCORER}/conflicts`).set(auth())
            .send({ team_id: TEAM_ID });
        expect(res.status).toBe(204);
    });

    it('returns 404 when not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).delete(`/api/organizer/tournament/${T}/scorers/${SCORER}/conflicts`).set(auth())
            .send({ team_id: TEAM_ID });
        expect(res.status).toBe(404);
    });
});

// ─── Organizers — additional error branches ───────────────────────────────────
describe('GET /organizers — DbError', () => {
    it('returns 500 on db failure', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app).get(`/api/organizer/tournament/${T}/organizers`).set(auth());
        expect(res.status).toBe(500);
    });
});

describe('POST /organizers — invalid email', () => {
    it('returns 400 for invalid email', async () => {
        mockAccess();
        const res = await request(app).post(`/api/organizer/tournament/${T}/organizers`).set(auth())
            .send({ organizer: { name: 'Bob', email: 'not-email', role: 'delegate' } });
        expect(res.status).toBe(400);
    });
});

// ─── Teams — additional error branches ────────────────────────────────────────
describe('POST /teams — invalid email', () => {
    it('returns 400 for invalid coach email', async () => {
        mockAccess();
        const res = await request(app).post(`/api/organizer/tournament/${T}/teams`).set(auth())
            .send({ team: { name: 'Eagles', coach_email: 'not-email' } });
        expect(res.status).toBe(400);
    });
});

describe('POST /teams — DbError', () => {
    it('returns 500 on db failure during addTeam', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // teamNameExists
        mockDbQuery.mockResolvedValueOnce(null); // addTeam INSERT fails
        const res = await request(app).post(`/api/organizer/tournament/${T}/teams`).set(auth())
            .send({ team: { name: 'Eagles', coach_email: 'coach@test.com' } });
        expect(res.status).toBe(500);
    });
});

describe('PUT /teams — DbError', () => {
    it('returns 500 on db failure during updateTeam', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // teamNameExists
        mockDbQuery.mockResolvedValueOnce(null); // updateTeam SELECT fails
        const res = await request(app).put(`/api/organizer/tournament/${T}/teams`).set(auth())
            .send({ team: { id: TEAM_ID, name: 'Eagles', coach_email: 'coach@test.com' } });
        expect(res.status).toBe(500);
    });
});

describe('PUT /teams/:teamId/owner', () => {
    it('returns 400 for invalid teamId', async () => {
        mockAccess();
        const res = await request(app).put(`/api/organizer/tournament/${T}/teams/bad-id/owner`).set(auth())
            .send({ coachId: COACH_ID });
        expect(res.status).toBe(400);
    });

    it('returns 400 when coachId missing', async () => {
        mockAccess();
        const res = await request(app).put(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/owner`).set(auth())
            .send({});
        expect(res.status).toBe(400);
    });

    it('returns 400 when coachId is invalid UUID', async () => {
        mockAccess();
        const res = await request(app).put(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/owner`).set(auth())
            .send({ coachId: 'bad-id' });
        expect(res.status).toBe(400);
    });

    it('returns 204 on success', async () => {
        mockAccess();
        // transferOwnership: SELECT coach exists, UPDATE set all false, UPDATE set true
        mockDbQuery.mockResolvedValueOnce({ rows: [{ coach_id: COACH_ID }], rowCount: 1 } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const res = await request(app).put(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/owner`).set(auth())
            .send({ coachId: COACH_ID });
        expect(res.status).toBe(204);
    });

    it('returns 404 when coach not found on team', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).put(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/owner`).set(auth())
            .send({ coachId: COACH_ID });
        expect(res.status).toBe(404);
    });
});

// ─── Team sub-routes (coaches, students, witness-order, assignments) ──────────
describe('GET /teams/:teamId/coaches', () => {
    it('returns 200', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/coaches`).set(auth());
        expect(res.status).toBe(200);
    });
});

describe('POST /teams/:teamId/coaches', () => {
    it('returns 400 when email missing', async () => {
        mockAccess();
        const res = await request(app).post(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/coaches`).set(auth()).send({});
        expect(res.status).toBe(400);
    });

    it('returns 400 for invalid email', async () => {
        mockAccess();
        const res = await request(app).post(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/coaches`).set(auth())
            .send({ email: 'not-email' });
        expect(res.status).toBe(400);
    });

    it('returns 201 on success', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ user_id: COACH_ID, first_name: 'A', last_name: 'B', email: 'a@b.com' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const res = await request(app).post(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/coaches`).set(auth())
            .send({ email: 'a@b.com' });
        expect(res.status).toBe(201);
    });
});

describe('GET /teams/:teamId/students', () => {
    it('returns 200', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/students`).set(auth());
        expect(res.status).toBe(200);
    });
});

describe('DELETE /teams/:teamId/students/:studentId', () => {
    it('returns 204 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ student_id: STUDENT_ID }], rowCount: 1 } as any);
        const res = await request(app).delete(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/students/${STUDENT_ID}`).set(auth());
        expect(res.status).toBe(204);
    });

    it('returns 404 when student not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).delete(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/students/${STUDENT_ID}`).set(auth());
        expect(res.status).toBe(404);
    });
});

describe('GET/PUT /teams/:teamId/pairings/:pairingId/witness-order', () => {
    it('GET returns 200', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app)
            .get(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/pairings/${PAIRING_ID}/witness-order`)
            .set(auth());
        expect(res.status).toBe(200);
    });

    it('PUT returns 400 when witness_ids not array', async () => {
        mockAccess();
        const res = await request(app)
            .put(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/pairings/${PAIRING_ID}/witness-order`)
            .set(auth()).send({ witness_ids: 'not-array' });
        expect(res.status).toBe(400);
    });

    it('PUT returns 200 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const res = await request(app)
            .put(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/pairings/${PAIRING_ID}/witness-order`)
            .set(auth()).send({ witness_ids: [] });
        expect(res.status).toBe(200);
    });
});

describe('GET/PUT /teams/:teamId/pairings/:pairingId/assignments', () => {
    it('GET returns 200', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app)
            .get(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/pairings/${PAIRING_ID}/assignments`)
            .set(auth());
        expect(res.status).toBe(200);
    });

    it('PUT returns 400 when fields missing', async () => {
        mockAccess();
        const res = await request(app)
            .put(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/pairings/${PAIRING_ID}/assignments`)
            .set(auth()).send({});
        expect(res.status).toBe(400);
    });

    it('PUT returns 200 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ field_id: SCORER, student_id: STUDENT_ID }], rowCount: 1 } as any);
        const res = await request(app)
            .put(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/pairings/${PAIRING_ID}/assignments`)
            .set(auth()).send({ field_id: SCORER, student_id: STUDENT_ID });
        expect(res.status).toBe(200);
    });

    it('PUT returns 500 on db failure', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app)
            .put(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/pairings/${PAIRING_ID}/assignments`)
            .set(auth()).send({ field_id: SCORER, student_id: STUDENT_ID });
        expect(res.status).toBe(500);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /teams/:teamId/students — pronouns
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /api/organizer/tournament/:id/teams/:teamId/students — pronouns', () => {
    it('returns 400 when student_name is missing', async () => {
        mockAccess();
        const res = await request(app)
            .post(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/students`)
            .set(auth()).send({ pronouns: 'she/her' });
        expect(res.status).toBe(400);
    });

    it('stores and returns pronouns', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ student_id: 'stu1', team_id: TEAM_ID, student_name: 'Alice', pronouns: 'she/her' }],
            rowCount: 1,
        } as any);
        const res = await request(app)
            .post(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/students`)
            .set(auth()).send({ student_name: 'Alice', pronouns: 'she/her' });
        expect(res.status).toBe(201);
        expect(res.body.pronouns).toBe('she/her');
    });

    it('returns 409 on duplicate student name', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app)
            .post(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/students`)
            .set(auth()).send({ student_name: 'Alice', pronouns: 'she/her' });
        expect(res.status).toBe(409);
    });
});
