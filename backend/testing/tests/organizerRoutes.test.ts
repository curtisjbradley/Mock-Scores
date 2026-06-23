
jest.mock('../../src/email', () => jest.requireActual('../mocks/email'));
import request from 'supertest';
import app from '../../src/appService';
import { dbQuery } from '../../src/db';
import { signToken } from '../../src/authUtils';

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;

const TOURNAMENT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const SCORER_ID     = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const ORG_ID        = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
const ROUND_ID      = 'd4e5f6a7-b8c9-0123-defa-234567890123';
const PAIRING_ID    = 'e5f6a7b8-c9d0-1234-efab-345678901234';

let token: string;

beforeAll(async () => {
    token = await signToken('user-1', 'test@test.com', 'Test', 'User');
});

beforeEach(() => jest.clearAllMocks());

/** Mock verifyUser session + verifyTournamentAccess ownership check */
function mockAccess() {
    mockDbQuery.mockResolvedValueOnce({ rows: [{ role: 'owner' }], rowCount: 1 } as any);
}

/** Mock verifyUser session + verifyTournamentOwner ownership check */
function mockOwnerAccess() {
    mockDbQuery.mockResolvedValueOnce({ rows: [{ role: 'owner' }], rowCount: 1 } as any);
}

const auth = () => ({ Authorization: `Bearer ${token}` });

// ─── GET /api/organizer/tournament/ ──────────────────────────────────────────
describe('GET /api/organizer/tournament/', () => {
    it('returns 401 with no token', async () => {
        const res = await request(app).get('/api/organizer/tournament/');
        expect(res.status).toBe(401);
    });

    it('returns 200 with tournaments list', async () => {
        const tournaments = [{ id: TOURNAMENT_ID, name: 'Test' }];
        mockDbQuery.mockResolvedValueOnce({ rows: tournaments, rowCount: 1 } as any);
        const res = await request(app).get('/api/organizer/tournament/').set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toEqual(tournaments);
    });

    it('returns 500 when getTournaments throws DbError', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app).get('/api/organizer/tournament/').set(auth());
        expect(res.status).toBe(500);
    });
});

// ─── POST /api/organizer/tournament/ ─────────────────────────────────────────
describe('POST /api/organizer/tournament/', () => {
    const payload = {
        tournament: { name: 'T', location: 'L', startDate: null, endDate: null },
        caseFormat: { caseName: 'C', criminalCase: false, pWitnessesCalled: 2, dWitnessesCalled: 2, hasSwing: false, pWitnessNames: [], dWitnessNames: [], swingWitnessNames: [] },
        scoringCategories: [],
        standingsConfigId: null,
    };

    it('returns 201 on success', async () => {
        const tournament = { id: TOURNAMENT_ID, name: 'T' };
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)       // format insert
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)       // tournament insert
            .mockResolvedValueOnce({ rows: [tournament], rowCount: 1 } as any) // SELECT tournament
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);      // addTournamentOrganizer
        const res = await request(app).post('/api/organizer/tournament/').set(auth()).send(payload);
        expect(res.status).toBe(201);
        expect(res.body.id).toBe(TOURNAMENT_ID);
    });

    it('returns 500 when createTournament fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null); // format insert fails
        const res = await request(app).post('/api/organizer/tournament/').set(auth()).send(payload);
        expect(res.status).toBe(500);
    });
});

// ─── DELETE /api/organizer/tournament/:tournamentId ───────────────────────────
describe('DELETE /api/organizer/tournament/:tournamentId', () => {
    it('returns 400 for invalid UUID', async () => {
        const res = await request(app).delete('/api/organizer/tournament/not-a-uuid').set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 204 on success', async () => {
        mockOwnerAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: TOURNAMENT_ID }], rowCount: 1 } as any);
        const res = await request(app).delete(`/api/organizer/tournament/${TOURNAMENT_ID}`).set(auth());
        expect(res.status).toBe(204);
    });

    it('returns 403 when not owner', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ role: 'delegate' }], rowCount: 1 } as any);
        const res = await request(app).delete(`/api/organizer/tournament/${TOURNAMENT_ID}`).set(auth());
        expect(res.status).toBe(403);
    });
});

// ─── GET /api/organizer/tournament/:tournamentId ──────────────────────────────
describe('GET /api/organizer/tournament/:tournamentId', () => {
    it('returns 403 when no tournament access', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/organizer/tournament/${TOURNAMENT_ID}`).set(auth());
        expect(res.status).toBe(403);
    });

    it('returns 200 with tournament data', async () => {
        mockAccess();
        const tournament = { id: TOURNAMENT_ID, name: 'Test' };
        mockDbQuery.mockResolvedValueOnce({ rows: [tournament], rowCount: 1 } as any);
        const res = await request(app).get(`/api/organizer/tournament/${TOURNAMENT_ID}`).set(auth());
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(TOURNAMENT_ID);
    });
});

// ─── GET /api/organizer/tournament/:tournamentId/scorers ──────────────────────
describe('GET /api/organizer/tournament/:tournamentId/scorers', () => {
    it('returns 200 with scorers', async () => {
        mockAccess();
        const scorers = [{ scorer_id: SCORER_ID, first_name: 'A', last_name: 'B', email: 'a@b.com' }];
        mockDbQuery.mockResolvedValueOnce({ rows: scorers, rowCount: 1 } as any);
        const res = await request(app).get(`/api/organizer/tournament/${TOURNAMENT_ID}/scorers`).set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toEqual(scorers);
    });
});

// ─── POST /api/organizer/tournament/:tournamentId/scorers ─────────────────────
describe('POST /api/organizer/tournament/:tournamentId/scorers', () => {
    const scorer = { scorer_id: SCORER_ID, first_name: 'A', last_name: 'B', email: 'a@b.com' };

    it('returns 409 when scorer fields missing', async () => {
        mockAccess();
        const res = await request(app).post(`/api/organizer/tournament/${TOURNAMENT_ID}/scorers`).set(auth()).send({ email: 'a@b.com' });
        expect(res.status).toBe(409);
    });

    it('returns 200 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const res = await request(app).post(`/api/organizer/tournament/${TOURNAMENT_ID}/scorers`).set(auth()).send(scorer);
        expect(res.status).toBe(200);
    });
});

// ─── DELETE /api/organizer/tournament/:tournamentId/scorers ───────────────────
describe('DELETE /api/organizer/tournament/:tournamentId/scorers', () => {
    it('returns 400 when scorer_id missing', async () => {
        mockAccess();
        const res = await request(app).delete(`/api/organizer/tournament/${TOURNAMENT_ID}/scorers`).set(auth()).send({});
        expect(res.status).toBe(400);
    });

    it('returns 204 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ scorer_id: SCORER_ID }], rowCount: 1 } as any);
        const res = await request(app).delete(`/api/organizer/tournament/${TOURNAMENT_ID}/scorers`).set(auth()).send({ scorer_id: SCORER_ID });
        expect(res.status).toBe(204);
    });
});

// ─── GET /api/organizer/tournament/:tournamentId/organizers ───────────────────
describe('GET /api/organizer/tournament/:tournamentId/organizers', () => {
    it('returns 200 with organizers', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // active
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // invited
        const res = await request(app).get(`/api/organizer/tournament/${TOURNAMENT_ID}/organizers`).set(auth());
        expect(res.status).toBe(200);
    });
});

// ─── POST /api/organizer/tournament/:tournamentId/organizers ──────────────────
describe('POST /api/organizer/tournament/:tournamentId/organizers', () => {
    it('returns 400 when organizer fields missing', async () => {
        mockAccess();
        const res = await request(app).post(`/api/organizer/tournament/${TOURNAMENT_ID}/organizers`).set(auth()).send({ organizer: { name: 'Bob' } });
        expect(res.status).toBe(400);
    });

    it('returns 201 on success (new invite)', async () => {
        mockAccess();
        const inviteRow = { id: ORG_ID, tournament_id: TOURNAMENT_ID, name: 'Bob', email: 'b@c.com' };
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)           // SELECT auth (user not found)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)           // SELECT duplicate invite check
            .mockResolvedValueOnce({ rows: [inviteRow], rowCount: 1 } as any)  // INSERT invite
            .mockResolvedValueOnce({ rows: [{ tournament_id: TOURNAMENT_ID, name: 'Test Tournament' }], rowCount: 1 } as any); // getTournament (email)
        const res = await request(app)
            .post(`/api/organizer/tournament/${TOURNAMENT_ID}/organizers`)
            .set(auth())
            .send({ organizer: { name: 'Bob', email: 'b@c.com', role: 'delegate' } });
        await new Promise(setImmediate);
        expect(res.status).toBe(201);
    });
});

// ─── DELETE /api/organizer/tournament/:tournamentId/organizers ────────────────
describe('DELETE /api/organizer/tournament/:tournamentId/organizers', () => {
    it('returns 400 when id missing', async () => {
        mockAccess();
        const res = await request(app)
            .delete(`/api/organizer/tournament/${TOURNAMENT_ID}/organizers`)
            .set(auth())
            .send({ organizer: { name: 'Bob', email: 'b@c.com', role: 'delegate' } });
        expect(res.status).toBe(400);
    });

    it('returns 204 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: ORG_ID }], rowCount: 1 } as any);
        const res = await request(app)
            .delete(`/api/organizer/tournament/${TOURNAMENT_ID}/organizers`)
            .set(auth())
            .send({ organizer: { id: ORG_ID, name: 'Bob', email: 'b@c.com', role: 'delegate', has_joined: false } });
        expect(res.status).toBe(204);
    });
});

// ─── GET /api/organizer/tournament/:tournamentId/courtrooms ───────────────────
describe('GET /api/organizer/tournament/:tournamentId/courtrooms', () => {
    it('returns 200 with courtrooms', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'c1', name: 'Room 1' }], rowCount: 1 } as any);
        const res = await request(app).get(`/api/organizer/tournament/${TOURNAMENT_ID}/courtrooms`).set(auth());
        expect(res.status).toBe(200);
    });
});

// ─── POST /api/organizer/tournament/:tournamentId/courtrooms ──────────────────
describe('POST /api/organizer/tournament/:tournamentId/courtrooms', () => {
    it('returns 400 when name missing', async () => {
        mockAccess();
        const res = await request(app).post(`/api/organizer/tournament/${TOURNAMENT_ID}/courtrooms`).set(auth()).send({});
        expect(res.status).toBe(400);
    });

    it('returns 201 on success', async () => {
        mockAccess();
        const row = { id: 'c1', tournament_id: TOURNAMENT_ID, name: 'Room 1', location: null };
        mockDbQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);
        const res = await request(app).post(`/api/organizer/tournament/${TOURNAMENT_ID}/courtrooms`).set(auth()).send({ id: 'c1', name: 'Room 1' });
        expect(res.status).toBe(201);
    });
});

// ─── GET /api/organizer/tournament/:tournamentId/rounds ───────────────────────
describe('GET /api/organizer/tournament/:tournamentId/rounds', () => {
    it('returns 200 with rounds', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds`).set(auth());
        expect(res.status).toBe(200);
    });
});

// ─── POST /api/organizer/tournament/:tournamentId/rounds ──────────────────────
describe('POST /api/organizer/tournament/:tournamentId/rounds', () => {
    it('returns 201 on success', async () => {
        mockAccess();
        const round = { round_id: ROUND_ID, name: 'Round 1', round_time: null, results_public: false, teams_public: false };
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ num_rounds: '0' }], rowCount: 1 } as any) // COUNT
            .mockResolvedValueOnce({ rows: [round], rowCount: 1 } as any);              // INSERT
        const res = await request(app).post(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds`).set(auth());
        expect(res.status).toBe(201);
    });
});

// ─── GET /api/organizer/tournament/:tournamentId/teams ────────────────────────
describe('GET /api/organizer/tournament/:tournamentId/teams', () => {
    it('returns 200 with teams', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // joined
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // invited
        const res = await request(app).get(`/api/organizer/tournament/${TOURNAMENT_ID}/teams`).set(auth());
        expect(res.status).toBe(200);
    });
});

// ─── POST /api/organizer/tournament/:tournamentId/teams ───────────────────────
describe('POST /api/organizer/tournament/:tournamentId/teams', () => {
    it('returns 400 when team fields missing', async () => {
        mockAccess();
        const res = await request(app).post(`/api/organizer/tournament/${TOURNAMENT_ID}/teams`).set(auth()).send({ team: { name: 'Eagles' } });
        expect(res.status).toBe(400);
    });

    it('returns 409 when team name already exists', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'existing' }], rowCount: 1 } as any); // teamNameExists
        const res = await request(app).post(`/api/organizer/tournament/${TOURNAMENT_ID}/teams`).set(auth()).send({ team: { name: 'Eagles', coach_email: 'c@d.com' } });
        expect(res.status).toBe(409);
    });

    it('returns 201 on success', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)  // teamNameExists
            .mockResolvedValueOnce({ rows: [{ id: 'team1', tournament_id: TOURNAMENT_ID, name: 'Eagles', code: 'Eagles' }], rowCount: 1 } as any) // INSERT team
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // SELECT auth (no user → invite)
        const res = await request(app).post(`/api/organizer/tournament/${TOURNAMENT_ID}/teams`).set(auth()).send({ team: { name: 'Eagles', coach_email: 'c@d.com' } });
        expect(res.status).toBe(201);
    });
});

// ─── GET /api/organizer/tournament/standings-templates ───────────────────────
describe('GET /api/organizer/tournament/standings-templates', () => {
    it('returns 200 with templates', async () => {
        const templates = [{ id: 'st1', label: 'Default', description: 'Desc', config_id: 'cfg1' }];
        mockDbQuery.mockResolvedValueOnce({ rows: templates, rowCount: 1 } as any);
        const res = await request(app).get('/api/organizer/tournament/standings-templates').set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toEqual(templates);
    });
});

// ─── PATCH /api/organizer/tournament/:tournamentId ────────────────────────────
describe('PATCH /api/organizer/tournament/:tournamentId', () => {
    it('returns 400 when tournament body missing', async () => {
        mockAccess();
        const res = await request(app).patch(`/api/organizer/tournament/${TOURNAMENT_ID}`).set(auth()).send({});
        expect(res.status).toBe(400);
    });

    it('returns 200 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: TOURNAMENT_ID }], rowCount: 1 } as any);
        const res = await request(app).patch(`/api/organizer/tournament/${TOURNAMENT_ID}`).set(auth()).send({ tournament: { name: 'Updated', location: 'L', startDate: null, endDate: null } });
        expect(res.status).toBe(200);
    });
});

// ─── GET /api/organizer/tournament/:tournamentId/format ───────────────────────
describe('GET /api/organizer/tournament/:tournamentId/format', () => {
    it('returns 200 with format', async () => {
        mockAccess();
        const format = { caseName: 'C', criminalCase: false, pWitnessesCalled: 2, dWitnessesCalled: 2 };
        mockDbQuery.mockResolvedValueOnce({ rows: [format], rowCount: 1 } as any);
        const res = await request(app).get(`/api/organizer/tournament/${TOURNAMENT_ID}/format`).set(auth());
        expect(res.status).toBe(200);
    });

    it('returns 404 when format not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/organizer/tournament/${TOURNAMENT_ID}/format`).set(auth());
        expect(res.status).toBe(404);
    });
});

// ─── PATCH /api/organizer/tournament/:tournamentId/format ─────────────────────
describe('PATCH /api/organizer/tournament/:tournamentId/format', () => {
    it('returns 400 when witnesses called is negative', async () => {
        mockAccess();
        const res = await request(app).patch(`/api/organizer/tournament/${TOURNAMENT_ID}/format`).set(auth()).send({ pWitnessesCalled: -1 });
        expect(res.status).toBe(400);
    });

    it('returns 200 on success', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ case_format_id: 'fmt1' }], rowCount: 1 } as any) // SELECT formatID
            .mockResolvedValueOnce({ rows: [{ id: TOURNAMENT_ID }], rowCount: 1 } as any);     // UPDATE
        const res = await request(app).patch(`/api/organizer/tournament/${TOURNAMENT_ID}/format`).set(auth()).send({ caseName: 'C', criminalCase: false });
        expect(res.status).toBe(200);
    });
});

// ─── GET /api/organizer/tournament/:tournamentId/witnesses ────────────────────
describe('GET /api/organizer/tournament/:tournamentId/witnesses', () => {
    it('returns 200 with witnesses', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ case_format_id: 'fmt1' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [{ side: 'P', name: 'Alice' }, { side: 'D', name: 'Bob' }], rowCount: 2 } as any);
        const res = await request(app).get(`/api/organizer/tournament/${TOURNAMENT_ID}/witnesses`).set(auth());
        expect(res.status).toBe(200);
    });

    it('returns 404 when witnesses not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/organizer/tournament/${TOURNAMENT_ID}/witnesses`).set(auth());
        expect(res.status).toBe(404);
    });
});

// ─── PATCH /api/organizer/tournament/:tournamentId/witnesses ──────────────────
describe('PATCH /api/organizer/tournament/:tournamentId/witnesses', () => {
    it('returns 400 when witness name is empty', async () => {
        mockAccess();
        const res = await request(app).patch(`/api/organizer/tournament/${TOURNAMENT_ID}/witnesses`).set(auth()).send({ pWitnessNames: [''], dWitnessNames: [], swingWitnessNames: [] });
        expect(res.status).toBe(400);
    });

    it('returns 200 on success', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ case_format_id: 'fmt1' }], rowCount: 1 } as any) // SELECT formatID
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)                           // DELETE witnesses
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)                           // INSERT Alice
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);                          // INSERT Bob
        const res = await request(app).patch(`/api/organizer/tournament/${TOURNAMENT_ID}/witnesses`).set(auth()).send({ pWitnessNames: ['Alice'], dWitnessNames: ['Bob'], swingWitnessNames: [] });
        expect(res.status).toBe(200);
    });
});

// ─── GET /api/organizer/tournament/:tournamentId/standings-config ─────────────
describe('GET /api/organizer/tournament/:tournamentId/standings-config', () => {
    it('returns 200 with config', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ statsXml: '<x/>', standingsXml: '<y/>' }], rowCount: 1 } as any);
        const res = await request(app).get(`/api/organizer/tournament/${TOURNAMENT_ID}/standings-config`).set(auth());
        expect(res.status).toBe(200);
    });
});

// ─── PATCH /api/organizer/tournament/:tournamentId/standings-config ───────────
describe('PATCH /api/organizer/tournament/:tournamentId/standings-config', () => {
    it('returns 400 when statsXml or standingsXml missing', async () => {
        mockAccess();
        const res = await request(app).patch(`/api/organizer/tournament/${TOURNAMENT_ID}/standings-config`).set(auth()).send({ statsXml: '<x/>' });
        expect(res.status).toBe(400);
    });

    it('returns 200 on success', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ standings_config_id: null }], rowCount: 1 } as any) // SELECT existing config
            .mockResolvedValueOnce({ rows: [{ id: 'cfg1' }], rowCount: 1 } as any)               // INSERT config
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);                             // UPDATE tournament
        const res = await request(app).patch(`/api/organizer/tournament/${TOURNAMENT_ID}/standings-config`).set(auth()).send({ statsXml: '<x/>', standingsXml: '<y/>' });
        expect(res.status).toBe(200);
    });
});

// ─── GET /api/organizer/tournament/:tournamentId/scoring-categories ───────────
describe('GET /api/organizer/tournament/:tournamentId/scoring-categories', () => {
    it('returns 200 with categories', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/organizer/tournament/${TOURNAMENT_ID}/scoring-categories`).set(auth());
        expect(res.status).toBe(200);
    });
});

// ─── PATCH /api/organizer/tournament/:tournamentId/scoring-categories ─────────
describe('PATCH /api/organizer/tournament/:tournamentId/scoring-categories', () => {
    it('returns 200 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: TOURNAMENT_ID }], rowCount: 1 } as any);
        const res = await request(app).patch(`/api/organizer/tournament/${TOURNAMENT_ID}/scoring-categories`).set(auth()).send([]);
        expect(res.status).toBe(200);
    });
});

// ─── PUT /api/organizer/tournament/:tournamentId/scorers ──────────────────────
describe('PUT /api/organizer/tournament/:tournamentId/scorers', () => {
    const scorer = { scorer_id: SCORER_ID, first_name: 'A', last_name: 'B', email: 'a@b.com' };

    it('returns 409 when scorer fields missing', async () => {
        mockAccess();
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/scorers`).set(auth()).send({ email: 'a@b.com' });
        expect(res.status).toBe(409);
    });

    it('returns 200 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [scorer], rowCount: 1 } as any);
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/scorers`).set(auth()).send(scorer);
        expect(res.status).toBe(200);
    });
});

// ─── PUT /api/organizer/tournament/:tournamentId/organizers ───────────────────
describe('PUT /api/organizer/tournament/:tournamentId/organizers', () => {
    it('returns 400 when id missing', async () => {
        mockAccess();
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/organizers`).set(auth()).send({ organizer: { name: 'Bob', email: 'b@c.com', role: 'delegate' } });
        expect(res.status).toBe(400);
    });

    it('returns 400 when id is invalid UUID', async () => {
        mockAccess();
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/organizers`).set(auth()).send({ organizer: { id: 'not-a-uuid', name: 'Bob', email: 'b@c.com', role: 'delegate' } });
        expect(res.status).toBe(400);
    });

    it('returns 200 on success', async () => {
        mockAccess();
        const updated = { id: ORG_ID, name: 'Bob', email: 'b@c.com', role: 'delegate' };
        mockDbQuery.mockResolvedValueOnce({ rows: [updated], rowCount: 1 } as any);
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/organizers`).set(auth()).send({ organizer: { id: ORG_ID, name: 'Bob', email: 'b@c.com', role: 'delegate' } });
        expect(res.status).toBe(200);
    });
});

// ─── PUT /api/organizer/tournament/:tournamentId/courtrooms ───────────────────
describe('PUT /api/organizer/tournament/:tournamentId/courtrooms', () => {
    it('returns 400 when id or name missing', async () => {
        mockAccess();
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/courtrooms`).set(auth()).send({ name: 'Room 1' });
        expect(res.status).toBe(400);
    });

    it('returns 200 on success', async () => {
        mockAccess();
        const row = { id: 'c1', tournament_id: TOURNAMENT_ID, name: 'Room 1', location: null };
        mockDbQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/courtrooms`).set(auth()).send({ id: 'c1', name: 'Room 1' });
        expect(res.status).toBe(200);
    });
});

// ─── DELETE /api/organizer/tournament/:tournamentId/courtrooms ────────────────
describe('DELETE /api/organizer/tournament/:tournamentId/courtrooms', () => {
    it('returns 400 when id missing', async () => {
        mockAccess();
        const res = await request(app).delete(`/api/organizer/tournament/${TOURNAMENT_ID}/courtrooms`).set(auth()).send({});
        expect(res.status).toBe(400);
    });

    it('returns 204 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'c1' }], rowCount: 1 } as any);
        const res = await request(app).delete(`/api/organizer/tournament/${TOURNAMENT_ID}/courtrooms`).set(auth()).send({ id: 'c1' });
        expect(res.status).toBe(204);
    });
});

// ─── PUT /api/organizer/tournament/:tournamentId/teams ────────────────────────
describe('PUT /api/organizer/tournament/:tournamentId/teams', () => {
    it('returns 400 when id missing', async () => {
        mockAccess();
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/teams`).set(auth()).send({ team: { name: 'Eagles', coach_email: 'c@d.com' } });
        expect(res.status).toBe(400);
    });

    it('returns 400 when id is invalid UUID', async () => {
        mockAccess();
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/teams`).set(auth()).send({ team: { id: 'bad-id', name: 'Eagles', coach_email: 'c@d.com' } });
        expect(res.status).toBe(400);
    });

    it('returns 200 on success', async () => {
        mockAccess();
        const teamId = 'f6a7b8c9-d0e1-2345-fabc-456789012345';
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // teamNameExists
            .mockResolvedValueOnce({ rows: [{ id: teamId, name: 'Eagles' }], rowCount: 1 } as any); // updateTeam
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/teams`).set(auth()).send({ team: { id: teamId, name: 'Eagles', coach_email: 'c@d.com' } });
        expect(res.status).toBe(200);
    });
});

// ─── DELETE /api/organizer/tournament/:tournamentId/teams ─────────────────────
describe('DELETE /api/organizer/tournament/:tournamentId/teams', () => {
    it('returns 400 when id missing', async () => {
        mockAccess();
        const res = await request(app).delete(`/api/organizer/tournament/${TOURNAMENT_ID}/teams`).set(auth()).send({});
        expect(res.status).toBe(400);
    });

    it('returns 400 when id is invalid UUID', async () => {
        mockAccess();
        const res = await request(app).delete(`/api/organizer/tournament/${TOURNAMENT_ID}/teams`).set(auth()).send({ id: 'bad-id' });
        expect(res.status).toBe(400);
    });

    it('returns 204 on success', async () => {
        mockAccess();
        const teamId = 'f6a7b8c9-d0e1-2345-fabc-456789012345';
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: teamId }], rowCount: 1 } as any);
        const res = await request(app).delete(`/api/organizer/tournament/${TOURNAMENT_ID}/teams`).set(auth()).send({ id: teamId });
        expect(res.status).toBe(204);
    });
});

// ─── POST /api/organizer/tournament/duplicate/:tournamentId ───────────────────
describe('POST /api/organizer/tournament/duplicate/:tournamentId', () => {
    it('returns 400 for invalid UUID', async () => {
        const res = await request(app).post('/api/organizer/tournament/duplicate/not-a-uuid').set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 201 on success', async () => {
        mockAccess();
        const sourceTournament = { id: TOURNAMENT_ID, name: 'Test', case_format_id: 'fmt1' };
        const newTournament = { id: 'new1d000-0000-0000-0000-000000000000', name: 'Test (copy)' };
        mockDbQuery
            .mockResolvedValueOnce({ rows: [sourceTournament], rowCount: 1 } as any) // getTournament
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)                 // INSERT format
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)                 // INSERT tournament
            .mockResolvedValueOnce({ rows: [newTournament], rowCount: 1 } as any)    // SELECT new tournament
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);                // addTournamentOrganizer
        const res = await request(app).post(`/api/organizer/tournament/duplicate/${TOURNAMENT_ID}`).set(auth()).send({});
        expect(res.status).toBe(201);
    });

    it('returns 404 when source tournament not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // getTournament throws NotFoundError
        const res = await request(app).post(`/api/organizer/tournament/duplicate/${TOURNAMENT_ID}`).set(auth()).send({});
        expect(res.status).toBe(404);
    });

    it('returns 201 with scorers option', async () => {
        mockAccess();
        const source = { id: TOURNAMENT_ID, name: 'Test', case_format_id: 'fmt1' };
        const newT = { id: 'new1d000-0000-0000-0000-000000000000', name: 'Test (copy)' };
        mockDbQuery
            .mockResolvedValueOnce({ rows: [source], rowCount: 1 } as any)  // getTournament
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)         // INSERT format
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)         // INSERT tournament
            .mockResolvedValueOnce({ rows: [{ scorer_id: 's1', first_name: 'A', last_name: 'B', email: 'a@b.com' }], rowCount: 1 } as any) // SELECT scorers
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)         // INSERT scorer
            .mockResolvedValueOnce({ rows: [newT], rowCount: 1 } as any)     // SELECT new tournament
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);        // addTournamentOrganizer
        const res = await request(app).post(`/api/organizer/tournament/duplicate/${TOURNAMENT_ID}`).set(auth()).send({ scorers: true });
        expect(res.status).toBe(201);
    });

    it('returns 201 with courtrooms option', async () => {
        mockAccess();
        const source = { id: TOURNAMENT_ID, name: 'Test', case_format_id: 'fmt1' };
        const newT = { id: 'new1d000-0000-0000-0000-000000000000', name: 'Test (copy)' };
        mockDbQuery
            .mockResolvedValueOnce({ rows: [source], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)         // INSERT format
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)         // INSERT tournament
            .mockResolvedValueOnce({ rows: [{ name: 'Room 1', location: null }], rowCount: 1 } as any) // SELECT courtrooms
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)         // INSERT courtroom
            .mockResolvedValueOnce({ rows: [newT], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const res = await request(app).post(`/api/organizer/tournament/duplicate/${TOURNAMENT_ID}`).set(auth()).send({ courtrooms: true });
        expect(res.status).toBe(201);
    });

    it('returns 201 with witnesses option', async () => {
        mockAccess();
        const source = { id: TOURNAMENT_ID, name: 'Test', case_format_id: 'fmt1' };
        const newT = { id: 'new1d000-0000-0000-0000-000000000000', name: 'Test (copy)' };
        mockDbQuery
            .mockResolvedValueOnce({ rows: [source], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [{ case_name: 'C', criminal_case: false, p_witnesses_called: 2, d_witnesses_called: 2, has_swing: false }], rowCount: 1 } as any) // SELECT format
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)         // INSERT format
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)         // INSERT tournament
            .mockResolvedValueOnce({ rows: [{ side: 'P', name: 'W1' }], rowCount: 1 } as any) // SELECT witnesses
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)         // INSERT witness
            .mockResolvedValueOnce({ rows: [newT], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const res = await request(app).post(`/api/organizer/tournament/duplicate/${TOURNAMENT_ID}`).set(auth()).send({ witnesses: true });
        expect(res.status).toBe(201);
    });
});

// ─── Round sub-routes ─────────────────────────────────────────────────────────
// Helper: mock access + round lookup
function mockRoundAccess(round: object) {
    mockAccess();
    mockDbQuery.mockResolvedValueOnce({ rows: [round], rowCount: 1 } as any);
}

const ROUND_BASE = { round_id: ROUND_ID, name: 'Round 1', round_time: null, results_public: false, teams_public: false };
const ROUND_URL = `/api/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}`;

describe('GET /api/organizer/tournament/:tournamentId/rounds/:round', () => {
    it('returns 400 for invalid round UUID', async () => {
        mockAccess();
        const res = await request(app).get(`/api/organizer/tournament/${TOURNAMENT_ID}/rounds/bad-uuid`).set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 404 when round not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(ROUND_URL).set(auth());
        expect(res.status).toBe(404);
    });

    it('returns 200 with round data', async () => {
        mockRoundAccess(ROUND_BASE);
        const res = await request(app).get(ROUND_URL).set(auth());
        expect(res.status).toBe(200);
        expect(res.body.round_id).toBe(ROUND_ID);
    });
});

describe('PATCH /api/organizer/tournament/:tournamentId/rounds/:round', () => {
    it('returns 400 when required fields missing', async () => {
        mockRoundAccess(ROUND_BASE);
        const res = await request(app).patch(ROUND_URL).set(auth()).send({ name: 'R1' });
        expect(res.status).toBe(400);
    });

    it('returns 200 on success', async () => {
        mockRoundAccess(ROUND_BASE);
        mockDbQuery.mockResolvedValueOnce({ rows: [ROUND_BASE], rowCount: 1 } as any);
        const res = await request(app).patch(ROUND_URL).set(auth()).send({ name: 'R1', results_public: false, teams_public: false });
        expect(res.status).toBe(200);
    });
});

describe('DELETE /api/organizer/tournament/:tournamentId/rounds/:round', () => {
    it('returns 204 on success', async () => {
        mockRoundAccess(ROUND_BASE);
        mockDbQuery.mockResolvedValueOnce({ rows: [ROUND_BASE], rowCount: 1 } as any);
        const res = await request(app).delete(ROUND_URL).set(auth());
        expect(res.status).toBe(204);
    });
});

// ─── Pairings ─────────────────────────────────────────────────────────────────
const PAIRINGS_URL = `${ROUND_URL}/pairings`;
const TEAM_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TEAM_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const COURTROOM_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

describe('GET /api/organizer/tournament/:tournamentId/rounds/:round/pairings', () => {
    it('returns 200 with pairings', async () => {
        mockRoundAccess(ROUND_BASE);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(PAIRINGS_URL).set(auth());
        expect(res.status).toBe(200);
    });
});

describe('POST /api/organizer/tournament/:tournamentId/rounds/:round/pairings', () => {
    it('returns 400 when fields missing', async () => {
        mockRoundAccess(ROUND_BASE);
        const res = await request(app).post(PAIRINGS_URL).set(auth()).send({ prosectionID: TEAM_A });
        expect(res.status).toBe(400);
    });

    it('returns 400 when prosecution and defense are the same team', async () => {
        mockRoundAccess(ROUND_BASE);
        const res = await request(app).post(PAIRINGS_URL).set(auth()).send({ prosectionID: TEAM_A, defenseID: TEAM_A, courtroomID: COURTROOM_ID });
        expect(res.status).toBe(400);
    });

    it('returns 201 on success', async () => {
        mockRoundAccess(ROUND_BASE);
        const pairing = { id: PAIRING_ID, round_id: ROUND_ID };
        mockDbQuery.mockResolvedValueOnce({ rows: [pairing], rowCount: 1 } as any);
        const res = await request(app).post(PAIRINGS_URL).set(auth()).send({ prosectionID: TEAM_A, defenseID: TEAM_B, courtroomID: COURTROOM_ID });
        expect(res.status).toBe(201);
    });

    it('returns 409 when prosecution team already assigned this round', async () => {
        mockRoundAccess(ROUND_BASE);
        const err = Object.assign(new Error(), { detail: 'Key (round_id, p_team)=(r1, team1) already exists.' });
        mockDbQuery.mockRejectedValueOnce(err);
        const res = await request(app).post(PAIRINGS_URL).set(auth()).send({ prosectionID: TEAM_A, defenseID: TEAM_B, courtroomID: COURTROOM_ID });
        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/prosecution/i);
    });

    it('returns 409 when defense team already assigned this round', async () => {
        mockRoundAccess(ROUND_BASE);
        const err = Object.assign(new Error(), { detail: 'Key (round_id, d_team)=(r1, team2) already exists.' });
        mockDbQuery.mockRejectedValueOnce(err);
        const res = await request(app).post(PAIRINGS_URL).set(auth()).send({ prosectionID: TEAM_A, defenseID: TEAM_B, courtroomID: COURTROOM_ID });
        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/defense/i);
    });
});

describe('DELETE /api/organizer/tournament/:tournamentId/rounds/:round/pairings/:pairing', () => {
    it('returns 400 for invalid pairing UUID', async () => {
        mockRoundAccess(ROUND_BASE);
        const res = await request(app).delete(`${PAIRINGS_URL}/bad-uuid`).set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 204 on success', async () => {
        mockRoundAccess(ROUND_BASE);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: PAIRING_ID }], rowCount: 1 } as any);
        const res = await request(app).delete(`${PAIRINGS_URL}/${PAIRING_ID}`).set(auth());
        expect(res.status).toBe(204);
    });
});

// ─── Pairing scorers ──────────────────────────────────────────────────────────
const SCORER_ASSIGN_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

describe('GET /api/organizer/tournament/:tournamentId/rounds/:round/pairings/:pairing/scorers', () => {
    it('returns 200 with scorers', async () => {
        mockRoundAccess(ROUND_BASE);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`${PAIRINGS_URL}/${PAIRING_ID}/scorers`).set(auth());
        expect(res.status).toBe(200);
    });
});

describe('POST /api/organizer/tournament/:tournamentId/rounds/:round/pairings/:pairing/scorers', () => {
    it('returns 400 when neither scorer_id nor paper_name provided', async () => {
        mockRoundAccess(ROUND_BASE);
        const res = await request(app).post(`${PAIRINGS_URL}/${PAIRING_ID}/scorers`).set(auth()).send({});
        expect(res.status).toBe(400);
    });

    it('returns 201 when assigning by scorer_id', async () => {
        mockRoundAccess(ROUND_BASE);
        const assignment = { id: SCORER_ASSIGN_ID, pairing_id: PAIRING_ID, scorer_id: SCORER_ID };
        mockDbQuery.mockResolvedValueOnce({ rows: [assignment], rowCount: 1 } as any);
        const res = await request(app).post(`${PAIRINGS_URL}/${PAIRING_ID}/scorers`).set(auth()).send({ scorer_id: SCORER_ID });
        expect(res.status).toBe(201);
    });

    it('returns 201 when assigning by paper_name', async () => {
        mockRoundAccess(ROUND_BASE);
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ scorer_id: 'ps-id-000-0000-0000-000000000000' }], rowCount: 1 } as any) // INSERT paper_scorers
            .mockResolvedValueOnce({ rows: [{ assignment_id: SCORER_ASSIGN_ID, scorer_id: 'ps-id-000-0000-0000-000000000000' }], rowCount: 1 } as any); // INSERT assignment
        const res = await request(app).post(`${PAIRINGS_URL}/${PAIRING_ID}/scorers`).set(auth()).send({ paper_name: 'Judge Smith' });
        expect(res.status).toBe(201);
    });
});

describe('DELETE /api/organizer/tournament/:tournamentId/rounds/:round/pairings/:pairing/scorers/:assignment', () => {
    it('returns 400 for invalid assignment UUID', async () => {
        mockRoundAccess(ROUND_BASE);
        const res = await request(app).delete(`${PAIRINGS_URL}/${PAIRING_ID}/scorers/bad-uuid`).set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 204 on success', async () => {
        mockRoundAccess(ROUND_BASE);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: SCORER_ASSIGN_ID }], rowCount: 1 } as any);
        const res = await request(app).delete(`${PAIRINGS_URL}/${PAIRING_ID}/scorers/${SCORER_ASSIGN_ID}`).set(auth());
        expect(res.status).toBe(204);
    });
});

// ─── Presider ─────────────────────────────────────────────────────────────────
describe('PUT /api/organizer/tournament/:tournamentId/rounds/:round/pairings/:pairing/presider', () => {
    it('returns 400 when assignment_id missing', async () => {
        mockRoundAccess(ROUND_BASE);
        const res = await request(app).put(`${PAIRINGS_URL}/${PAIRING_ID}/presider`).set(auth()).send({});
        expect(res.status).toBe(400);
    });

    it('returns 400 when assignment_id is invalid UUID', async () => {
        mockRoundAccess(ROUND_BASE);
        const res = await request(app).put(`${PAIRINGS_URL}/${PAIRING_ID}/presider`).set(auth()).send({ assignment_id: 'bad-uuid' });
        expect(res.status).toBe(400);
    });

    it('returns 200 on success', async () => {
        mockRoundAccess(ROUND_BASE);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: PAIRING_ID }], rowCount: 1 } as any);
        const res = await request(app).put(`${PAIRINGS_URL}/${PAIRING_ID}/presider`).set(auth()).send({ assignment_id: SCORER_ASSIGN_ID });
        expect(res.status).toBe(200);
    });
});

describe('DELETE /api/organizer/tournament/:tournamentId/rounds/:round/pairings/:pairing/presider', () => {
    it('returns 204 on success', async () => {
        mockRoundAccess(ROUND_BASE);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).delete(`${PAIRINGS_URL}/${PAIRING_ID}/presider`).set(auth());
        expect(res.status).toBe(204);
    });
});

// ─── PATCH /format — witness count validation ─────────────────────────────────
describe('PATCH /api/organizer/tournament/:tournamentId/format — witness validation', () => {
    it('returns 400 when pWitnessesCalled exceeds available', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ case_format_id: 'fmt1' }], rowCount: 1 } as any) // SELECT formatID
            .mockResolvedValueOnce({ rows: [{ side: 'P', name: 'W1' }], rowCount: 1 } as any); // getWitnesses
        const res = await request(app).patch(`/api/organizer/tournament/${TOURNAMENT_ID}/format`).set(auth()).send({ pWitnessesCalled: 5, dWitnessesCalled: null });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/P witnesses called exceeds/i);
    });

    it('returns 400 when dWitnessesCalled exceeds available', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ case_format_id: 'fmt1' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [{ side: 'D', name: 'W1' }], rowCount: 1 } as any);
        const res = await request(app).patch(`/api/organizer/tournament/${TOURNAMENT_ID}/format`).set(auth()).send({ pWitnessesCalled: null, dWitnessesCalled: 5 });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/D witnesses called exceeds/i);
    });

    it('returns 404 when format not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // getTournamentFormatId -> NotFoundError
        const res = await request(app).patch(`/api/organizer/tournament/${TOURNAMENT_ID}/format`).set(auth()).send({ caseName: 'C' });
        expect(res.status).toBe(404);
    });
});

// ─── GET /standings-config ────────────────────────────────────────────────────
describe('GET /api/organizer/tournament/:tournamentId/standings-config', () => {
    it('returns 200 with config', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'sc1', stats_xml: '<s/>', standings_xml: '<st/>' }], rowCount: 1 } as any);
        const res = await request(app).get(`/api/organizer/tournament/${TOURNAMENT_ID}/standings-config`).set(auth());
        expect(res.status).toBe(200);
    });
});

// ─── PATCH /standings-config ──────────────────────────────────────────────────
describe('PATCH /api/organizer/tournament/:tournamentId/standings-config', () => {
    it('returns 400 when body missing', async () => {
        mockAccess();
        const res = await request(app).patch(`/api/organizer/tournament/${TOURNAMENT_ID}/standings-config`).set(auth()).send({});
        expect(res.status).toBe(400);
    });

    it('returns 200 on success', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ standings_config_id: null }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [{ id: 'sc1' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const res = await request(app).patch(`/api/organizer/tournament/${TOURNAMENT_ID}/standings-config`).set(auth()).send({ statsXml: '<s/>', standingsXml: '<st/>' });
        expect(res.status).toBe(200);
    });

    it('returns 500 when upsert fails', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ standings_config_id: null }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // INSERT fails
        const res = await request(app).patch(`/api/organizer/tournament/${TOURNAMENT_ID}/standings-config`).set(auth()).send({ statsXml: '<s/>', standingsXml: '<st/>' });
        expect(res.status).toBe(500);
    });
});

// ─── PATCH /scoring-categories ────────────────────────────────────────────────
describe('PATCH /api/organizer/tournament/:tournamentId/scoring-categories', () => {
    it('returns 200 on success', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // DELETE fields
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // DELETE categories
        const res = await request(app).patch(`/api/organizer/tournament/${TOURNAMENT_ID}/scoring-categories`).set(auth()).send([]);
        expect(res.status).toBe(200);
    });
});

// ─── PUT /scorers ─────────────────────────────────────────────────────────────
describe('PUT /api/organizer/tournament/:tournamentId/scorers', () => {
    const scorer = { scorer_id: SCORER_ID, first_name: 'A', last_name: 'B', email: 'a@b.com' };

    it('returns 200 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/scorers`).set(auth()).send(scorer);
        expect(res.status).toBe(200);
    });

});

// ─── PUT /organizers ──────────────────────────────────────────────────────────
describe('PUT /api/organizer/tournament/:tournamentId/organizers', () => {
    const base = { name: 'Bob', email: 'b@c.com', role: 'delegate' };

    it('returns 400 when id missing', async () => {
        mockAccess();
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/organizers`).set(auth()).send({ organizer: base });
        expect(res.status).toBe(400);
    });

    it('returns 400 when id is invalid uuid', async () => {
        mockAccess();
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/organizers`).set(auth()).send({ organizer: { ...base, id: 'not-a-uuid' } });
        expect(res.status).toBe(400);
    });

    it('returns 409 when organizer already joined', async () => {
        mockAccess();
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/organizers`).set(auth()).send({ organizer: { ...base, id: ORG_ID, has_joined: true } });
        expect(res.status).toBe(409);
    });

    it('returns 404 when organizer invite not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/organizers`).set(auth()).send({ organizer: { ...base, id: ORG_ID, has_joined: false } });
        expect(res.status).toBe(404);
    });

    it('returns 200 on success', async () => {
        mockAccess();
        const row = { id: ORG_ID, tournament_id: TOURNAMENT_ID, name: 'Bob', email: 'new@c.com' };
        mockDbQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/organizers`).set(auth()).send({ organizer: { ...base, id: ORG_ID, has_joined: false } });
        expect(res.status).toBe(200);
    });
});

// ─── DELETE /organizers — error cases ─────────────────────────────────────────
describe('DELETE /api/organizer/tournament/:tournamentId/organizers — error cases', () => {
    const base = { name: 'Bob', email: 'b@c.com', role: 'delegate' };

    it('returns 400 when id is invalid uuid', async () => {
        mockAccess();
        const res = await request(app).delete(`/api/organizer/tournament/${TOURNAMENT_ID}/organizers`).set(auth()).send({ organizer: { ...base, id: 'not-a-uuid' } });
        expect(res.status).toBe(400);
    });

    it('returns 404 when organizer not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).delete(`/api/organizer/tournament/${TOURNAMENT_ID}/organizers`).set(auth()).send({ organizer: { ...base, id: ORG_ID, has_joined: false } });
        expect(res.status).toBe(404);
    });
});

// ─── POST /organizers — 500 case ──────────────────────────────────────────────
describe('POST /api/organizer/tournament/:tournamentId/organizers — 500', () => {
    it('returns 500 when addOrganizer invite insert fails', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // SELECT auth
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // duplicate check
            .mockResolvedValueOnce(null);                            // INSERT throws DbError
        const res = await request(app).post(`/api/organizer/tournament/${TOURNAMENT_ID}/organizers`).set(auth()).send({ organizer: { name: 'Bob', email: 'b@c.com', role: 'delegate' } });
        expect(res.status).toBe(500);
    });
});

// ─── PUT /courtrooms ──────────────────────────────────────────────────────────
describe('PUT /api/organizer/tournament/:tournamentId/courtrooms', () => {
    it('returns 400 when id or name missing', async () => {
        mockAccess();
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/courtrooms`).set(auth()).send({ name: 'Room 1' });
        expect(res.status).toBe(400);
    });

    it('returns 200 on success', async () => {
        mockAccess();
        const row = { id: 'c1', name: 'Updated' };
        mockDbQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/courtrooms`).set(auth()).send({ id: 'c1', name: 'Updated' });
        expect(res.status).toBe(200);
    });

    it('returns 404 when courtroom not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/courtrooms`).set(auth()).send({ id: 'c1', name: 'Updated' });
        expect(res.status).toBe(404);
    });
});

// ─── DELETE /courtrooms ───────────────────────────────────────────────────────
describe('DELETE /api/organizer/tournament/:tournamentId/courtrooms', () => {
    it('returns 400 when id missing', async () => {
        mockAccess();
        const res = await request(app).delete(`/api/organizer/tournament/${TOURNAMENT_ID}/courtrooms`).set(auth()).send({});
        expect(res.status).toBe(400);
    });

    it('returns 204 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'c1' }], rowCount: 1 } as any);
        const res = await request(app).delete(`/api/organizer/tournament/${TOURNAMENT_ID}/courtrooms`).set(auth()).send({ id: 'c1' });
        expect(res.status).toBe(204);
    });

    it('returns 404 when courtroom not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).delete(`/api/organizer/tournament/${TOURNAMENT_ID}/courtrooms`).set(auth()).send({ id: 'c1' });
        expect(res.status).toBe(404);
    });
});

// ─── PUT /teams ───────────────────────────────────────────────────────────────
describe('PUT /api/organizer/tournament/:tournamentId/teams', () => {
    const base = { name: 'Eagles', coach_email: 'c@d.com', code: 'E' };

    it('returns 400 when id missing', async () => {
        mockAccess();
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/teams`).set(auth()).send({ team: base });
        expect(res.status).toBe(400);
    });

    it('returns 400 when id is invalid uuid', async () => {
        mockAccess();
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/teams`).set(auth()).send({ team: { ...base, id: 'not-a-uuid' } });
        expect(res.status).toBe(400);
    });

    it('returns 409 when team name already exists', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'other' }], rowCount: 1 } as any); // teamNameExists
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/teams`).set(auth()).send({ team: { ...base, id: ROUND_ID } });
        expect(res.status).toBe(409);
    });

    it('returns 404 when team not found', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // teamNameExists (no duplicate)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // SELECT team (not found)
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/teams`).set(auth()).send({ team: { ...base, id: ROUND_ID } });
        expect(res.status).toBe(404);
    });

    it('returns 200 on success', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // teamNameExists
            .mockResolvedValueOnce({ rows: [{ id: ROUND_ID, tournament_id: TOURNAMENT_ID }], rowCount: 1 } as any) // SELECT team
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // UPDATE teams
            .mockResolvedValueOnce({ rows: [{ coach_id: 'u1' }], rowCount: 1 } as any); // SELECT coach
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/teams`).set(auth()).send({ team: { ...base, id: ROUND_ID } });
        expect(res.status).toBe(200);
    });
});

// ─── DELETE /teams ────────────────────────────────────────────────────────────
describe('DELETE /api/organizer/tournament/:tournamentId/teams', () => {
    it('returns 400 when id missing', async () => {
        mockAccess();
        const res = await request(app).delete(`/api/organizer/tournament/${TOURNAMENT_ID}/teams`).set(auth()).send({});
        expect(res.status).toBe(400);
    });

    it('returns 400 when id is invalid uuid', async () => {
        mockAccess();
        const res = await request(app).delete(`/api/organizer/tournament/${TOURNAMENT_ID}/teams`).set(auth()).send({ id: 'not-a-uuid' });
        expect(res.status).toBe(400);
    });

    it('returns 404 when team not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).delete(`/api/organizer/tournament/${TOURNAMENT_ID}/teams`).set(auth()).send({ id: ROUND_ID });
        expect(res.status).toBe(404);
    });

    it('returns 204 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: ROUND_ID }], rowCount: 1 } as any);
        const res = await request(app).delete(`/api/organizer/tournament/${TOURNAMENT_ID}/teams`).set(auth()).send({ id: ROUND_ID });
        expect(res.status).toBe(204);
    });
});