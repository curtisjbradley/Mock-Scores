jest.mock('../../src/providers/scorerProvider', () => ({
    getSheetFromAssignment: jest.fn(),
    submitBallot: jest.fn(),
    submitNominations: jest.fn(),
    getConflictReportContext: jest.fn(),
}));

jest.mock('../../src/email', () => ({
    conflictReportEmail: jest.fn(() => ({
        subject: 'Conflict reported',
        html: '<p>Conflict reported</p>',
        text: 'Conflict reported',
    })),
    sendEmail: jest.fn(() => Promise.resolve(null)),
}));

import request from 'supertest';
import testApp from '../../src/appService';
import * as scorer from '../../src/providers/scorerProvider';
import { sendEmail, conflictReportEmail } from '../../src/email';
import {
    AlreadySubmittedError,
    ConflictReportedError,
    NotFoundError,
    RoundNotLockedError,
} from '../../src/errors';

const mockGetSheetFromAssignment = scorer.getSheetFromAssignment as jest.MockedFunction<typeof scorer.getSheetFromAssignment>;
const mockSubmitBallot = scorer.submitBallot as jest.MockedFunction<typeof scorer.submitBallot>;
const mockSubmitNominations = scorer.submitNominations as jest.MockedFunction<typeof scorer.submitNominations>;
const mockGetConflictReportContext = scorer.getConflictReportContext as jest.MockedFunction<typeof scorer.getConflictReportContext>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;
const mockConflictReportEmail = conflictReportEmail as jest.MockedFunction<typeof conflictReportEmail>;

const VALID_UUID = '00000000-0000-0000-0000-000000000001';
const INVALID_UUID = 'not-a-uuid';

/**
 * Build an instanceof-compatible error without depending on the custom error
 * constructor signature. This keeps these route tests isolated from error
 * implementation details while still exercising the route's instanceof checks.
 */
function errorOf<T extends Error>(ErrorType: { prototype: T }, message: string): T {
    const error = Object.create(ErrorType.prototype) as T;
    error.message = message;
    error.name = ErrorType.prototype.name || 'Error';
    return error;
}

const flushPromises = () => new Promise<void>(resolve => setImmediate(resolve));

beforeEach(() => {
    jest.resetAllMocks();

    // resetAllMocks removes the default implementations supplied by jest.mock,
    // so restore the two email helpers used by the conflict route.
    mockConflictReportEmail.mockReturnValue({
        subject: 'Conflict reported',
        html: '<p>Conflict reported</p>',
        text: 'Conflict reported',
    } as ReturnType<typeof conflictReportEmail>);
    mockSendEmail.mockResolvedValue(null);
});

// ─── GET /api/score/:assignmentId ─────────────────────────────────────────────
describe('GET /api/score/:assignmentId', () => {
    it('returns 400 for an invalid assignment ID', async () => {
        const res = await request(testApp).get(`/score/${INVALID_UUID}`);

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid assignment/i);
        expect(mockGetSheetFromAssignment).not.toHaveBeenCalled();
    });

    it('returns 404 when assignment does not exist', async () => {
        mockGetSheetFromAssignment.mockRejectedValueOnce(
            errorOf(NotFoundError, 'Assignment not found'),
        );

        const res = await request(testApp).get(`/score/${VALID_UUID}`);

        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/not found/i);
        expect(mockGetSheetFromAssignment).toHaveBeenCalledWith(VALID_UUID);
    });

    it('returns 410 when ballot already submitted', async () => {
        mockGetSheetFromAssignment.mockRejectedValueOnce(
            errorOf(AlreadySubmittedError, 'Ballot already submitted'),
        );

        const res = await request(testApp).get(`/score/${VALID_UUID}`);

        expect(res.status).toBe(410);
        expect(res.body.message).toMatch(/already submitted/i);
    });

    it('returns 409 when conflict reported', async () => {
        mockGetSheetFromAssignment.mockRejectedValueOnce(
            errorOf(ConflictReportedError, 'Conflict reported'),
        );

        const res = await request(testApp).get(`/score/${VALID_UUID}`);

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/conflict/i);
    });

    it('returns the score sheet supplied by the provider', async () => {
        const sheet = {
            isCriminal: true,
            caseName: 'State v. Doe',
            prosecutionCode: '101',
            defenseCode: '202',
            scorer: {
                firstName: 'Jane',
                lastName: 'Judge',
                scorerID: 's1',
                isPaper: false,
            },
            scoringCategories: {
                cat1: { name: 'Opening' },
            },
        };
        mockGetSheetFromAssignment.mockResolvedValueOnce(sheet as never);

        const res = await request(testApp).get(`/score/${VALID_UUID}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual(sheet);
        expect(mockGetSheetFromAssignment).toHaveBeenCalledWith(VALID_UUID);
    });
});

// ─── POST /api/score/:assignmentId/ballot ─────────────────────────────────────
describe('POST /api/score/:assignmentId/ballot', () => {
    const validPayload = {
        pairingID: 'p1',
        scores: [
            { categoryId: 'cat1', assignmentKey: 'open1', side: 'P', studentId: 's1', score: 8 },
            { categoryId: 'cat1', assignmentKey: 'open1', side: 'D', studentId: 's2', score: 7 },
        ],
        tiebreaker: VALID_UUID,
        nominations: [],
    };

    it('returns 400 for an invalid assignment ID', async () => {
        const res = await request(testApp)
            .post(`/score/${INVALID_UUID}/ballot`)
            .send(validPayload);

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid assignment/i);
        expect(mockSubmitBallot).not.toHaveBeenCalled();
    });

    it('returns 400 when payload is missing pairingID', async () => {
        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/ballot`)
            .send({ scores: [] });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid payload/i);
        expect(mockSubmitBallot).not.toHaveBeenCalled();
    });

    it('returns 400 when payload is missing scores array', async () => {
        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/ballot`)
            .send({ pairingID: 'p1' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid payload/i);
        expect(mockSubmitBallot).not.toHaveBeenCalled();
    });

    it('returns 400 for an invalid tiebreaker ID', async () => {
        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/ballot`)
            .send({ ...validPayload, tiebreaker: 'bad-id' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid payload/i);
        expect(mockSubmitBallot).not.toHaveBeenCalled();
    });

    it('returns 404 when assignment does not exist', async () => {
        mockSubmitBallot.mockRejectedValueOnce(
            errorOf(NotFoundError, 'Assignment not found'),
        );

        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/ballot`)
            .send(validPayload);

        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/not found/i);
    });

    it('returns 409 when the round is not locked', async () => {
        mockSubmitBallot.mockRejectedValueOnce(
            errorOf(RoundNotLockedError, 'Round not locked'),
        );

        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/ballot`)
            .send(validPayload);

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/scoring is not open/i);
    });

    it('returns 409 when ballot already submitted (unique constraint code)', async () => {
        const pgError = Object.assign(new Error('duplicate key'), {
            code: '23505',
            detail: '',
        });
        mockSubmitBallot.mockRejectedValueOnce(pgError);

        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/ballot`)
            .send(validPayload);

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/already submitted/i);
    });

    it('returns 409 when unique constraint detail names scorer_assignment_id', async () => {
        const pgError = Object.assign(new Error('duplicate key'), {
            code: '',
            detail: 'Key (scorer_assignment_id) already exists',
        });
        mockSubmitBallot.mockRejectedValueOnce(pgError);

        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/ballot`)
            .send(validPayload);

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/already submitted/i);
    });

    it('returns 201 on successful ballot submission and passes the payload through unchanged', async () => {
        mockSubmitBallot.mockResolvedValueOnce(undefined as never);

        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/ballot`)
            .send(validPayload);

        expect(res.status).toBe(201);
        expect(res.body.message).toMatch(/ballot submitted/i);
        expect(mockSubmitBallot).toHaveBeenCalledTimes(1);
        expect(mockSubmitBallot).toHaveBeenCalledWith(VALID_UUID, validPayload);
    });

    it('passes nominations through as part of the ballot payload', async () => {
        const payload = {
            ...validPayload,
            nominations: [
                { awardCategoryId: 'award1', studentId: 'stu1', rank: 1 },
                { awardCategoryId: 'award1', studentId: 'stu2', rank: 2 },
            ],
        };
        mockSubmitBallot.mockResolvedValueOnce(undefined as never);

        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/ballot`)
            .send(payload);

        expect(res.status).toBe(201);
        expect(mockSubmitBallot).toHaveBeenCalledWith(VALID_UUID, payload);
    });
});

// ─── POST /api/score/:assignmentId/nominations ────────────────────────────────
describe('POST /api/score/:assignmentId/nominations', () => {
    const nominations = [
        { awardCategoryId: 'award1', studentId: 'stu1', rank: 1 },
        { awardCategoryId: 'award1', studentId: 'stu2', rank: 2 },
    ];

    it('returns 400 for an invalid assignment ID', async () => {
        const res = await request(testApp)
            .post(`/score/${INVALID_UUID}/nominations`)
            .send({ nominations });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid assignment/i);
        expect(mockSubmitNominations).not.toHaveBeenCalled();
    });

    it('returns 400 when nominations is not an array', async () => {
        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/nominations`)
            .send({ nominations: 'not-an-array' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/nominations array is required/i);
        expect(mockSubmitNominations).not.toHaveBeenCalled();
    });

    it('returns 404 when no submitted ballot exists', async () => {
        mockSubmitNominations.mockRejectedValueOnce(
            errorOf(NotFoundError, 'Ballot not found'),
        );

        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/nominations`)
            .send({ nominations });

        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/not found/i);
    });

    it('returns 200 and forwards nominations to the provider', async () => {
        mockSubmitNominations.mockResolvedValueOnce(undefined as never);

        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/nominations`)
            .send({ nominations });

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/nominations saved/i);
        expect(mockSubmitNominations).toHaveBeenCalledWith(VALID_UUID, nominations);
    });
});

// ─── POST /api/score/:assignmentId/conflict ───────────────────────────────────
describe('POST /api/score/:assignmentId/conflict', () => {
    it('returns 400 for an invalid assignment ID', async () => {
        const res = await request(testApp)
            .post(`/score/${INVALID_UUID}/conflict`);

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid assignment/i);
        expect(mockGetConflictReportContext).not.toHaveBeenCalled();
    });

    it('returns 200 immediately and starts the conflict-context lookup', async () => {
        mockGetConflictReportContext.mockResolvedValueOnce(null as never);

        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/conflict`);

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/conflict reported/i);
        expect(mockGetConflictReportContext).toHaveBeenCalledWith(VALID_UUID);
    });

    it('sends conflict notification email when context is returned', async () => {
        mockGetConflictReportContext.mockResolvedValueOnce({
            ownerFirstName: 'Alex',
            scorerName: 'Jane Judge',
            tournamentName: 'State Championship',
            roundName: 'Round 1',
            courtroomName: 'Room A',
            ownerEmail: 'owner@example.com',
        } as never);

        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/conflict`);

        expect(res.status).toBe(200);
        await flushPromises();

        expect(mockConflictReportEmail).toHaveBeenCalledWith(
            'Alex',
            'Jane Judge',
            'State Championship',
            'Round 1',
            'Room A',
        );
        expect(mockSendEmail).toHaveBeenCalledWith(
            'owner@example.com',
            'Conflict reported',
            '<p>Conflict reported</p>',
            'Conflict reported',
        );
    });

    it('does not send email when the conflict was already reported', async () => {
        mockGetConflictReportContext.mockResolvedValueOnce('already_reported' as never);

        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/conflict`);

        expect(res.status).toBe(200);
        await flushPromises();
        expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('does not send email when no conflict context exists', async () => {
        mockGetConflictReportContext.mockResolvedValueOnce(null as never);

        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/conflict`);

        expect(res.status).toBe(200);
        await flushPromises();
        expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('still returns 200 when the fire-and-forget lookup later rejects', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        mockGetConflictReportContext.mockRejectedValueOnce(new Error('database unavailable'));

        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/conflict`);

        expect(res.status).toBe(200);
        await flushPromises();
        expect(mockSendEmail).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
    });
});

// ─── Provider-composed sheet variants ─────────────────────────────────────────
// These are intentionally pass-through route tests. Paper-scorer resolution,
// presider resolution, witness ordering, and student mapping belong in
// scorerProvider tests, because scorerRoutes does not implement that logic.
describe('GET /api/score/:assignmentId — provider-composed sheet variants', () => {
    it('passes through a paper scorer sheet', async () => {
        const sheet = {
            scorer: {
                firstName: 'Paper Pat',
                lastName: '',
                scorerID: 'ps1',
                isPaper: true,
            },
        };
        mockGetSheetFromAssignment.mockResolvedValueOnce(sheet as never);

        const res = await request(testApp).get(`/score/${VALID_UUID}`);

        expect(res.status).toBe(200);
        expect(res.body.scorer.firstName).toBe('Paper Pat');
        expect(res.body.scorer.lastName).toBe('');
        expect(res.body.scorer.isPaper).toBe(true);
    });

    it('passes through presider and ballot options', async () => {
        const sheet = {
            presiderName: 'Alex Presider',
            ballotOptions: { fillableScores: true },
        };
        mockGetSheetFromAssignment.mockResolvedValueOnce(sheet as never);

        const res = await request(testApp).get(`/score/${VALID_UUID}`);

        expect(res.status).toBe(200);
        expect(res.body.presiderName).toBe('Alex Presider');
        expect(res.body.ballotOptions.fillableScores).toBe(true);
    });

    it('passes through show-scores-derived ballot options', async () => {
        const sheet = {
            ballotOptions: { fillableScores: false, showTiebreaker: true },
        };
        mockGetSheetFromAssignment.mockResolvedValueOnce(sheet as never);

        const res = await request(testApp).get(`/score/${VALID_UUID}`);

        expect(res.status).toBe(200);
        expect(res.body.ballotOptions.fillableScores).toBe(false);
        expect(res.body.ballotOptions.showTiebreaker).toBe(true);
    });

    it('passes through witness and student data', async () => {
        const sheet = {
            witnesses: {
                w2: { characterName: 'Witness B' },
            },
            students: {
                stu1: { name: 'Alice', pronouns: 'she/her', schoolId: 't1' },
                stu2: { name: 'Bob', pronouns: null, schoolId: 't2' },
            },
            categoryOrder: ['cat1__w2'],
        };
        mockGetSheetFromAssignment.mockResolvedValueOnce(sheet as never);

        const res = await request(testApp).get(`/score/${VALID_UUID}`);

        expect(res.status).toBe(200);
        expect(res.body.witnesses.w2).toEqual({ characterName: 'Witness B' });
        expect(res.body.students.stu1).toEqual({ name: 'Alice', pronouns: 'she/her', schoolId: 't1' });
        expect(res.body.students.stu2).toEqual({ name: 'Bob', pronouns: null, schoolId: 't2' });
        expect(res.body.categoryOrder[0]).toBe('cat1__w2');
    });
});
