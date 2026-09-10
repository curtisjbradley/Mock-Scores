jest.mock('../../src/providers/coachProvider', () => ({
    removeCoach: jest.fn(),
    addStudent: jest.fn(),
    updateStudentCustomData: jest.fn(),
}));

import type { Request, Response } from 'express';
import * as coachProvider from '../../src/providers/coachProvider';
import { AlreadyExistsError, NotFoundError } from '../../src/errors';
import {
    addStudentHandler,
    removeCoachHandler,
    updateStudentCustomDataHandler,
} from '../../src/routes/teamHandlers';

const mockRemoveCoach = coachProvider.removeCoach as jest.MockedFunction<typeof coachProvider.removeCoach>;
const mockAddStudent = coachProvider.addStudent as jest.MockedFunction<typeof coachProvider.addStudent>;
const mockUpdateStudentCustomData = coachProvider.updateStudentCustomData as jest.MockedFunction<typeof coachProvider.updateStudentCustomData>;

const TEAM_ID = '00000000-0000-0000-0000-000000000001';
const COACH_ID = '00000000-0000-0000-0000-000000000002';
const STUDENT_ID = '00000000-0000-0000-0000-000000000003';

function makeResponse(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res as Response;
}

function makeRequest(params: Record<string, string>, body: unknown = {}): Request {
    return { params, body } as unknown as Request;
}

beforeEach(() => {
    jest.resetAllMocks();
});

describe('removeCoachHandler', () => {
    it('removes a coach and returns 204', async () => {
        mockRemoveCoach.mockResolvedValueOnce(undefined);
        const req = makeRequest({ teamId: TEAM_ID, coachId: COACH_ID });
        const res = makeResponse();

        await removeCoachHandler(req, res);

        expect(mockRemoveCoach).toHaveBeenCalledWith(TEAM_ID, COACH_ID);
        expect(res.status).toHaveBeenCalledWith(204);
        expect(res.send).toHaveBeenCalled();
    });

    it('returns 404 when the coach is not found', async () => {
        mockRemoveCoach.mockRejectedValueOnce(new NotFoundError('coach'));
        const res = makeResponse();

        await removeCoachHandler(makeRequest({ teamId: TEAM_ID, coachId: COACH_ID }), res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it('rethrows unexpected errors', async () => {
        const error = new Error('database exploded');
        mockRemoveCoach.mockRejectedValueOnce(error);

        await expect(
            removeCoachHandler(makeRequest({ teamId: TEAM_ID, coachId: COACH_ID }), makeResponse()),
        ).rejects.toBe(error);
    });
});

describe('addStudentHandler', () => {
    it.each([
        undefined,
        '',
        '   ',
    ])('returns 400 for missing or blank student_name: %p', async student_name => {
        const res = makeResponse();

        await addStudentHandler(makeRequest({ teamId: TEAM_ID }, { student_name }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Missing student_name' });
        expect(mockAddStudent).not.toHaveBeenCalled();
    });

    it('trims the name, passes pronouns, and returns 201', async () => {
        const student = {
            student_id: STUDENT_ID,
            team_id: TEAM_ID,
            student_name: 'Alex Student',
            pronouns: 'they/them',
        } as any;
        mockAddStudent.mockResolvedValueOnce(student);
        const res = makeResponse();

        await addStudentHandler(
            makeRequest({ teamId: TEAM_ID }, { student_name: '  Alex Student  ', pronouns: 'they/them' }),
            res,
        );

        expect(mockAddStudent).toHaveBeenCalledWith(TEAM_ID, 'Alex Student', 'they/them');
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(student);
    });

    it('passes null when pronouns are omitted', async () => {
        mockAddStudent.mockResolvedValueOnce({ student_id: STUDENT_ID } as any);
        const res = makeResponse();

        await addStudentHandler(
            makeRequest({ teamId: TEAM_ID }, { student_name: 'Sam' }),
            res,
        );

        expect(mockAddStudent).toHaveBeenCalledWith(TEAM_ID, 'Sam', null);
    });

    it('returns 409 when the student already exists', async () => {
        mockAddStudent.mockRejectedValueOnce(new AlreadyExistsError('student'));
        const res = makeResponse();

        await addStudentHandler(
            makeRequest({ teamId: TEAM_ID }, { student_name: 'Sam' }),
            res,
        );

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({ message: 'Student already on roster' });
    });

    it('rethrows unexpected errors', async () => {
        const error = new Error('database exploded');
        mockAddStudent.mockRejectedValueOnce(error);

        await expect(
            addStudentHandler(makeRequest({ teamId: TEAM_ID }, { student_name: 'Sam' }), makeResponse()),
        ).rejects.toBe(error);
    });
});

describe('updateStudentCustomDataHandler', () => {
    it('returns 400 for an invalid student id', async () => {
        const res = makeResponse();

        await updateStudentCustomDataHandler(
            makeRequest({ studentId: 'bad-id' }, { custom_data: [] }),
            res,
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Invalid student ID' });
        expect(mockUpdateStudentCustomData).not.toHaveBeenCalled();
    });

    it.each([
        ['non-array', { custom_data: 'bad' }],
        ['null entry', { custom_data: [null] }],
        ['primitive entry', { custom_data: ['bad'] }],
        ['missing field', { custom_data: [{ type: 'string', value: 'x' }] }],
        ['blank field', { custom_data: [{ field: '   ', type: 'string', value: 'x' }] }],
        ['invalid type', { custom_data: [{ field: 'Grade', type: 'bool', value: 'x' }] }],
        ['invalid value', { custom_data: [{ field: 'Grade', type: 'string', value: true }] }],
    ])('returns 400 for invalid custom_data: %s', async (_name, body) => {
        const res = makeResponse();

        await updateStudentCustomDataHandler(makeRequest({ studentId: STUDENT_ID }, body), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Invalid custom_data' });
        expect(mockUpdateStudentCustomData).not.toHaveBeenCalled();
    });

    it('accepts valid string and numeric custom data', async () => {
        const custom_data = [
            { field: 'Year', type: 'int' as const, value: 2027 },
            { field: 'Section', type: 'string' as const, value: 'A' },
        ];
        const updated = { student_id: STUDENT_ID, custom_data } as any;
        mockUpdateStudentCustomData.mockResolvedValueOnce(updated);
        const res = makeResponse();

        await updateStudentCustomDataHandler(
            makeRequest({ studentId: STUDENT_ID }, { custom_data }),
            res,
        );

        expect(mockUpdateStudentCustomData).toHaveBeenCalledWith(STUDENT_ID, custom_data);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(updated);
    });

    it('accepts an empty custom_data array', async () => {
        mockUpdateStudentCustomData.mockResolvedValueOnce({ student_id: STUDENT_ID } as any);
        const res = makeResponse();

        await updateStudentCustomDataHandler(
            makeRequest({ studentId: STUDENT_ID }, { custom_data: [] }),
            res,
        );

        expect(mockUpdateStudentCustomData).toHaveBeenCalledWith(STUDENT_ID, []);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns 404 when the student is not found', async () => {
        mockUpdateStudentCustomData.mockRejectedValueOnce(new NotFoundError('student'));
        const res = makeResponse();

        await updateStudentCustomDataHandler(
            makeRequest({ studentId: STUDENT_ID }, { custom_data: [] }),
            res,
        );

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });

    it('rethrows unexpected errors', async () => {
        const error = new Error('database exploded');
        mockUpdateStudentCustomData.mockRejectedValueOnce(error);

        await expect(
            updateStudentCustomDataHandler(
                makeRequest({ studentId: STUDENT_ID }, { custom_data: [] }),
                makeResponse(),
            ),
        ).rejects.toBe(error);
    });
});
