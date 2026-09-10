import {Router} from "express";
import {pairingHandler} from "../../types/handlers";
import {uuidRegex} from "../../authUtils";
import {IPairingCreationPayload} from "@mock-scores/shared";
import {DbError, NotFoundError} from "../../errors";
const router = Router();
import * as organizer from "../../providers/organizerProvider";
import {getBallot, getPairingBallotFormat, getSheetFromBallot} from "../../providers/scorerProvider";
import {listSubmittedBallots} from "../../providers/organizerProvider";


/**
 * @swagger
 * /organizer/tournament/{tournamentId}/pairings/{pairing}:
 *   put:
 *     summary: Update a pairing's teams and/or courtroom
 *     tags: [Organizer - Rounds]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: round
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: pairing
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [prosectionID, defenseID]
 *             properties:
 *               prosectionID: { type: string, format: uuid }
 *               defenseID: { type: string, format: uuid }
 *               courtroomID: { type: string | null, format: uuid }
 *     responses:
 *       200: { description: Updated pairing }
 *       400: { description: Missing fields or duplicate teams }
 *       404: { description: Pairing not found }
 *       409: { description: Team already assigned this round }
 *       500: { description: Database error }
 */
router.put('/', pairingHandler(async (req, res) => {
    const pairing = req.pairing;
    if (!uuidRegex.test(pairing.pairing_id)) return res.status(400).json({ message: 'Invalid pairing ID' });
    const { prosectionID, defenseID, courtroomID }: IPairingCreationPayload = req.body;
    if (!prosectionID || !defenseID) return res.status(400).json({ message: "Missing required fields" });
    if (prosectionID === defenseID) return res.status(400).json({ message: "Prosecution and defense teams must differ" });
    try {
        return res.status(200).json(await organizer.updatePairing(pairing.pairing_id, prosectionID, defenseID, courtroomID));
    } catch (e: unknown) {
        const detail: string = (e as { detail?: string })?.detail ?? '';
        if (detail.includes('p_team')) return res.status(409).json({ message: "That team is already assigned as prosecution this round" });
        if (detail.includes('d_team')) return res.status(409).json({ message: "That team is already assigned as defense this round" });
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to update pairing' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/pairings/{pairing}:
 *   delete:
 *     summary: Delete a pairing
 *     tags: [Organizer - Rounds]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: round
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: pairing
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Deleted }
 *       400: { description: Invalid pairing ID }
 *       404: { description: Not found }
 */
router.delete('/', pairingHandler(async (req, res) => {
    const pairing = req.pairing
    if (!uuidRegex.test(pairing.pairing_id)) return res.status(400).json({ message: 'Invalid pairing ID' });
    try {
        await organizer.deletePairing(pairing.pairing_id);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/pairings/{pairing}/scorers:
 *   get:
 *     summary: Get scorers assigned to a pairing
 *     tags: [Organizer - Rounds]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: round
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: pairing
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Array of scorer assignments }
 *       400: { description: Invalid pairing ID }
 */
router.get('/scorers', pairingHandler( async (req, res) => {
    const pairing = req.pairing;
    if (!uuidRegex.test(pairing.pairing_id)) return res.status(400).json({ message: 'Invalid pairing ID' });
    return res.status(200).json(await organizer.getPairingScorers(pairing.pairing_id));
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/pairings/{pairing}/ballot-format:
 *   get:
 *     summary: Get the blank printable ballot format for a pairing
 *     description: >
 *       Returns the full scoresheet format (categories, students, witnesses,
 *       award categories, team codes, courtroom, presider) for a pairing without
 *       requiring a scorer assignment. Used to generate a blank downloadable ballot.
 *     tags: [Organizer - Rounds]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: round
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: pairing
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Blank ballot format (IScoreSheetFormat) }
 *       400: { description: Invalid pairing ID }
 *       404: { description: Pairing not found }
 *       500: { description: Unable to build ballot }
 */
router.get('/ballot-format', pairingHandler(async (req, res) => {
    const pairing = req.pairing;
    if (!uuidRegex.test(pairing.pairing_id)) return res.status(400).json({ message: 'Invalid pairing ID' });
    try {
        return res.status(200).json(await getPairingBallotFormat(pairing.pairing_id));
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: 'Pairing not found' });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to build ballot' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/pairings/{pairing}/scorers:
 *   post:
 *     summary: Assign a scorer to a pairing
 *     tags: [Organizer - Rounds]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: round
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: pairing
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scorer_id: { type: string, format: uuid }
 *               paper_name: { type: string }
 *     responses:
 *       201: { description: Assignment created }
 *       400: { description: Invalid ID or missing body }
 *       500: { description: Unable to assign scorer }
 */
router.post('/scorers', pairingHandler(async (req, res) => {
    const pairing = req.pairing;
    if (!uuidRegex.test(pairing.pairing_id)) return res.status(400).json({ message: 'Invalid pairing ID' });
    const { scorer_id, paper_name } = req.body as { scorer_id?: string; paper_name?: string };
    try {
        if (scorer_id) {
            if (!uuidRegex.test(scorer_id)) return res.status(400).json({ message: 'Invalid scorer ID' });
            const result = await organizer.assignScorerToPairing(pairing.pairing_id, scorer_id);
            return res.status(201).json(result);
        }
        if (paper_name?.trim()) {
            return res.status(201).json(await organizer.addPaperScorer(pairing.pairing_id, paper_name.trim()));
        }
        return res.status(400).json({ message: 'Provide scorer_id or paper_name' });
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to assign scorer' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/pairings/{pairing}/scorers/{assignment}:
 *   delete:
 *     summary: Remove a scorer assignment from a pairing
 *     tags: [Organizer - Rounds]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: round
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: pairing
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: assignment
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Removed }
 *       400: { description: Invalid assignment ID }
 *       404: { description: Not found }
 */
router.delete('/scorers/:assignment', async (req, res) => {
    const assignment = req.params.assignment as string;
    if (!uuidRegex.test(assignment)) return res.status(400).json({ message: 'Invalid assignment ID' });
    try {
        await organizer.removeScorerAssignment(assignment);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
});

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/pairings/{pairing}/presider:
 *   put:
 *     summary: Set the presiding scorer for a pairing
 *     tags: [Organizer - Rounds]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: round
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: pairing
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [assignment_id]
 *             properties:
 *               assignment_id: { type: string, format: uuid }
 *     responses:
 *       200: { description: Presider set }
 *       400: { description: Invalid ID }
 *       500: { description: Database error }
 */
router.put('/presider',pairingHandler(async (req, res) => {
    const pairing = req.pairing;
    if (!uuidRegex.test(pairing.pairing_id)) return res.status(400).json({ message: 'Invalid pairing ID' });
    const { assignment_id, only_tiebreaker } = req.body as { assignment_id: string; only_tiebreaker?: boolean };
    if (!assignment_id || !uuidRegex.test(assignment_id)) return res.status(400).json({ message: 'Invalid assignment_id' });
    try {
        await organizer.setPresider(pairing.pairing_id, assignment_id, only_tiebreaker !== true);
        return res.status(200).json({ success: true });
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to set presider' });
        throw e;
    }
}));

/**
 * @swagger
 * /organizer/tournament/{tournamentId}/pairings/{pairing}/presider:
 *   delete:
 *     summary: Clear the presiding scorer for a pairing
 *     tags: [Organizer - Rounds]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: round
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: pairing
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Cleared }
 *       400: { description: Invalid pairing ID }
 */
router.delete('/presider', pairingHandler(async (req, res) => {
    const pairing = req.pairing;
    if (!uuidRegex.test(pairing.pairing_id)) return res.status(400).json({ message: 'Invalid pairing ID' });
    await organizer.clearPresider(pairing.pairing_id);
    return res.status(204).send();
}));


/**
 * GET /organizer/tournament/:tournamentId/pairings/:pairingId/scoresheets/:ballotID
 * Returns the stored ballot for a scorer assignment, or null if not yet submitted.
 * Used by the organizer's ScorecardViewer page.
 */
router.get('/scoresheets/:ballotId', pairingHandler(async (req, res) => {
    const ballotId = req.params.ballotId as string;
    if (!uuidRegex.test(ballotId)) return res.status(400).json({ message: 'Invalid ballot ID' });
    const [sheet, ballot, editLog] = await Promise.all([
        getSheetFromBallot(ballotId, { skipGuards: true }).catch(() => null),
        getBallot(ballotId),
        organizer.getBallotEditLog(ballotId),
    ]);
    return res.status(200).json({ sheet, ballot, editLog });
}));
/**
 * @swagger
 * /organizer/tournament/{tournamentId}/pairings/{pairingId}/scoresheets/{assignmentId}:
 *   put:
 *     summary: Edit a submitted ballot's scores
 *     tags: [Organizer - Scorecards]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: pairingId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [scores, reason]
 *             properties:
 *               scores: { type: array }
 *               reason: { type: string }
 *     responses:
 *       200: { description: Ballot updated }
 *       400: { description: Invalid input }
 *       404: { description: Ballot not found }
 *       500: { description: Database error }
 */
router.put('/scoresheets/:assignmentId', pairingHandler(async (req, res) => {
    const assignmentId = req.params.assignmentId as string;
    if (!uuidRegex.test(assignmentId)) return res.status(400).json({ message: 'Invalid assignment ID' });
    const { scores, reason } = req.body as { scores?: { assignmentKey: string; side: 'P' | 'D'; score: number; studentId: string | null; categoryId: string }[]; reason?: string };
    if (!Array.isArray(scores) || !reason?.trim()) return res.status(400).json({ message: 'scores array and reason are required' });
    try {
        await organizer.editBallot(assignmentId, { scores }, req.session.email, reason.trim());
        return res.status(200).json({ success: true });
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to update ballot' });
        throw e;
    }
}));
/**
 * @swagger
 * /organizer/tournament/{tournamentId}/pairings/{pairingId}/scoresheets/{ballotId}:
 *   delete:
 *     summary: Delete a submitted ballot
 *     tags: [Organizer - Scorecards]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: pairingId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: ballotId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Ballot deleted }
 *       400: { description: Invalid assignment ID }
 *       404: { description: Ballot not found }
 *       500: { description: Database error }
 */
router.delete('/scoresheets/:ballotId', pairingHandler(async (req, res) => {
    const ballotId = req.params.ballotId as string;
    if (!uuidRegex.test(ballotId)) return res.status(400).json({ message: 'Invalid ballotId ID' });
    try {
        await organizer.deleteBallot(ballotId);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to delete ballot' });
        throw e;
    }
}));

router.get("/ballots", pairingHandler(async (req,res) => {
    const pairing = req.pairing;
    try {
        const ballots = await listSubmittedBallots(pairing.pairing_id);
        return res.status(200).json(ballots)
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to fetch ballots' });
        throw e;
    }
}));

export default router;