jest.mock('../../src/email', () => jest.requireActual('../mocks/email'));

import request from 'supertest';
import app from '../../src/appService';
import { dbQuery } from '../../src/db';
import * as organizer from '../../src/providers/organizerProvider';
import { DbError, NotFoundError } from '../../src/errors';
import { setupAuth, makeAuth, makeMockAccess } from '../helpers/auth';

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;

// Valid UUID-shaped fixtures.
const TOURNAMENT_ID = 'a1b2c3d4-e5f6-4789-abcd-ef1234567890';
const ROUND_ID      = 'd4e5f6a7-b8c9-4123-9efa-234567890123';
const PAIRING_ID    = 'e5f6a7b8-c9d0-4234-afab-345678901234';
const SCORER_ID     = 'b2c3d4e5-f6a7-4901-bcde-f12345678901';
const TEAM_ID       = 'f6a7b8c9-d0e1-4345-8abc-456789012345';
const STUDENT_ID    = 'a7b8c9d0-e1f2-4456-abcd-567890123456';
const ASSIGNMENT_ID = 'b8c9d0e1-f2a3-4567-bcde-678901234567';

const getToken = setupAuth();
const auth = () => makeAuth(getToken());

function mockAccess() {
    makeMockAccess(
        mockDbQuery as jest.MockedFunction<(...args: unknown[]) => unknown>
    );
}

function mockOwnerAccess() {
    makeMockAccess(
        mockDbQuery as jest.MockedFunction<(...args: unknown[]) => unknown>
    );
}

const ROUND_BASE = {
    round_id: ROUND_ID,
    name: 'R1',
    round_time: null,
    results_public: false,
    teams_public: false,
};

const PAIRING_BASE = {
    pairing_id: PAIRING_ID,
    round_id: ROUND_ID,
    p_team: TEAM_ID,
    d_team: SCORER_ID,
    courtroom: null,
};

/** Access check + verifyRound() lookup. */
function mockAccessAndRound(round: object = ROUND_BASE) {
    mockAccess();
    jest.spyOn(organizer, 'getRound').mockResolvedValue(round as any);
}

/** Access check + verifyPairing() lookup. */
function mockAccessAndPairing(pairing: object = PAIRING_BASE) {
    mockAccess();
    jest.spyOn(organizer, 'getPairing').mockResolvedValue(pairing as any);
}

/**
 * Avoid depending on constructor signatures while still satisfying
 * instanceof checks in the routers.
 */
const dbError = (message = 'database failure') =>
    Object.setPrototypeOf(new Error(message), DbError.prototype) as DbError;

const notFoundError = (message = 'not found') =>
    Object.setPrototypeOf(new Error(message), NotFoundError.prototype) as NotFoundError;

beforeEach(() => {
    mockDbQuery.mockReset();
});

afterEach(() => {
    jest.restoreAllMocks();
});

// ============================================================================
// authRoutes DbError branches
//
// These remain DB-level tests because authRoutes.ts was not among the router
// files available in this conversation.
// ============================================================================

describe('POST /api/auth/register - DbError', () => {
    it('returns 500 when db fails during register', async () => {
        mockDbQuery.mockResolvedValueOnce(null as any);

        const res = await request(app)
            .post('/auth/register')
            .send({
                email: 'a@b.com',
                password: 'Password1',
                firstName: 'A',
                lastName: 'B',
            });

        expect(res.status).toBe(500);
    });
});

describe('POST /api/auth/login - DbError', () => {
    it('returns 500 when db fails during login', async () => {
        mockDbQuery.mockResolvedValueOnce(null as any);

        const res = await request(app)
            .post('/auth/login')
            .send({
                email: 'a@b.com',
                password: 'Password1',
            });

        expect(res.status).toBe(500);
    });
});

describe('POST /api/auth/change-password - DbError', () => {
    it('returns 500 when db fails during change-password', async () => {
        mockDbQuery.mockResolvedValueOnce(null as any);

        const res = await request(app)
            .post('/auth/change-password')
            .set(auth())
            .send({
                currentPassword: 'old',
                newPassword: 'Newpass123',
            });

        expect(res.status).toBe(500);
    });
});

// ============================================================================
// organizerRoutes.ts gap branches
// ============================================================================

describe('GET /api/organizer/tournament/standings-templates - DbError', () => {
    it('returns 500 when getStandingsTemplates throws DbError', async () => {
        jest.spyOn(organizer, 'getStandingsTemplates')
            .mockRejectedValue(dbError());

        const res = await request(app)
            .get('/organizer/tournament/standings-templates')
            .set(auth());

        expect(res.status).toBe(500);
        expect(res.body.message).toMatch(/database error/i);
    });
});

describe('POST /api/organizer/tournament/duplicate/:id - errors', () => {
    it('returns 404 when duplicateTournament throws NotFoundError', async () => {
        mockAccess();

        jest.spyOn(organizer, 'duplicateTournament')
            .mockRejectedValue(notFoundError('Tournament not found'));

        const res = await request(app)
            .post(`/organizer/tournament/duplicate/${TOURNAMENT_ID}`)
            .set(auth())
            .send({});

        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/not found/i);
    });

    it('returns 500 when duplicateTournament throws DbError', async () => {
        mockAccess();

        jest.spyOn(organizer, 'duplicateTournament')
            .mockRejectedValue(dbError());

        const res = await request(app)
            .post(`/organizer/tournament/duplicate/${TOURNAMENT_ID}`)
            .set(auth())
            .send({});

        expect(res.status).toBe(500);
        expect(res.body.message).toMatch(/duplicate tournament/i);
    });
});

describe('DELETE /api/organizer/tournament/:id - errors', () => {
    it('returns 404 when deleteTournament throws NotFoundError', async () => {
        mockOwnerAccess();

        jest.spyOn(organizer, 'deleteTournament')
            .mockRejectedValue(notFoundError('Tournament not found'));

        const res = await request(app)
            .delete(`/organizer/tournament/${TOURNAMENT_ID}`)
            .set(auth());

        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/not found/i);
    });

    it('returns 500 when deleteTournament throws DbError', async () => {
        mockOwnerAccess();

        jest.spyOn(organizer, 'deleteTournament')
            .mockRejectedValue(dbError());

        const res = await request(app)
            .delete(`/organizer/tournament/${TOURNAMENT_ID}`)
            .set(auth());

        expect(res.status).toBe(500);
        expect(res.body.message).toMatch(/delete tournament/i);
    });
});

// ============================================================================
// organizerRoundRoutes error branches
// ============================================================================

const ROUND_URL =
    `/organizer/tournament/${TOURNAMENT_ID}/rounds/${ROUND_ID}`;

describe('PATCH /rounds/:round - errors', () => {
    it('returns 404 when updateRound throws NotFoundError', async () => {
        mockAccessAndRound();

        jest.spyOn(organizer, 'updateRound')
            .mockRejectedValue(notFoundError('Round not found'));

        const res = await request(app)
            .patch(ROUND_URL)
            .set(auth())
            .send({
                name: 'R1',
                results_public: true,
                teams_public: false,
            });

        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/not found/i);
    });

    it('returns 400 when fields are missing', async () => {
        mockAccessAndRound();

        const res = await request(app)
            .patch(ROUND_URL)
            .set(auth())
            .send({});

        expect(res.status).toBe(400);
    });
});

describe('DELETE /rounds/:round - errors', () => {
    it('returns 404 when deleteRound throws NotFoundError', async () => {
        mockAccessAndRound();

        jest.spyOn(organizer, 'deleteRound')
            .mockRejectedValue(notFoundError('Round not found'));

        const res = await request(app)
            .delete(ROUND_URL)
            .set(auth());

        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/not found/i);
    });
});

describe('GET /rounds/:round/pairings - DbError', () => {
    it('returns 500 when getPairings throws DbError', async () => {
        mockAccessAndRound();

        jest.spyOn(organizer, 'getPairings')
            .mockRejectedValue(dbError());

        const res = await request(app)
            .get(`${ROUND_URL}/pairings`)
            .set(auth());

        expect(res.status).toBe(500);
    });
});

describe('POST /rounds/:round/pairings - validation and DbError', () => {
    it('returns 400 when fields are missing', async () => {
        mockAccessAndRound();

        const res = await request(app)
            .post(`${ROUND_URL}/pairings`)
            .set(auth())
            .send({});

        expect(res.status).toBe(400);
    });

    it('returns 400 when prosecution equals defense', async () => {
        mockAccessAndRound();

        const res = await request(app)
            .post(`${ROUND_URL}/pairings`)
            .set(auth())
            .send({
                prosectionID: TEAM_ID,
                defenseID: TEAM_ID,
                courtroomID: PAIRING_ID,
            });

        expect(res.status).toBe(400);
    });

    it('returns 500 when createRoundPairing throws DbError', async () => {
        mockAccessAndRound();

        jest.spyOn(organizer, 'createRoundPairing')
            .mockRejectedValue(dbError());

        const res = await request(app)
            .post(`${ROUND_URL}/pairings`)
            .set(auth())
            .send({
                prosectionID: TEAM_ID,
                defenseID: PAIRING_ID,
                courtroomID: SCORER_ID,
            });

        expect(res.status).toBe(500);
    });
});

// ============================================================================
// Individual pairing routes
//
// IMPORTANT: these are mounted at
// /organizer/tournament/:tournamentId/pairings/:pairingId
// and are NOT nested under /rounds/:round.
// ============================================================================

const PAIRING_URL =
    `/organizer/tournament/${TOURNAMENT_ID}/pairings/${PAIRING_ID}`;

describe('DELETE /pairings/:pairingId', () => {
    it('returns 400 for invalid pairing UUID', async () => {
        mockAccess();

        const res = await request(app)
            .delete(`/organizer/tournament/${TOURNAMENT_ID}/pairings/not-a-uuid`)
            .set(auth());

        expect(res.status).toBe(400);
    });

    it('returns 404 when deletePairing throws NotFoundError', async () => {
        mockAccessAndPairing();

        jest.spyOn(organizer, 'deletePairing')
            .mockRejectedValue(notFoundError('Pairing not found'));

        const res = await request(app)
            .delete(PAIRING_URL)
            .set(auth());

        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/not found/i);
    });
});

describe('GET /pairings/:pairingId/scorers', () => {
    it('returns 400 for invalid pairing UUID', async () => {
        mockAccess();

        const res = await request(app)
            .get(`/organizer/tournament/${TOURNAMENT_ID}/pairings/bad-id/scorers`)
            .set(auth());

        expect(res.status).toBe(400);
    });

    it('returns 200 with scorer list', async () => {
        mockAccessAndPairing();

        jest.spyOn(organizer, 'getPairingScorers')
            .mockResolvedValue([] as any);

        const res = await request(app)
            .get(`${PAIRING_URL}/scorers`)
            .set(auth());

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});

describe('POST /pairings/:pairingId/scorers', () => {
    it('returns 400 for invalid pairing UUID', async () => {
        mockAccess();

        const res = await request(app)
            .post(`/organizer/tournament/${TOURNAMENT_ID}/pairings/bad-id/scorers`)
            .set(auth())
            .send({ scorer_id: SCORER_ID });

        expect(res.status).toBe(400);
    });

    it('returns 400 when scorer_id is not a UUID', async () => {
        mockAccessAndPairing();

        const res = await request(app)
            .post(`${PAIRING_URL}/scorers`)
            .set(auth())
            .send({ scorer_id: 'not-a-uuid' });

        expect(res.status).toBe(400);
    });

    it('returns 400 when neither scorer_id nor paper_name is provided', async () => {
        mockAccessAndPairing();

        const res = await request(app)
            .post(`${PAIRING_URL}/scorers`)
            .set(auth())
            .send({});

        expect(res.status).toBe(400);
    });

    it('returns 201 with paper_name', async () => {
        mockAccessAndPairing();

        const assignment = {
            assignment_id: ASSIGNMENT_ID,
            pairing_id: PAIRING_ID,
            scorer_id: null,
            paper_name: 'Paper Judge',
        };

        const addPaperScorer = jest.spyOn(organizer, 'addPaperScorer')
            .mockResolvedValue(assignment as any);

        const res = await request(app)
            .post(`${PAIRING_URL}/scorers`)
            .set(auth())
            .send({ paper_name: 'Paper Judge' });

        expect(res.status).toBe(201);
        expect(res.body).toEqual(assignment);
        expect(addPaperScorer)
            .toHaveBeenCalledWith(PAIRING_ID, 'Paper Judge');
    });

    it('returns 500 on DbError assigning scorer', async () => {
        mockAccessAndPairing();

        jest.spyOn(organizer, 'assignScorerToPairing')
            .mockRejectedValue(dbError());

        const res = await request(app)
            .post(`${PAIRING_URL}/scorers`)
            .set(auth())
            .send({ scorer_id: SCORER_ID });

        expect(res.status).toBe(500);
    });
});

describe('DELETE /pairings/:pairingId/scorers/:assignment', () => {
    it('returns 400 for invalid assignment UUID', async () => {
        mockAccessAndPairing();

        const res = await request(app)
            .delete(`${PAIRING_URL}/scorers/bad-id`)
            .set(auth());

        expect(res.status).toBe(400);
    });

    it('returns 404 when removeScorerAssignment throws NotFoundError', async () => {
        mockAccessAndPairing();

        jest.spyOn(organizer, 'removeScorerAssignment')
            .mockRejectedValue(notFoundError('Assignment not found'));

        const res = await request(app)
            .delete(`${PAIRING_URL}/scorers/${ASSIGNMENT_ID}`)
            .set(auth());

        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/not found/i);
    });
});

describe('PUT /pairings/:pairingId/presider', () => {
    it('returns 400 for invalid pairing UUID', async () => {
        mockAccess();

        const res = await request(app)
            .put(`/organizer/tournament/${TOURNAMENT_ID}/pairings/bad-id/presider`)
            .set(auth())
            .send({ assignment_id: ASSIGNMENT_ID });

        expect(res.status).toBe(400);
    });

    it('returns 400 when assignment_id is missing', async () => {
        mockAccessAndPairing();

        const res = await request(app)
            .put(`${PAIRING_URL}/presider`)
            .set(auth())
            .send({});

        expect(res.status).toBe(400);
    });

    it('returns 400 when assignment_id is invalid', async () => {
        mockAccessAndPairing();

        const res = await request(app)
            .put(`${PAIRING_URL}/presider`)
            .set(auth())
            .send({ assignment_id: 'bad-id' });

        expect(res.status).toBe(400);
    });

    it('returns 200 on success', async () => {
        mockAccessAndPairing();

        const setPresider = jest.spyOn(organizer, 'setPresider')
            .mockResolvedValue(undefined as any);

        const res = await request(app)
            .put(`${PAIRING_URL}/presider`)
            .set(auth())
            .send({ assignment_id: ASSIGNMENT_ID });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(setPresider)
            .toHaveBeenCalledWith(PAIRING_ID, ASSIGNMENT_ID, true);
    });

    it('returns 500 on DbError', async () => {
        mockAccessAndPairing();

        jest.spyOn(organizer, 'setPresider')
            .mockRejectedValue(dbError());

        const res = await request(app)
            .put(`${PAIRING_URL}/presider`)
            .set(auth())
            .send({ assignment_id: ASSIGNMENT_ID });

        expect(res.status).toBe(500);
    });
});

describe('DELETE /pairings/:pairingId/presider', () => {
    it('returns 400 for invalid pairing UUID', async () => {
        mockAccess();

        const res = await request(app)
            .delete(`/organizer/tournament/${TOURNAMENT_ID}/pairings/bad-id/presider`)
            .set(auth());

        expect(res.status).toBe(400);
    });

    it('returns 204 on success', async () => {
        mockAccessAndPairing();

        const clearPresider = jest.spyOn(organizer, 'clearPresider')
            .mockResolvedValue(undefined as any);

        const res = await request(app)
            .delete(`${PAIRING_URL}/presider`)
            .set(auth());

        expect(res.status).toBe(204);
        expect(clearPresider).toHaveBeenCalledWith(PAIRING_ID);
    });
});

// ============================================================================
// coachTeamRoutes uncovered branches
//
// These remain DB-level because coachTeamRoutes.ts was not available among
// the source router files in the conversation.
// ============================================================================

describe('coachTeamRoutes - team access + uncovered paths', () => {
    it('returns 400 for invalid teamId', async () => {
        const res = await request(app)
            .get('/coach/teams/not-a-uuid/coaches')
            .set(auth());

        expect(res.status).toBe(400);
    });

    it('returns 403 when user is not on team', async () => {
        mockDbQuery.mockResolvedValueOnce({
            rows: [],
            rowCount: 0,
        } as any);

        const res = await request(app)
            .get(`/coach/teams/${TEAM_ID}/coaches`)
            .set(auth());

        expect(res.status).toBe(403);
    });

    it('DELETE /students/:studentId returns 400 for invalid UUID', async () => {
        // Best-effort mock for verifyTeamAccess.
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ coach_id: 'user-1' }],
            rowCount: 1,
        } as any);

        const res = await request(app)
            .delete(`/coach/teams/${TEAM_ID}/students/not-a-uuid`)
            .set(auth());

        expect(res.status).toBe(400);
    });

    it('PUT /pairings/:pairingId/assignments returns 500 on db failure', async () => {
        // Best-effort sequence based on the existing test:
        // verifyTeamAccess -> round-lock lookup -> assignment upsert.
        mockDbQuery
            .mockResolvedValueOnce({
                rows: [{ coach_id: 'user-1' }],
                rowCount: 1,
            } as any)
            .mockResolvedValueOnce({
                rows: [{ locked: false }],
                rowCount: 1,
            } as any)
            .mockResolvedValueOnce(null as any);

        const res = await request(app)
            .put(`/coach/teams/${TEAM_ID}/pairings/${PAIRING_ID}/assignments`)
            .set(auth())
            .send({
                field_id: SCORER_ID,
                student_id: STUDENT_ID,
            });

        expect(res.status).toBe(500);
    });
});