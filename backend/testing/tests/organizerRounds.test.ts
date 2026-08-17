jest.mock('../../src/email', () => jest.requireActual('../mocks/email'));

import request from 'supertest';
import app from '../../src/appService';
import { dbQuery } from '../../src/db';
import { setupAuth, makeAuth } from '../helpers/auth';

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;

const TOURNAMENT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ROUND_ID = 'd4e5f6a7-b8c9-0123-defa-234567890123';
const PAIRING_ID = 'e5f6a7b8-c9d0-1234-efab-345678901234';
const ASSIGNMENT_ID = 'f6a7b8c9-d0e1-2345-fabc-456789012345';

const getToken = setupAuth();
const auth = () => makeAuth(getToken());

function mockAccess() {
    mockDbQuery.mockResolvedValueOnce({ rows: [{ role: 'owner' }], rowCount: 1 } as never);
}

const ROUND_BASE = { round_id: ROUND_ID, name: 'Round 1', round_time: null, results_public: false, teams_public: false };

function mockRoundAccess(round: object = ROUND_BASE) {
    mockAccess();
    mockDbQuery.mockResolvedValueOnce({ rows: [round], rowCount: 1 } as never);
}

const ROUND_URL = `/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}`;

// ─── GET .../rounds/:round/ballot-status ──────────────────────────────────────
describe('GET .../rounds/:round/ballot-status', () => {
    it('returns 200 with ballot status array', async () => {
        mockRoundAccess();
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ pairing_id: PAIRING_ID, total_scorers: 3, submitted: 2 }],
            rowCount: 1,
        } as never);

        const res = await request(app).get(`${ROUND_URL}/ballot-status`).set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toEqual([
            { pairing_id: PAIRING_ID, total_scorers: 3, submitted: 2 },
        ]);
    });

    it('returns 404 when round not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

        const res = await request(app).get(`${ROUND_URL}/ballot-status`).set(auth());
        expect(res.status).toBe(404);
    });
});

// ─── POST .../rounds/:round/send-scoring-links ────────────────────────────────
describe('POST .../rounds/:round/send-scoring-links', () => {
    it('returns sent=0 when no scorers have emails', async () => {
        mockRoundAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

        const res = await request(app).post(`${ROUND_URL}/send-scoring-links`).set(auth());
        expect(res.status).toBe(200);
        expect(res.body.sent).toBe(0);
    });
});

// ─── POST .../rounds/:round/generate-pairings ─────────────────────────────────
describe('POST .../rounds/:round/generate-pairings', () => {
    it('returns 409 when round already has pairings', async () => {
        mockRoundAccess();
        // getPairings returns existing pairings
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ pairing_id: PAIRING_ID, p_team: 't1', d_team: 't2' }],
            rowCount: 1,
        } as never);

        const res = await request(app)
            .post(`${ROUND_URL}/generate-pairings`)
            .set(auth())
            .send({ method: 'random' });
        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/already has pairings/i);
    });

    it('returns 400 when fewer than 2 teams', async () => {
        mockRoundAccess();
        // getPairings: no existing pairings
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        // teams query: only 1 team
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 't1', name: 'Alpha' }], rowCount: 1 } as never);

        const res = await request(app)
            .post(`${ROUND_URL}/generate-pairings`)
            .set(auth())
            .send({ method: 'random' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/at least 2 teams/i);
    });

    it('returns 500 when teams query fails', async () => {
        mockRoundAccess();
        // getPairings: no existing pairings
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        // teams query returns null (DB error)
        mockDbQuery.mockResolvedValueOnce(null as never);

        const res = await request(app)
            .post(`${ROUND_URL}/generate-pairings`)
            .set(auth())
            .send({ method: 'random' });
        expect(res.status).toBe(500);
    });
});

// ─── POST .../resend-link ─────────────────────────────────────────────────────
describe('POST .../pairings/:pairing/scorers/:assignment/resend-link', () => {
    const RESEND_URL = `${ROUND_URL}/pairings/${PAIRING_ID}/scorers/${ASSIGNMENT_ID}/resend-link`;

    it('returns 400 for invalid pairing ID', async () => {
        mockRoundAccess();
        const res = await request(app)
            .post(`${ROUND_URL}/pairings/bad-uuid/scorers/${ASSIGNMENT_ID}/resend-link`)
            .set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 400 for invalid assignment ID', async () => {
        mockRoundAccess();
        const res = await request(app)
            .post(`${ROUND_URL}/pairings/${PAIRING_ID}/scorers/bad-uuid/resend-link`)
            .set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 404 when scorer context not found', async () => {
        mockRoundAccess();
        // getScorerInviteContextForAssignment returns null
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

        const res = await request(app).post(RESEND_URL).set(auth());
        expect(res.status).toBe(404);
    });
});

// ─── PATCH .../rounds/:round — one-way flags ──────────────────────────────────
describe('PATCH .../rounds/:round — one-way flags', () => {
    it('rejects making results private after publish', async () => {
        mockRoundAccess({ ...ROUND_BASE, results_public: true });
        const res = await request(app)
            .patch(ROUND_URL)
            .set(auth())
            .send({ name: 'Round 1', results_public: false, teams_public: true });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/results cannot be made private/i);
    });

    it('rejects making teams private after publish', async () => {
        mockRoundAccess({ ...ROUND_BASE, teams_public: true });
        const res = await request(app)
            .patch(ROUND_URL)
            .set(auth())
            .send({ name: 'Round 1', results_public: false, teams_public: false });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/teams cannot be made private/i);
    });

    it('returns 400 when required fields missing', async () => {
        mockRoundAccess();
        const res = await request(app)
            .patch(ROUND_URL)
            .set(auth())
            .send({ name: 'Round 1' }); // missing results_public and teams_public
        expect(res.status).toBe(400);
    });

    it('returns 200 on successful update', async () => {
        mockRoundAccess();
        // updateRound returns the updated round
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ ...ROUND_BASE, name: 'Updated' }],
            rowCount: 1,
        } as never);

        const res = await request(app)
            .patch(ROUND_URL)
            .set(auth())
            .send({ name: 'Updated', results_public: false, teams_public: false });
        expect(res.status).toBe(200);
    });
});

// ─── Organizer Scorecard endpoints ────────────────────────────────────────────
// These routes are on organizerTournamentRoutes (/:tournamentId/pairings/...)
// and only use verifyTournamentAccess (one mockAccess call).

describe('GET .../pairings/:pairingId/scoresheets/:assignmentId', () => {
    const SCORESHEET_URL = `/organizer/tournament/${TOURNAMENT_ID}/pairings/${PAIRING_ID}/scoresheets/${ASSIGNMENT_ID}`;

    it('returns 400 for invalid assignment ID', async () => {
        mockAccess();
        const res = await request(app)
            .get(`/organizer/tournament/${TOURNAMENT_ID}/pairings/${PAIRING_ID}/scoresheets/bad-uuid`)
            .set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 200 with sheet=null when getScoreSheet fails', async () => {
        mockAccess();
        // getScoreSheet (skipGuards) — assignment not found, throws (caught → null)
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        // getBallot — no ballot
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        // getBallotEditLog — empty
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

        const res = await request(app).get(SCORESHEET_URL).set(auth());
        expect(res.status).toBe(200);
        expect(res.body.sheet).toBeNull();
        expect(res.body.ballot).toBeNull();
        expect(res.body.editLog).toEqual([]);
    });
});

describe('PUT .../pairings/:pairingId/scoresheets/:assignmentId', () => {
    const SCORESHEET_URL = `/organizer/tournament/${TOURNAMENT_ID}/pairings/${PAIRING_ID}/scoresheets/${ASSIGNMENT_ID}`;

    it('returns 400 for invalid assignment ID', async () => {
        mockAccess();
        const res = await request(app)
            .put(`/organizer/tournament/${TOURNAMENT_ID}/pairings/${PAIRING_ID}/scoresheets/bad-uuid`)
            .set(auth())
            .send({ scores: [], reason: 'fix' });
        expect(res.status).toBe(400);
    });

    it('returns 400 when scores array is missing', async () => {
        mockAccess();
        const res = await request(app)
            .put(SCORESHEET_URL)
            .set(auth())
            .send({ reason: 'fix' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/scores.*reason/i);
    });

    it('returns 400 when reason is missing', async () => {
        mockAccess();
        const res = await request(app)
            .put(SCORESHEET_URL)
            .set(auth())
            .send({ scores: [{ assignmentKey: 'k1', side: 'P', score: 8, studentId: null, categoryId: 'c1' }] });
        expect(res.status).toBe(400);
    });

    it('returns 404 when ballot not found', async () => {
        mockAccess();
        // editBallot: SELECT ballot → empty
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

        const res = await request(app)
            .put(SCORESHEET_URL)
            .set(auth())
            .send({
                scores: [{ assignmentKey: 'k1', side: 'P', score: 9, studentId: null, categoryId: 'c1' }],
                reason: 'Fix error',
            });
        expect(res.status).toBe(404);
    });

    it('returns 200 on successful edit', async () => {
        mockAccess();
        // editBallot: get existing ballot
        mockDbQuery.mockResolvedValueOnce({
            rows: [{
                ballot_id: 'b1',
                ballot_json: JSON.stringify({ pairingID: PAIRING_ID, scores: [{ assignmentKey: 'k1', side: 'P', score: 7, studentId: null, categoryId: 'c1' }], nominations: [] }),
                p_points: 7,
                d_points: 0,
            }],
            rowCount: 1,
        } as never);
        // editBallot: update ballot
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
        // editBallot: insert edit log
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

        const res = await request(app)
            .put(SCORESHEET_URL)
            .set(auth())
            .send({
                scores: [{ assignmentKey: 'k1', side: 'P', score: 9, studentId: null, categoryId: 'c1' }],
                reason: 'Scorer reported error',
            });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

describe('DELETE .../pairings/:pairingId/scoresheets/:assignmentId', () => {
    const SCORESHEET_URL = `/organizer/tournament/${TOURNAMENT_ID}/pairings/${PAIRING_ID}/scoresheets/${ASSIGNMENT_ID}`;

    it('returns 400 for invalid assignment ID', async () => {
        mockAccess();
        const res = await request(app)
            .delete(`/organizer/tournament/${TOURNAMENT_ID}/pairings/${PAIRING_ID}/scoresheets/bad-uuid`)
            .set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 204 on successful deletion', async () => {
        mockAccess();
        // deleteBallot: DELETE RETURNING ballot_id
        mockDbQuery.mockResolvedValueOnce({ rows: [{ ballot_id: 'b1' }], rowCount: 1 } as never);

        const res = await request(app).delete(SCORESHEET_URL).set(auth());
        expect(res.status).toBe(204);
    });

    it('returns 404 when ballot not found', async () => {
        mockAccess();
        // deleteBallot: DELETE returns no rows
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

        const res = await request(app).delete(SCORESHEET_URL).set(auth());
        expect(res.status).toBe(404);
    });
});
