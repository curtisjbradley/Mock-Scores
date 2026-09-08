import { Request, Response } from 'express';
import * as coachProvider from '../providers/coachProvider';
import { AlreadyExistsError, NotFoundError } from '../errors';
import { uuidRegex } from '../authUtils';
import type { IStudent } from '@mock-scores/shared';

type CustomDatum = NonNullable<IStudent['custom_data']>[number];

/** Validates the custom_data payload: an array of {field, type, value} entries. */
function parseCustomData(input: unknown): CustomDatum[] | null {
    if (!Array.isArray(input)) return null;
    const out: CustomDatum[] = [];
    for (const entry of input) {
        if (typeof entry !== 'object' || entry === null) return null;
        const { field, type, value } = entry as Record<string, unknown>;
        if (typeof field !== 'string' || !field.trim()) return null;
        if (type !== 'int' && type !== 'string') return null;
        if (typeof value !== 'string' && typeof value !== 'number') return null;
        out.push({ field, type, value });
    }
    return out;
}

export async function removeCoachHandler(req: Request, res: Response): Promise<Response> {
    try {
        await coachProvider.removeCoach(req.params.teamId as string, req.params.coachId as string);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: (e as NotFoundError).message });
        throw e;
    }
}

export async function addStudentHandler(req: Request, res: Response): Promise<Response> {
    const { student_name, pronouns } = req.body as { student_name?: string; pronouns?: string };
    if (!student_name?.trim()) return res.status(400).json({ message: 'Missing student_name' });
    try {
        return res.status(201).json(await coachProvider.addStudent(req.params.teamId as string, student_name.trim(), pronouns ?? null));
    } catch (e) {
        if (e instanceof AlreadyExistsError) return res.status(409).json({ message: 'Student already on roster' });
        throw e;
    }
}

export async function updateStudentCustomDataHandler(req: Request, res: Response): Promise<Response> {
    const studentId = req.params.studentId as string;
    if (!uuidRegex.test(studentId)) return res.status(400).json({ message: 'Invalid student ID' });
    const customData = parseCustomData((req.body as { custom_data?: unknown }).custom_data);
    if (customData === null) return res.status(400).json({ message: 'Invalid custom_data' });
    try {
        return res.status(200).json(await coachProvider.updateStudentCustomData(studentId, customData));
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: (e as NotFoundError).message });
        throw e;
    }
}
