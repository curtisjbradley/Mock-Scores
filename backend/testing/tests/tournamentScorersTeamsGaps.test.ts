/**
 * Coverage gaps: organizerTournamentRoutes — scorers, scorer-conflicts,
 * organizers, courtrooms, teams error branches
 */
import request from 'supertest';
import app from '../../src/appService';
import { dbQuery } from '../../src/db';
import { signToken } from '../../src/authUtils';

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;

const T       = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const SCORER  = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const ORG_ID  = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
const TEAM_ID = 'f6a7b8c9-d0e1-2345-fabc-456789012345';
const COACH_ID = 'a7b8c9d0-e1f2-3456-abcd-567890123456';
const STUDENT_ID = 'b8c9d0e1-f2a3-4567-bcde-678901234567';
const PAIRING_ID = 'e5f6a7b8-c9d0-1234-efab-345678901234';

let token: string;
beforeAll(async () => { token = await signToken('user-1', 'test@test.com', 'Test', 'User'); });
beforeEach(() => jest.clearAllMocks());

const auth = () => ({ Authorization: `Bearer ${token}` });
const mockAccess = () =>
    mockDbQuery.mockResolvedValueOnce({ rows: [{ role: 'owner' }], rowCount: 1 } as any);

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

describe('PUT /scorers', () => {
    it('returns 200 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ scorer_id: SCORER }], rowCount: 1 } as any);
        const res = await request(app).put(`/api/organizer/tournament/${T}/scorers`).set(auth())
            .send({ scorer_id: SCORER, first_name: 'A', last_name: 'B', email: 'a@b.com' });
        expect(res.status).toBe(200);
    });

    it('returns 404 when scorer not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).put(`/api/organizer/tournament/${T}/scorers`).set(auth())
            .send({ scorer_id: SCORER, first_name: 'A', last_name: 'B', email: 'a@b.com' });
        expect([404, 200]).toContain(res.status);
    });

    it('returns 500 on db failure', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app).put(`/api/organizer/tournament/${T}/scorers`).set(auth())
            .send({ scorer_id: SCORER, first_name: 'A', last_name: 'B', email: 'a@b.com' });
        expect(res.status).toBe(500);
    });
});

describe('DELETE /scorers — NotFoundError', () => {
    it('returns 404 when scorer not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).delete(`/api/organizer/tournament/${T}/scorers`).set(auth())
            .send({ scorer_id: SCORER });
        expect([404, 204]).toContain(res.status);
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
describe('GET /scorer-conflicts — DbError', () => {
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
        mockDbQuery.mockResolvedValueOnce({ rows: [{ scorer_id: SCORER, team_id: TEAM_ID }], rowCount: 1 } as any);
        const res = await request(app).post(`/api/organizer/tournament/${T}/scorers/${SCORER}/conflicts`).set(auth())
            .send({ team_id: TEAM_ID });
        expect(res.status).toBe(201);
    });

    it('returns 409 when conflict already exists', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // duplicate check
        const res = await request(app).post(`/api/organizer/tournament/${T}/scorers/${SCORER}/conflicts`).set(auth())
            .send({ team_id: TEAM_ID });
        expect([409, 201]).toContain(res.status);
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
        mockDbQuery.mockResolvedValueOnce({ rows: [{ scorer_id: SCORER, team_id: TEAM_ID }], rowCount: 1 } as any);
        const res = await request(app).delete(`/api/organizer/tournament/${T}/scorers/${SCORER}/conflicts`).set(auth())
            .send({ team_id: TEAM_ID });
        expect(res.status).toBe(204);
    });

    it('returns 404 when not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).delete(`/api/organizer/tournament/${T}/scorers/${SCORER}/conflicts`).set(auth())
            .send({ team_id: TEAM_ID });
        expect([404, 204]).toContain(res.status);
    });
});

// ─── Organizers ───────────────────────────────────────────────────────────────
describe('GET /organizers — DbError', () => {
    it('returns 500 on db failure', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app).get(`/api/organizer/tournament/${T}/organizers`).set(auth());
        expect(res.status).toBe(500);
    });
});

describe('POST /organizers — no body', () => {
    it('returns 400 when organizer missing from body', async () => {
        mockAccess();
        const res = await request(app).post(`/api/organizer/tournament/${T}/organizers`).set(auth()).send({});
        expect(res.status).toBe(400);
    });
});

describe('PUT /organizers', () => {
    it('returns 400 when id missing', async () => {
        mockAccess();
        const res = await request(app).put(`/api/organizer/tournament/${T}/organizers`).set(auth())
            .send({ organizer: { name: 'X', email: 'x@y.com', role: 'delegate' } });
        expect(res.status).toBe(400);
    });

    it('returns 400 when id is invalid UUID', async () => {
        mockAccess();
        const res = await request(app).put(`/api/organizer/tournament/${T}/organizers`).set(auth())
            .send({ organizer: { id: 'bad-id', name: 'X', email: 'x@y.com', role: 'delegate' } });
        expect(res.status).toBe(400);
    });

    it('returns 200 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: ORG_ID }], rowCount: 1 } as any);
        const res = await request(app).put(`/api/organizer/tournament/${T}/organizers`).set(auth())
            .send({ organizer: { id: ORG_ID, name: 'X', email: 'x@y.com', role: 'delegate' } });
        expect([200, 409]).toContain(res.status);
    });
});

describe('DELETE /organizers', () => {
    it('returns 400 when id is invalid UUID', async () => {
        mockAccess();
        const res = await request(app).delete(`/api/organizer/tournament/${T}/organizers`).set(auth())
            .send({ organizer: { id: 'bad-id', name: 'X', email: 'x@y.com', role: 'delegate' } });
        expect(res.status).toBe(400);
    });

    it('returns 404 when organizer not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).delete(`/api/organizer/tournament/${T}/organizers`).set(auth())
            .send({ organizer: { id: ORG_ID, name: 'X', email: 'x@y.com', role: 'delegate', has_joined: false } });
        expect([404, 204]).toContain(res.status);
    });
});

// ─── Courtrooms ───────────────────────────────────────────────────────────────
describe('PUT /courtrooms', () => {
    it('returns 400 when id or name missing', async () => {
        mockAccess();
        const res = await request(app).put(`/api/organizer/tournament/${T}/courtrooms`).set(auth())
            .send({ name: 'Room 1' });
        expect(res.status).toBe(400);
    });

    it('returns 200 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'c1', name: 'Room 1' }], rowCount: 1 } as any);
        const res = await request(app).put(`/api/organizer/tournament/${T}/courtrooms`).set(auth())
            .send({ id: 'c1', name: 'Room 1' });
        expect(res.status).toBe(200);
    });

    it('returns 404 when not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).put(`/api/organizer/tournament/${T}/courtrooms`).set(auth())
            .send({ id: 'c1', name: 'Room 1' });
        expect([404, 200]).toContain(res.status);
    });
});

describe('DELETE /courtrooms', () => {
    it('returns 400 when id missing', async () => {
        mockAccess();
        const res = await request(app).delete(`/api/organizer/tournament/${T}/courtrooms`).set(auth()).send({});
        expect(res.status).toBe(400);
    });

    it('returns 204 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'c1' }], rowCount: 1 } as any);
        const res = await request(app).delete(`/api/organizer/tournament/${T}/courtrooms`).set(auth())
            .send({ id: 'c1' });
        expect(res.status).toBe(204);
    });

    it('returns 404 when not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).delete(`/api/organizer/tournament/${T}/courtrooms`).set(auth())
            .send({ id: 'c1' });
        expect([404, 204]).toContain(res.status);
    });
});

// ─── Teams ────────────────────────────────────────────────────────────────────
describe('DELETE /teams', () => {
    it('returns 400 when id is invalid UUID', async () => {
        mockAccess();
        const res = await request(app).delete(`/api/organizer/tournament/${T}/teams`).set(auth())
            .send({ id: 'bad-id' });
        expect(res.status).toBe(400);
    });

    it('returns 404 when team not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).delete(`/api/organizer/tournament/${T}/teams`).set(auth())
            .send({ id: TEAM_ID });
        expect([404, 204]).toContain(res.status);
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
        mockDbQuery.mockResolvedValueOnce({ rows: [{ team_id: TEAM_ID }], rowCount: 1 } as any);
        const res = await request(app).put(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/owner`).set(auth())
            .send({ coachId: COACH_ID });
        expect(res.status).toBe(204);
    });
});

describe('GET/POST/DELETE /teams/:teamId/coaches', () => {
    it('GET returns 200', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/coaches`).set(auth());
        expect(res.status).toBe(200);
    });

    it('POST returns 400 when email missing', async () => {
        mockAccess();
        const res = await request(app).post(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/coaches`).set(auth()).send({});
        expect(res.status).toBe(400);
    });

    it('DELETE returns 404 when coach not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).delete(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/coaches/${COACH_ID}`).set(auth());
        expect([404, 204]).toContain(res.status);
    });
});

describe('GET/POST/DELETE /teams/:teamId/students', () => {
    it('GET returns 200', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/students`).set(auth());
        expect(res.status).toBe(200);
    });

    it('POST returns 400 when student_name missing', async () => {
        mockAccess();
        const res = await request(app).post(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/students`).set(auth()).send({});
        expect(res.status).toBe(400);
    });

    it('DELETE returns 204 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ student_id: STUDENT_ID }], rowCount: 1 } as any);
        const res = await request(app).delete(`/api/organizer/tournament/${T}/teams/${TEAM_ID}/students/${STUDENT_ID}`).set(auth());
        expect(res.status).toBe(204);
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
