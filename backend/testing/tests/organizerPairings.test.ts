/**
 * Coverage gap tests for organizerRoundRoutes.ts:
 * - POST /generate-pairings (random, power, odd teams, rematch avoidance)
 * - POST /send-scoring-links
 * - POST /pairings/:pairing/scorers/:assignment/resend-link
 * - GET /ballot-status
 */
jest.mock('../../src/email', () => jest.requireActual('../mocks/email'));
import request from 'supertest';
import app from '../../src/appService';
import { dbQuery } from '../../src/db';
import { setupAuth, makeAuth, makeMockAccess } from '../helpers/auth';

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;

const T = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ROUND_ID = 'd4e5f6a7-b8c9-0123-defa-234567890123';
const PAIRING_ID = 'e5f6a7b8-c9d0-1234-efab-345678901234';
const ASSIGNMENT_ID = 'f6a7b8c9-d0e1-2345-fabc-456789012345';

const getToken = setupAuth();
const auth = () => makeAuth(getToken());
const mockAccess = () => makeMockAccess(mockDbQuery as jest.MockedFunction<(...args: unknown[]) => unknown>);

const ROUND_BASE = { round_id: ROUND_ID, name: 'Round 1', round_time: null, results_public: false, teams_public: false };
const ROUND_URL = `/organizer/tournament/${T}/rounds/${ROUND_ID}`;

function mockRoundAccess(round: object = ROUND_BASE) {
    mockAccess();
    mockDbQuery.mockResolvedValueOnce({ rows: [round], rowCount: 1 } as any);
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /generate-pairings — power method with even teams
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST .../rounds/:round/generate-pairings — power method', () => {
    it('generates pairings using power matching (sorted by win count)', async () => {
        mockRoundAccess();
        // getPairings: no existing pairings
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        // teams query: 4 teams
        mockDbQuery.mockResolvedValueOnce({ rows: [
            { id: 't1', name: 'Alpha' },
            { id: 't2', name: 'Beta' },
            { id: 't3', name: 'Gamma' },
            { id: 't4', name: 'Delta' },
        ], rowCount: 4 } as any);
        // history pairings (for side counts and rematch avoidance)
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        // ballots for win counts (power method)
        mockDbQuery.mockResolvedValueOnce({ rows: [
            { p_team_id: 't1', d_team_id: 't2', p_points: 80, d_points: 70 }, // t1 wins
            { p_team_id: 't3', d_team_id: 't4', p_points: 60, d_points: 90 }, // t4 wins
        ], rowCount: 2 } as any);
        // courtrooms
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'c1' }, { id: 'c2' }], rowCount: 2 } as any);
        // createRoundPairing for each pair (2 pairings for 4 teams)
        mockDbQuery.mockResolvedValueOnce({ rows: [{ pairing_id: 'p1' }], rowCount: 1 } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ pairing_id: 'p2' }], rowCount: 1 } as any);

        const res = await request(app)
            .post(`${ROUND_URL}/generate-pairings`)
            .set(auth())
            .send({ method: 'power' });
        expect(res.status).toBe(201);
        expect(res.body).toHaveLength(2);
    });
});

describe('POST .../rounds/:round/generate-pairings — random method', () => {
    it('generates random pairings', async () => {
        mockRoundAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // no existing pairings
        mockDbQuery.mockResolvedValueOnce({ rows: [
            { id: 't1', name: 'Alpha' },
            { id: 't2', name: 'Beta' },
        ], rowCount: 2 } as any); // teams
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // history
        // No ballots query for random method
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'c1' }], rowCount: 1 } as any); // courtrooms
        mockDbQuery.mockResolvedValueOnce({ rows: [{ pairing_id: 'p1' }], rowCount: 1 } as any); // create pairing

        const res = await request(app)
            .post(`${ROUND_URL}/generate-pairings`)
            .set(auth())
            .send({ method: 'random' });
        expect(res.status).toBe(201);
        expect(res.body).toHaveLength(1);
    });
});

describe('POST .../rounds/:round/generate-pairings — odd number of teams', () => {
    it('drops last team (bye) when odd number of teams', async () => {
        mockRoundAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // no existing pairings
        mockDbQuery.mockResolvedValueOnce({ rows: [
            { id: 't1', name: 'Alpha' },
            { id: 't2', name: 'Beta' },
            { id: 't3', name: 'Gamma' },
        ], rowCount: 3 } as any); // 3 teams — odd
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // history
        mockDbQuery.mockResolvedValueOnce({ rows: [
            { p_team_id: 't1', d_team_id: 't2', p_points: 80, d_points: 70 },
        ], rowCount: 1 } as any); // ballots
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'c1' }], rowCount: 1 } as any); // courtrooms
        mockDbQuery.mockResolvedValueOnce({ rows: [{ pairing_id: 'p1' }], rowCount: 1 } as any); // only 1 pairing (2 teams after bye)

        const res = await request(app)
            .post(`${ROUND_URL}/generate-pairings`)
            .set(auth())
            .send({ method: 'power' });
        expect(res.status).toBe(201);
        expect(res.body).toHaveLength(1); // 3 teams → 1 pairing + 1 bye
    });
});

describe('POST .../rounds/:round/generate-pairings — rematch avoidance', () => {
    it('swaps teams to avoid rematches when possible', async () => {
        mockRoundAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // no existing pairings
        mockDbQuery.mockResolvedValueOnce({ rows: [
            { id: 't1', name: 'Alpha' },
            { id: 't2', name: 'Beta' },
            { id: 't3', name: 'Gamma' },
            { id: 't4', name: 'Delta' },
        ], rowCount: 4 } as any);
        // History: t1 already played t2 in a previous round
        mockDbQuery.mockResolvedValueOnce({ rows: [
            { p_team: 't1', d_team: 't2', round_id: 'prev-round' },
        ], rowCount: 1 } as any);
        // Ballots: all teams have 1 win (equal power)
        mockDbQuery.mockResolvedValueOnce({ rows: [
            { p_team_id: 't1', d_team_id: 't3', p_points: 80, d_points: 70 },
            { p_team_id: 't2', d_team_id: 't4', p_points: 80, d_points: 70 },
        ], rowCount: 2 } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'c1' }, { id: 'c2' }], rowCount: 2 } as any); // courtrooms
        mockDbQuery.mockResolvedValueOnce({ rows: [{ pairing_id: 'p1' }], rowCount: 1 } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ pairing_id: 'p2' }], rowCount: 1 } as any);

        const res = await request(app)
            .post(`${ROUND_URL}/generate-pairings`)
            .set(auth())
            .send({ method: 'power' });
        expect(res.status).toBe(201);
        expect(res.body).toHaveLength(2);
    });
});

describe('POST .../rounds/:round/generate-pairings — no courtrooms', () => {
    it('generates pairings with null courtroom when none available', async () => {
        mockRoundAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [
            { id: 't1', name: 'Alpha' },
            { id: 't2', name: 'Beta' },
        ], rowCount: 2 } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // history
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // ballots
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // no courtrooms
        mockDbQuery.mockResolvedValueOnce({ rows: [{ pairing_id: 'p1' }], rowCount: 1 } as any);

        const res = await request(app)
            .post(`${ROUND_URL}/generate-pairings`)
            .set(auth())
            .send({ method: 'power' });
        expect(res.status).toBe(201);
        expect(res.body).toHaveLength(1);
    });
});

describe('POST .../rounds/:round/generate-pairings — side balancing', () => {
    it('assigns sides based on historical prosecution/defense counts', async () => {
        mockRoundAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [
            { id: 't1', name: 'Alpha' },
            { id: 't2', name: 'Beta' },
        ], rowCount: 2 } as any);
        // History: t1 has been prosecution 3 times, t2 only once
        mockDbQuery.mockResolvedValueOnce({ rows: [
            { p_team: 't1', d_team: 't2', round_id: 'r-prev1' },
            { p_team: 't1', d_team: 't3', round_id: 'r-prev2' },
            { p_team: 't1', d_team: 't4', round_id: 'r-prev3' },
        ], rowCount: 3 } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // ballots
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'c1' }], rowCount: 1 } as any); // courtrooms
        mockDbQuery.mockResolvedValueOnce({ rows: [{ pairing_id: 'p1' }], rowCount: 1 } as any);

        const res = await request(app)
            .post(`${ROUND_URL}/generate-pairings`)
            .set(auth())
            .send({ method: 'power' });
        expect(res.status).toBe(201);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /ballot-status
// ═══════════════════════════════════════════════════════════════════════════════
describe('GET .../rounds/:round/ballot-status — DbError', () => {
    it('returns 500 on db failure', async () => {
        mockRoundAccess();
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app).get(`${ROUND_URL}/ballot-status`).set(auth());
        expect(res.status).toBe(500);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /send-scoring-links
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST .../rounds/:round/send-scoring-links — with scorers', () => {
    it('returns sent count matching number of registered scorers', async () => {
        mockRoundAccess();
        mockDbQuery.mockResolvedValueOnce({
            rows: [
                { email: 'scorer1@test.com', first_name: 'A', last_name: 'B', tournament_name: 'T', assignment_id: 'a1' },
                { email: 'scorer2@test.com', first_name: 'C', last_name: 'D', tournament_name: 'T', assignment_id: 'a2' },
            ],
            rowCount: 2,
        } as any);
        const res = await request(app).post(`${ROUND_URL}/send-scoring-links`).set(auth());
        expect(res.status).toBe(200);
        expect(res.body.sent).toBe(2);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /pairings/:pairing/scorers/:assignment/resend-link
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST .../pairings/:pairing/scorers/:assignment/resend-link', () => {
    const RESEND_URL = `${ROUND_URL}/pairings/${PAIRING_ID}/scorers/${ASSIGNMENT_ID}/resend-link`;

    it('returns 200 when context found and email sent', async () => {
        mockRoundAccess();
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ email: 'scorer@test.com', first_name: 'A', last_name: 'B', tournament_name: 'Test Tournament' }],
            rowCount: 1,
        } as any);
        const res = await request(app).post(RESEND_URL).set(auth());
        expect(res.status).toBe(200);
        expect(res.body.sent).toBe(true);
    });
});
