jest.mock('../../src/email', () => jest.requireActual('../mocks/email'));
jest.mock('../../src/providers/coachProvider', () => {
    const actual = jest.requireActual('../../src/providers/coachProvider');
    return {
        ...actual,
        canViewPairingResults: jest.fn(),
        getPairingBallots: jest.fn(),
        isBallotInPairingWithPublicResults: jest.fn(),
        sharesIndividualRankings: jest.fn(),
        getDefaultWitnessCallOrder: jest.fn(),
        setDefaultWitnessCallOrder: jest.fn(),
        getDefaultStudentAssignments: jest.fn(),
        upsertDefaultStudentAssignment: jest.fn(),
        deleteDefaultStudentAssignment: jest.fn(),
        isPairingRoundLocked: jest.fn(),
        bulkUpsertStudentAssignments: jest.fn(),
        getTeamIdForCoach: jest.fn(),
        getSchedule: jest.fn(),
    };
});
jest.mock('../../src/providers/scorerProvider', () => {
    const actual = jest.requireActual('../../src/providers/scorerProvider');
    return {
        ...actual,
        getBallot: jest.fn(),
        getSheetFromBallot: jest.fn(),
    };
});
import request from 'supertest';
import app from '../../src/appService';
import { dbQuery } from '../../src/db';
import {
    bulkUpsertStudentAssignments,
    canViewPairingResults,
    deleteDefaultStudentAssignment,
    getDefaultStudentAssignments,
    getDefaultWitnessCallOrder,
    getPairingBallots,
    getSchedule,
    getTeamIdForCoach,
    isBallotInPairingWithPublicResults,
    isPairingRoundLocked,
    setDefaultWitnessCallOrder,
    sharesIndividualRankings,
    upsertDefaultStudentAssignment,
} from '../../src/providers/coachProvider';
import { getBallot, getSheetFromBallot } from '../../src/providers/scorerProvider';
import { setupAuth, makeAuth } from '../helpers/auth';

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;
const mockGetBallot = getBallot as jest.MockedFunction<typeof getBallot>;
const mockGetSheetFromBallot = getSheetFromBallot as jest.MockedFunction<typeof getSheetFromBallot>;
const mockCanViewPairingResults = canViewPairingResults as jest.MockedFunction<typeof canViewPairingResults>;
const mockGetPairingBallots = getPairingBallots as jest.MockedFunction<typeof getPairingBallots>;
const mockIsBallotInPairingWithPublicResults = isBallotInPairingWithPublicResults as jest.MockedFunction<typeof isBallotInPairingWithPublicResults>;
const mockSharesIndividualRankings = sharesIndividualRankings as jest.MockedFunction<typeof sharesIndividualRankings>;
const mockGetDefaultWitnessCallOrder = getDefaultWitnessCallOrder as jest.MockedFunction<typeof getDefaultWitnessCallOrder>;
const mockSetDefaultWitnessCallOrder = setDefaultWitnessCallOrder as jest.MockedFunction<typeof setDefaultWitnessCallOrder>;
const mockGetDefaultStudentAssignments = getDefaultStudentAssignments as jest.MockedFunction<typeof getDefaultStudentAssignments>;
const mockUpsertDefaultStudentAssignment = upsertDefaultStudentAssignment as jest.MockedFunction<typeof upsertDefaultStudentAssignment>;
const mockDeleteDefaultStudentAssignment = deleteDefaultStudentAssignment as jest.MockedFunction<typeof deleteDefaultStudentAssignment>;
const mockIsPairingRoundLocked = isPairingRoundLocked as jest.MockedFunction<typeof isPairingRoundLocked>;
const mockBulkUpsertStudentAssignments = bulkUpsertStudentAssignments as jest.MockedFunction<typeof bulkUpsertStudentAssignments>;
const mockGetTeamIdForCoach = getTeamIdForCoach as jest.MockedFunction<typeof getTeamIdForCoach>;
const mockGetSchedule = getSchedule as jest.MockedFunction<typeof getSchedule>;

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

// Every route in this file shares the same mocked dbQuery function. Some handlers
// return before consuming every queued value, so reset the one-shot queue between
// tests to prevent a failure in one case from changing middleware behavior later.
beforeEach(() => {
    mockDbQuery.mockReset();
    mockGetBallot.mockReset();
    mockGetSheetFromBallot.mockReset();
    mockCanViewPairingResults.mockReset();
    mockGetPairingBallots.mockReset();
    mockIsBallotInPairingWithPublicResults.mockReset();
    mockSharesIndividualRankings.mockReset();
    mockGetDefaultWitnessCallOrder.mockReset();
    mockSetDefaultWitnessCallOrder.mockReset();
    mockGetDefaultStudentAssignments.mockReset();
    mockUpsertDefaultStudentAssignment.mockReset();
    mockDeleteDefaultStudentAssignment.mockReset();
    mockIsPairingRoundLocked.mockReset();
    mockBulkUpsertStudentAssignments.mockReset();
    mockGetTeamIdForCoach.mockReset();
    mockGetSchedule.mockReset();
});

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

    it('returns 404 when pairing results are not viewable', async () => {
        mockCanViewPairingResults.mockResolvedValueOnce(false);
        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(404);
    });

    it('returns 200 with ballot summaries when results are viewable', async () => {
        mockCanViewPairingResults.mockResolvedValueOnce(true);
        mockGetPairingBallots.mockResolvedValueOnce([
            { p_points: 80, d_points: 70, scorer_assignment_id: AID },
        ] as any);
        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].p_points).toBe(80);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /tournaments/:id/pairings/:pairingId/ballots/:ballotId
// ═══════════════════════════════════════════════════════════════════════════════
describe('GET /api/coach/tournaments/:id/pairings/:pairingId/ballots/:ballotId', () => {
    const url = `/coach/tournaments/${TID}/pairings/${PID}/ballots/${AID}`;

    it('returns 400 for invalid tournament ID', async () => {
        const res = await request(app).get(`/coach/tournaments/bad/pairings/${PID}/ballots/${AID}`).set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 400 for invalid pairing ID', async () => {
        const res = await request(app).get(`/coach/tournaments/${TID}/pairings/bad/ballots/${AID}`).set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 400 for invalid ballot ID', async () => {
        const res = await request(app).get(`/coach/tournaments/${TID}/pairings/${PID}/ballots/bad`).set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 404 when the ballot is not in a public-results pairing', async () => {
        mockIsBallotInPairingWithPublicResults.mockResolvedValueOnce(false);
        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(404);
    });

    it('returns 200 with redacted scoresheet and ballot data', async () => {
        // isBallotInPairingWithPublicResults -> true
        mockIsBallotInPairingWithPublicResults.mockResolvedValueOnce(true);
        mockGetSheetFromBallot.mockResolvedValueOnce({
            scorer: { firstName: 'Jane', lastName: 'Judge', scorerID: 's1', isPaper: false },
            presiderName: 'Presider',
        } as any);
        mockGetBallot.mockResolvedValueOnce({
            ballot_json: { scores: [], nominations: [] },
        } as any);
        // sharesIndividualRankings -> true
        mockSharesIndividualRankings.mockResolvedValueOnce(true);

        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(200);
        expect(res.body.sheet).toBeTruthy();
        expect(res.body.sheet.scorer.firstName).toBe('');
        expect(res.body.sheet.scorer.lastName).toBe('');
        expect(res.body.ballot).toBeTruthy();
    });

    it('strips award nominations from the ballot when share_individual_rankings is false', async () => {
        // isBallotInPairingWithPublicResults -> true
        mockIsBallotInPairingWithPublicResults.mockResolvedValueOnce(true);
        mockGetSheetFromBallot.mockResolvedValueOnce({
            scorer: { firstName: 'Jane', lastName: 'Judge', scorerID: 's1', isPaper: false },
            presiderName: 'Presider',
        } as any);
        mockGetBallot.mockResolvedValueOnce({
            ballot_json: {
                scores: [],
                nominations: [{ awardCategoryId: 'ac1', studentId: 'stu1', rank: 1 }],
            },
        } as any);
        // sharesIndividualRankings -> false
        mockSharesIndividualRankings.mockResolvedValueOnce(false);

        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(200);
        expect(res.body.ballot).toBeTruthy();
        expect(res.body.ballot.nominations).toEqual([]);
    });

    it('returns 404 when both sheet and ballot are null', async () => {
        mockIsBallotInPairingWithPublicResults.mockResolvedValueOnce(true);
        mockGetSheetFromBallot.mockRejectedValueOnce(new Error('Ballot not found'));
        mockGetBallot.mockResolvedValueOnce(undefined as any);

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
        mockGetDefaultWitnessCallOrder.mockResolvedValueOnce([
            { witness_id: 'w1', witness_name: 'Alice', position: 1 },
        ] as any);
        const res = await request(app).get(`/coach/teams/${TEAM}/default-witness-order`).set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].witness_name).toBe('Alice');
    });

    it('returns 200 empty array when no defaults set', async () => {
        mockTeamAccess();
        mockGetDefaultWitnessCallOrder.mockResolvedValueOnce([] as any);
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
        mockSetDefaultWitnessCallOrder.mockResolvedValueOnce(undefined as any);
        const res = await request(app).put(`/coach/teams/${TEAM}/default-witness-order`).set(auth())
            .send({ witness_ids: [] });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('returns 200 on success with witness IDs', async () => {
        mockTeamAccess();
        mockSetDefaultWitnessCallOrder.mockResolvedValueOnce(undefined as any);
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
        mockGetDefaultStudentAssignments.mockResolvedValueOnce([
            { id: 'da1', team_id: TEAM, field_id: FID, student_id: SID, witness_id: null, field_label: 'Opening', student_name: 'Bob' },
        ] as any);
        const res = await request(app).get(`/coach/teams/${TEAM}/default-assignments`).set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
    });

    it('returns 200 empty when no defaults', async () => {
        mockTeamAccess();
        mockGetDefaultStudentAssignments.mockResolvedValueOnce([] as any);
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
        mockUpsertDefaultStudentAssignment.mockResolvedValueOnce(undefined as any);
        const res = await request(app).put(`/coach/teams/${TEAM}/default-assignments`).set(auth())
            .send({ field_id: FID, student_id: SID });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('returns 200 with witness_id', async () => {
        mockTeamAccess();
        mockUpsertDefaultStudentAssignment.mockResolvedValueOnce(undefined as any);
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
        mockDeleteDefaultStudentAssignment.mockResolvedValueOnce(undefined as any);
        const res = await request(app).delete(`/coach/teams/${TEAM}/default-assignments`).set(auth())
            .send({ field_id: FID });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('returns 200 with witness_id', async () => {
        mockTeamAccess();
        mockDeleteDefaultStudentAssignment.mockResolvedValueOnce(undefined as any);
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
        mockIsPairingRoundLocked.mockResolvedValueOnce(false);
        mockBulkUpsertStudentAssignments.mockResolvedValueOnce(undefined as any);
        const res = await request(app).post(url).set(auth())
            .send({ assignments: [] });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('returns 200 on success with assignments', async () => {
        mockTeamAccess();
        mockIsPairingRoundLocked.mockResolvedValueOnce(false);
        mockBulkUpsertStudentAssignments.mockResolvedValueOnce(undefined as any);
        const res = await request(app).post(url).set(auth())
            .send({ assignments: [
                    { field_id: FID, student_id: SID },
                    { field_id: 'f2', student_id: 's2', witness_id: 'w1' },
                ] });
        expect(res.status).toBe(200);
    });

    it('returns 409 when the round is locked', async () => {
        mockTeamAccess();
        mockIsPairingRoundLocked.mockResolvedValueOnce(true);
        const res = await request(app).post(url).set(auth())
            .send({ assignments: [{ field_id: FID, student_id: SID }] });
        expect(res.status).toBe(409);
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
        mockGetTeamIdForCoach.mockResolvedValueOnce(null as any);
        const res = await request(app)
            .get(`/coach/tournaments/${TID}/schedule`)
            .set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('returns schedule when explicit teamId provided', async () => {
        mockGetSchedule.mockResolvedValueOnce([] as any);
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