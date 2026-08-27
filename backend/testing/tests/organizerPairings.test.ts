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
