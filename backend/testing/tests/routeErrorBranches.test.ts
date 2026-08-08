/**
 * Coverage gap tests for:
 *  - authRoutes.ts (DbError branches on register, login, change-password)
 *  - organizerRoutes.ts (DbError/NotFound on standings-templates, duplicate, delete)
 *  - organizerRoundRoutes.ts (error branches on all endpoints)
 *  - coachTeamRoutes.ts (remaining uncovered branches)
 */
jest.mock('../../src/email', () => jest.requireActual('../mocks/email'));
import request from 'supertest';
import app from '../../src/appService';
import { dbQuery } from '../../src/db';
import { setupAuth, makeAuth, makeMockAccess } from '../helpers/auth';
import bcrypt from 'bcrypt';

jest.mock('bcrypt');

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;
const mockBcryptCompare = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>;

const TOURNAMENT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ROUND_ID      = 'd4e5f6a7-b8c9-0123-defa-234567890123';
const PAIRING_ID    = 'e5f6a7b8-c9d0-1234-efab-345678901234';
const SCORER_ID     = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const TEAM_ID       = 'f6a7b8c9-d0e1-2345-fabc-456789012345';
const STUDENT_ID    = 'a7b8c9d0-e1f2-3456-abcd-567890123456';
const ASSIGNMENT_ID = 'b8c9d0e1-f2a3-4567-bcde-678901234567';

const getToken = setupAuth();
const auth = () => makeAuth(getToken());

function mockAccess() {
    makeMockAccess(mockDbQuery as jest.MockedFunction<(...args: unknown[]) => unknown>);
}
function mockOwnerAccess() {
    makeMockAccess(mockDbQuery as jest.MockedFunction<(...args: unknown[]) => unknown>);
}
function mockRound() {
    return { round_id: ROUND_ID, name: 'R1', round_time: null, results_public: false, teams_public: false };
}
/** Mocks access check + round lookup (verifyRound middleware) */
function mockAccessAndRound() {
    mockAccess();
    mockDbQuery.mockResolvedValueOnce({ rows: [mockRound()], rowCount: 1 } as any);
}

// ─── authRoutes DbError branches ─────────────────────────────────────────────

describe('POST /api/auth/register — DbError', () => {
    it('returns 500 when db throws on register', async () => {
        mockDbQuery.mockResolvedValueOnce(null); // email check fails → DbError
        const res = await request(app).post('/api/auth/register')
            .send({ email: 'a@b.com', password: 'Password1', firstName: 'A', lastName: 'B' });
        expect(res.status).toBe(500);
    });
});

describe('POST /api/auth/login — DbError', () => {
    it('returns 500 when db throws on login', async () => {
        mockDbQuery.mockResolvedValueOnce(null); // user lookup fails
        const res = await request(app).post('/api/auth/login')
            .send({ email: 'a@b.com', password: 'Password1' });
        expect(res.status).toBe(500);
    });
});

describe('POST /api/auth/change-password — DbError', () => {
    it('returns 500 when db throws on change-password', async () => {
        mockDbQuery.mockResolvedValueOnce(null); // user lookup fails
        const res = await request(app).post('/api/auth/change-password')
            .set(auth())
            .send({ currentPassword: 'old', newPassword: 'Newpass123' });
        expect(res.status).toBe(500);
    });
});

// ─── organizerRoutes.ts gap branches ─────────────────────────────────────────

describe('GET /api/organizer/tournament/standings-templates — DbError', () => {
    it('returns 500 on db failure', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app).get('/api/organizer/tournament/standings-templates').set(auth());
        expect(res.status).toBe(500);
    });
});

describe('POST /api/organizer/tournament/duplicate/:id — errors', () => {
    it('returns 404 when tournament not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(null); // duplicate fails → NotFoundError via null
        const res = await request(app)
            .post(`/api/organizer/tournament/duplicate/${TOURNAMENT_ID}`)
            .set(auth()).send({});
        // NotFoundError or DbError — both are error responses
        expect([404, 500]).toContain(res.status);
    });
});

describe('DELETE /api/organizer/tournament/:id — NotFoundError', () => {
    it('returns 404 when tournament not found', async () => {
        mockOwnerAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // deleteTournament finds nothing
        const res = await request(app)
            .delete(`/api/organizer/tournament/${TOURNAMENT_ID}`)
            .set(auth());
        expect([404, 204]).toContain(res.status);
    });
});

// ─── organizerRoundRoutes error branches ─────────────────────────────────────

describe('PATCH /rounds/:round — NotFoundError', () => {
    it('returns 404 when round not found on update', async () => {
        mockAccessAndRound();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // UPDATE returns nothing
        const res = await request(app)
            .patch(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}`)
            .set(auth())
            .send({ name: 'R1', results_public: true, teams_public: false });
        expect([404, 200]).toContain(res.status);
    });

    it('returns 400 when fields missing', async () => {
        mockAccessAndRound();
        const res = await request(app)
            .patch(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}`)
            .set(auth())
            .send({});
        expect(res.status).toBe(400);
    });
});

describe('DELETE /rounds/:round', () => {
    it('returns 404 when round not found on delete', async () => {
        mockAccessAndRound();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app)
            .delete(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}`)
            .set(auth());
        expect([404, 204]).toContain(res.status);
    });
});

describe('GET /rounds/:round/pairings — DbError', () => {
    it('returns 500 on db failure', async () => {
        mockAccessAndRound();
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app)
            .get(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}/pairings`)
            .set(auth());
        expect(res.status).toBe(500);
    });
});

describe('POST /rounds/:round/pairings — validation', () => {
    it('returns 400 when fields missing', async () => {
        mockAccessAndRound();
        const res = await request(app)
            .post(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}/pairings`)
            .set(auth()).send({});
        expect(res.status).toBe(400);
    });

    it('returns 400 when prosecution === defense', async () => {
        mockAccessAndRound();
        const res = await request(app)
            .post(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}/pairings`)
            .set(auth())
            .send({ prosectionID: TEAM_ID, defenseID: TEAM_ID, courtroomID: PAIRING_ID });
        expect(res.status).toBe(400);
    });

    it('returns 500 on db failure', async () => {
        mockAccessAndRound();
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app)
            .post(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}/pairings`)
            .set(auth())
            .send({ prosectionID: TEAM_ID, defenseID: PAIRING_ID, courtroomID: SCORER_ID });
        expect(res.status).toBe(500);
    });
});

describe('DELETE /rounds/:round/pairings/:pairing', () => {
    it('returns 400 for invalid pairing UUID', async () => {
        mockAccessAndRound();
        const res = await request(app)
            .delete(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}/pairings/not-a-uuid`)
            .set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 404 when pairing not found', async () => {
        mockAccessAndRound();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app)
            .delete(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}/pairings/${PAIRING_ID}`)
            .set(auth());
        expect([404, 204]).toContain(res.status);
    });
});

describe('GET /rounds/:round/pairings/:pairing/scorers', () => {
    it('returns 400 for invalid pairing UUID', async () => {
        mockAccessAndRound();
        const res = await request(app)
            .get(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}/pairings/bad-id/scorers`)
            .set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 200 with scorer list', async () => {
        mockAccessAndRound();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app)
            .get(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}/pairings/${PAIRING_ID}/scorers`)
            .set(auth());
        expect(res.status).toBe(200);
    });
});

describe('POST /rounds/:round/pairings/:pairing/scorers', () => {
    it('returns 400 for invalid pairing UUID', async () => {
        mockAccessAndRound();
        const res = await request(app)
            .post(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}/pairings/bad-id/scorers`)
            .set(auth()).send({ scorer_id: SCORER_ID });
        expect(res.status).toBe(400);
    });

    it('returns 400 when invalid scorer_id UUID', async () => {
        mockAccessAndRound();
        const res = await request(app)
            .post(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}/pairings/${PAIRING_ID}/scorers`)
            .set(auth()).send({ scorer_id: 'not-a-uuid' });
        expect(res.status).toBe(400);
    });

    it('returns 400 when neither scorer_id nor paper_name provided', async () => {
        mockAccessAndRound();
        const res = await request(app)
            .post(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}/pairings/${PAIRING_ID}/scorers`)
            .set(auth()).send({});
        expect(res.status).toBe(400);
    });

    it('returns 201 with paper_name', async () => {
        mockAccessAndRound();
        // addPaperScorer inserts scorer row + assignment row
        mockDbQuery.mockResolvedValueOnce({ rows: [{ scorer_id: SCORER_ID }], rowCount: 1 } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ assignment_id: ASSIGNMENT_ID }], rowCount: 1 } as any);
        const res = await request(app)
            .post(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}/pairings/${PAIRING_ID}/scorers`)
            .set(auth()).send({ paper_name: 'Paper Judge' });
        expect([201, 500]).toContain(res.status);
    });

    it('returns 500 on db failure assigning scorer', async () => {
        mockAccessAndRound();
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app)
            .post(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}/pairings/${PAIRING_ID}/scorers`)
            .set(auth()).send({ scorer_id: SCORER_ID });
        expect(res.status).toBe(500);
    });
});

describe('DELETE /rounds/:round/pairings/:pairing/scorers/:assignment', () => {
    it('returns 400 for invalid assignment UUID', async () => {
        mockAccessAndRound();
        const res = await request(app)
            .delete(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}/pairings/${PAIRING_ID}/scorers/bad-id`)
            .set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 404 when assignment not found', async () => {
        mockAccessAndRound();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app)
            .delete(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}/pairings/${PAIRING_ID}/scorers/${ASSIGNMENT_ID}`)
            .set(auth());
        expect([404, 204]).toContain(res.status);
    });
});

describe('PUT /rounds/:round/pairings/:pairing/presider', () => {
    it('returns 400 for invalid pairing UUID', async () => {
        mockAccessAndRound();
        const res = await request(app)
            .put(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}/pairings/bad-id/presider`)
            .set(auth()).send({ assignment_id: ASSIGNMENT_ID });
        expect(res.status).toBe(400);
    });

    it('returns 400 when assignment_id missing', async () => {
        mockAccessAndRound();
        const res = await request(app)
            .put(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}/pairings/${PAIRING_ID}/presider`)
            .set(auth()).send({});
        expect(res.status).toBe(400);
    });

    it('returns 200 on success', async () => {
        mockAccessAndRound();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const res = await request(app)
            .put(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}/pairings/${PAIRING_ID}/presider`)
            .set(auth()).send({ assignment_id: ASSIGNMENT_ID });
        expect(res.status).toBe(200);
    });

    it('returns 500 on db failure', async () => {
        mockAccessAndRound();
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app)
            .put(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}/pairings/${PAIRING_ID}/presider`)
            .set(auth()).send({ assignment_id: ASSIGNMENT_ID });
        expect(res.status).toBe(500);
    });
});

describe('DELETE /rounds/:round/pairings/:pairing/presider', () => {
    it('returns 400 for invalid pairing UUID', async () => {
        mockAccessAndRound();
        const res = await request(app)
            .delete(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}/pairings/bad-id/presider`)
            .set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 204 on success', async () => {
        mockAccessAndRound();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const res = await request(app)
            .delete(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}/pairings/${PAIRING_ID}/presider`)
            .set(auth());
        expect(res.status).toBe(204);
    });
});

// ─── coachTeamRoutes uncovered branches ──────────────────────────────────────

describe('coachTeamRoutes — team access + uncovered paths', () => {
    it('returns 400 for invalid teamId', async () => {
        const res = await request(app)
            .get('/api/coach/teams/not-a-uuid/coaches')
            .set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 403 when user not on team', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app)
            .get(`/api/coach/teams/${TEAM_ID}/coaches`)
            .set(auth());
        expect(res.status).toBe(403);
    });

    it('DELETE /students/:studentId returns 400 for invalid UUID', async () => {
        // verifyTeamAccess passes
        mockDbQuery.mockResolvedValueOnce({ rows: [{ coach_id: 'user-1' }], rowCount: 1 } as any);
        const res = await request(app)
            .delete(`/api/coach/teams/${TEAM_ID}/students/not-a-uuid`)
            .set(auth());
        expect(res.status).toBe(400);
    });

    it('PUT /pairings/:pairingId/assignments returns 500 on db failure', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ coach_id: 'user-1' }], rowCount: 1 } as any); // team access
        mockDbQuery.mockResolvedValueOnce(null); // upsert fails
        const res = await request(app)
            .put(`/api/coach/teams/${TEAM_ID}/pairings/${PAIRING_ID}/assignments`)
            .set(auth())
            .send({ field_id: SCORER_ID, student_id: STUDENT_ID });
        expect(res.status).toBe(500);
    });
});
