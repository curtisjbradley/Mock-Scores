import { Request, Response } from 'express';
import * as coachProvider from '../providers/coachProvider';
import { AlreadyExistsError, NotFoundError } from '../errors';

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
