import express from 'express';
import { Request, Response } from 'express';
import * as scorer from '../providers/scorerProvider';
import { AlreadySubmittedError, ConflictReportedError, NotFoundError } from '../errors';
import { uuidRegex } from '../authUtils';
import type { ScorecardPayload } from '@mock-scores/shared';
import { conflictReportEmail, sendEmail } from '../email';

const router = express.Router();

/**
 * GET /api/score/:assignmentId
 * Returns the IScoreSheetFormat for the given scorer assignment.
 * Public — no JWT required.
 */
router.get('/:assignmentId', async (req: Request, res: Response) => {
    const assignmentId = req.params.assignmentId as string;
    if (!uuidRegex.test(assignmentId)) return res.status(400).json({ message: 'Invalid assignment ID' });

    try {
        const sheet = await scorer.getScoreSheet(assignmentId);
        return res.status(200).json(sheet);
    } catch (e) {
        if (e instanceof AlreadySubmittedError) return res.status(410).json({ message: 'Ballot already submitted' });
        if (e instanceof ConflictReportedError) return res.status(409).json({ message: 'Conflict reported' });
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
});

/**
 * POST /api/score/:assignmentId/ballot
 * Accepts a ScorecardPayload and persists it to the ballots table.
 * Returns 409 if a ballot has already been submitted for this assignment.
 * Public — no JWT required.
 */
router.post('/:assignmentId/ballot', async (req: Request, res: Response) => {
    const assignmentId = req.params.assignmentId as string;
    if (!uuidRegex.test(assignmentId)) return res.status(400).json({ message: 'Invalid assignment ID' });

    const payload = req.body as ScorecardPayload;
    if (!payload?.pairingID || !Array.isArray(payload?.scores)) {
        return res.status(400).json({ message: 'Invalid payload' });
    }

    try {
        await scorer.submitBallot(assignmentId, payload);
        return res.status(201).json({ message: 'Ballot submitted' });
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        // Unique constraint on scorer_assignment_id means already submitted
        const detail = (e as { detail?: string })?.detail ?? '';
        const code = (e as { code?: string })?.code ?? '';
        if (code === '23505' || detail.includes('scorer_assignment_id')) {
            return res.status(409).json({ message: 'Ballot already submitted for this assignment' });
        }
        throw e;
    }
});

/**
 * POST /api/score/:assignmentId/conflict
 * Sends a conflict-of-interest notification email to the tournament owner.
 * Public — no JWT required (scorer is not logged in).
 * Fire-and-forget: always returns 200 so the scorer can't probe whether the
 * assignment ID is valid.
 */
router.post('/:assignmentId/conflict', async (req: Request, res: Response) => {
    const assignmentId = req.params.assignmentId as string;
    if (!uuidRegex.test(assignmentId)) return res.status(400).json({ message: 'Invalid assignment ID' });

    // Fire-and-forget — do not await so the scorer gets an instant response
    scorer.getConflictReportContext(assignmentId).then(ctx => {
        if (!ctx || ctx === 'already_reported') return;
        const template = conflictReportEmail(
            ctx.ownerFirstName,
            ctx.scorerName,
            ctx.tournamentName,
            ctx.roundName,
            ctx.courtroomName,
        );
        return sendEmail(ctx.ownerEmail, template.subject, template.html, template.text);
    }).catch(console.error);

    return res.status(200).json({ message: 'Conflict reported' });
});

export default router;
