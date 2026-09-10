jest.mock('../../src/email', () => jest.requireActual('../mocks/email'));


jest.mock('../../src/providers/scorerProvider', () => ({
    ...jest.requireActual('../../src/providers/scorerProvider'),
    getSheetFromBallot: jest.fn(),
    getBallot: jest.fn(),
}));

import request from 'supertest';
import app from '../../src/appService';
import { dbQuery } from '../../src/db';
import { DbError, NotFoundError } from '../../src/errors';
import { getBallot, getSheetFromBallot } from '../../src/providers/scorerProvider';
import { setupAuth, makeAuth } from '../helpers/auth';

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;
const mockGetBallot = getBallot as jest.MockedFunction<typeof getBallot>;
const mockGetSheetFromBallot = getSheetFromBallot as jest.MockedFunction<typeof getSheetFromBallot>;

// Use the actual module object for spies. The routers import the same module, so
// replacing these exported functions isolates route behavior from provider internals.
const organizerProvider = jest.requireActual('../../src/providers/organizerProvider') as typeof import('../../src/providers/organizerProvider');

const TOURNAMENT_ID = 'a1b2c3d4-e5f6-4789-abcd-ef1234567890';
const ROUND_ID = 'd4e5f6a7-b8c9-4123-9efa-234567890123';
const PAIRING_ID = 'e5f6a7b8-c9d0-4234-afab-345678901234';
const ASSIGNMENT_ID = 'f6a7b8c9-d0e1-4345-aabc-456789012345';
const BALLOT_ID = '11111111-2222-4333-8444-555555555555';

const getToken = setupAuth();
const auth = () => makeAuth(getToken());

beforeEach(() => {
    mockDbQuery.mockReset();
    mockGetBallot.mockReset();
    mockGetSheetFromBallot.mockReset();
});

afterEach(() => {
    jest.restoreAllMocks();
});

function mockAccess() {
    // verifyTournamentAccess
    mockDbQuery.mockResolvedValueOnce({ rows: [{ role: 'owner' }], rowCount: 1 } as any);
}

const ROUND_BASE = {
    round_id: ROUND_ID,
    name: 'Round 1',
    round_time: null,
    results_public: false,
    teams_public: false,
    locked: false,
};

function mockRoundAccess(round: object = ROUND_BASE) {
    mockAccess();
    // verifyRound -> organizer.getRound(...)
    mockDbQuery.mockResolvedValueOnce({ rows: [round], rowCount: 1 } as any);
}

const PAIRING_BASE = {
    pairing_id: PAIRING_ID,
    round_id: ROUND_ID,
};

function mockPairingAccess(pairing: object = PAIRING_BASE) {
    mockAccess();
    // verifyPairing -> organizer.getPairing(...)
    mockDbQuery.mockResolvedValueOnce({ rows: [pairing], rowCount: 1 } as any);
}

function dbError(message = 'database error'): DbError {
    return Object.setPrototypeOf(new Error(message), DbError.prototype) as DbError;
}

function notFoundError(message = 'not found'): NotFoundError {
    return Object.setPrototypeOf(new Error(message), NotFoundError.prototype) as NotFoundError;
}

const ROUND_URL = `/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}`;
const PAIRING_URL = `/organizer/tournament/${TOURNAMENT_ID}/pairings/${PAIRING_ID}`;

// ─── GET .../rounds/:round/ballot-status ──────────────────────────────────────
describe('GET .../rounds/:round/ballot-status', () => {
    it('returns 200 with ballot status array', async () => {
        mockRoundAccess();

        const ballotStatus = [
            { pairing_id: PAIRING_ID, total_scorers: 3, submitted: 2 },
        ];
        jest.spyOn(organizerProvider, 'getBallotStatus').mockResolvedValueOnce(ballotStatus as any);

        const res = await request(app)
            .get(`${ROUND_URL}/ballot-status`)
            .set(auth());

        expect(res.status).toBe(200);
        expect(res.body).toEqual(ballotStatus);
    });

    it('returns 404 when round not found', async () => {
        mockAccess();
        // verifyRound -> organizer.getRound(...) -> NotFoundError
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

        const res = await request(app)
            .get(`${ROUND_URL}/ballot-status`)
            .set(auth());

        expect(res.status).toBe(404);
    });

    it('returns 500 when getBallotStatus hits a DB error', async () => {
        mockRoundAccess();
        jest.spyOn(organizerProvider, 'getBallotStatus').mockRejectedValueOnce(dbError());

        const res = await request(app)
            .get(`${ROUND_URL}/ballot-status`)
            .set(auth());

        expect(res.status).toBe(500);
    });
});

// ─── POST .../rounds/:round/send-scoring-links ────────────────────────────────
describe('POST .../rounds/:round/send-scoring-links', () => {
    it('returns 409 when the round is not locked', async () => {
        mockRoundAccess({ ...ROUND_BASE, locked: false });

        const res = await request(app)
            .post(`${ROUND_URL}/send-scoring-links`)
            .set(auth());

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/lock the round/i);
    });

    it('returns 409 when scoring links were already sent', async () => {
        mockRoundAccess({ ...ROUND_BASE, locked: true });
        jest.spyOn(organizerProvider, 'hasSentScoringLinksForRound').mockResolvedValueOnce(true);

        const res = await request(app)
            .post(`${ROUND_URL}/send-scoring-links`)
            .set(auth());

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/already been sent/i);
    });

    it('returns sent=0 when there are no scorer invite contexts', async () => {
        mockRoundAccess({ ...ROUND_BASE, locked: true });
        jest.spyOn(organizerProvider, 'hasSentScoringLinksForRound').mockResolvedValueOnce(false);
        jest.spyOn(organizerProvider, 'getScorerInviteContextsForRound').mockResolvedValueOnce([] as any);

        const res = await request(app)
            .post(`${ROUND_URL}/send-scoring-links`)
            .set(auth());

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ sent: 0 });
    });

    it('returns sent count matching number of registered scorers', async () => {
        mockRoundAccess({ ...ROUND_BASE, locked: true });
        jest.spyOn(organizerProvider, 'hasSentScoringLinksForRound').mockResolvedValueOnce(false);
        jest.spyOn(organizerProvider, 'getScorerInviteContextsForRound').mockResolvedValueOnce([
            {
                email: 'scorer1@test.com',
                tournamentName: 'T',
                assignmentId: 'aaaaaaaa-1111-4111-8111-111111111111',
            },
            {
                email: 'scorer2@test.com',
                tournamentName: 'T',
                assignmentId: 'bbbbbbbb-2222-4222-8222-222222222222',
            },
        ] as any);

        const res = await request(app)
            .post(`${ROUND_URL}/send-scoring-links`)
            .set(auth());

        expect(res.status).toBe(200);
        expect(res.body.sent).toBe(2);
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

    it('returns 400 when required fields are missing', async () => {
        mockRoundAccess();

        const res = await request(app)
            .patch(ROUND_URL)
            .set(auth())
            .send({ name: 'Round 1' });

        expect(res.status).toBe(400);
    });

    it('returns 200 on successful update', async () => {
        mockRoundAccess();

        const updatedRound = { ...ROUND_BASE, name: 'Updated' };
        const updateRound = jest
            .spyOn(organizerProvider, 'updateRound')
            .mockResolvedValueOnce(updatedRound as any);

        const payload = {
            name: 'Updated',
            results_public: false,
            teams_public: false,
        };

        const res = await request(app)
            .patch(ROUND_URL)
            .set(auth())
            .send(payload);

        expect(res.status).toBe(200);
        expect(res.body).toEqual(updatedRound);
        expect(updateRound).toHaveBeenCalledWith(ROUND_ID, payload);
    });
});

// ─── Organizer Scorecard endpoints ────────────────────────────────────────────
// Individual pairing routes are mounted at /:tournamentId/pairings/:pairingId.
// Every one of these requests therefore goes through BOTH verifyTournamentAccess
// and verifyPairing before entering organizerPairingRoutes.

describe('GET .../pairings/:pairingId/scoresheets/:ballotId', () => {
    const SCORESHEET_URL = `${PAIRING_URL}/scoresheets/${BALLOT_ID}`;

    it('returns 400 for invalid ballot ID', async () => {
        mockPairingAccess();

        const res = await request(app)
            .get(`${PAIRING_URL}/scoresheets/bad-uuid`)
            .set(auth());

        expect(res.status).toBe(400);
    });

    it('returns 200 with sheet=null when getSheetFromBallot fails', async () => {
        mockPairingAccess();
        mockGetSheetFromBallot.mockRejectedValueOnce(new Error('sheet unavailable'));
        mockGetBallot.mockResolvedValueOnce(null as any);
        jest.spyOn(organizerProvider, 'getBallotEditLog').mockResolvedValueOnce([] as any);

        const res = await request(app)
            .get(SCORESHEET_URL)
            .set(auth());

        expect(res.status).toBe(200);
        expect(res.body.sheet).toBeNull();
        expect(res.body.ballot).toBeNull();
        expect(res.body.editLog).toEqual([]);
        expect(mockGetSheetFromBallot).toHaveBeenCalledWith(BALLOT_ID, { skipGuards: true });
        expect(mockGetBallot).toHaveBeenCalledWith(BALLOT_ID);
    });
});

describe('PUT .../pairings/:pairingId/scoresheets/:assignmentId', () => {
    const SCORESHEET_URL = `${PAIRING_URL}/scoresheets/${ASSIGNMENT_ID}`;

    it('returns 400 for invalid assignment ID', async () => {
        mockPairingAccess();

        const res = await request(app)
            .put(`${PAIRING_URL}/scoresheets/bad-uuid`)
            .set(auth())
            .send({ scores: [], reason: 'fix' });

        expect(res.status).toBe(400);
    });

    it('returns 400 when scores array is missing', async () => {
        mockPairingAccess();

        const res = await request(app)
            .put(SCORESHEET_URL)
            .set(auth())
            .send({ reason: 'fix' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/scores.*reason/i);
    });

    it('returns 400 when reason is missing', async () => {
        mockPairingAccess();

        const res = await request(app)
            .put(SCORESHEET_URL)
            .set(auth())
            .send({
                scores: [
                    {
                        assignmentKey: 'k1',
                        side: 'P',
                        score: 8,
                        studentId: null,
                        categoryId: 'c1',
                    },
                ],
            });

        expect(res.status).toBe(400);
    });

    it('returns 404 when ballot is not found', async () => {
        mockPairingAccess();
        jest.spyOn(organizerProvider, 'editBallot').mockRejectedValueOnce(notFoundError('Ballot not found'));

        const res = await request(app)
            .put(SCORESHEET_URL)
            .set(auth())
            .send({
                scores: [
                    {
                        assignmentKey: 'k1',
                        side: 'P',
                        score: 9,
                        studentId: null,
                        categoryId: 'c1',
                    },
                ],
                reason: 'Fix error',
            });

        expect(res.status).toBe(404);
    });

    it('returns 200 on successful edit', async () => {
        mockPairingAccess();
        const editBallot = jest
            .spyOn(organizerProvider, 'editBallot')
            .mockResolvedValueOnce(undefined as any);

        const scores = [
            {
                assignmentKey: 'k1',
                side: 'P' as const,
                score: 9,
                studentId: null,
                categoryId: 'c1',
            },
        ];

        const res = await request(app)
            .put(SCORESHEET_URL)
            .set(auth())
            .send({
                scores,
                reason: 'Scorer reported error',
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(editBallot).toHaveBeenCalledWith(
            ASSIGNMENT_ID,
            { scores },
            expect.any(String),
            'Scorer reported error',
        );
    });
});

describe('DELETE .../pairings/:pairingId/scoresheets/:ballotId', () => {
    const SCORESHEET_URL = `${PAIRING_URL}/scoresheets/${BALLOT_ID}`;

    it('returns 400 for invalid ballot ID', async () => {
        mockPairingAccess();

        const res = await request(app)
            .delete(`${PAIRING_URL}/scoresheets/bad-uuid`)
            .set(auth());

        expect(res.status).toBe(400);
    });

    it('returns 204 on successful deletion', async () => {
        mockPairingAccess();
        const deleteBallot = jest
            .spyOn(organizerProvider, 'deleteBallot')
            .mockResolvedValueOnce(undefined as any);

        const res = await request(app)
            .delete(SCORESHEET_URL)
            .set(auth());

        expect(res.status).toBe(204);
        expect(deleteBallot).toHaveBeenCalledWith(BALLOT_ID);
    });

    it('returns 404 when ballot is not found', async () => {
        mockPairingAccess();
        jest.spyOn(organizerProvider, 'deleteBallot').mockRejectedValueOnce(notFoundError('Ballot not found'));

        const res = await request(app)
            .delete(SCORESHEET_URL)
            .set(auth());

        expect(res.status).toBe(404);
    });
});
