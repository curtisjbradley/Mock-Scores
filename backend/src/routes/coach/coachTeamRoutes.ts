import { Router, Request, Response, NextFunction } from "express";
import * as coach from "../../providers/coachProvider";
import { AlreadyExistsError, DbError, NotFoundError } from "../../errors";
import { uuidRegex } from "../../authUtils";
import { dbQuery } from "../../db";
import { AuthenticatedRequest } from "../../types/express";
import { authedHandler } from "../../types/handlers";

const router = Router({ mergeParams: true });

export async function verifyTeamAccess(req: Request, res: Response, next: NextFunction) {
    const { session } = req as AuthenticatedRequest;
    const teamId = req.params.teamId as string;
    if (!uuidRegex.test(teamId)) return res.status(400).json({ message: "Invalid team ID" });
    const row = (await dbQuery<{ coach_id: string }>(
        `SELECT coach_id FROM team_coaches WHERE team_id=$1 AND coach_id=$2`,
        [teamId, session.userId]
    ))?.rows[0];
    if (!row) return res.status(403).json({ message: "No access to this team" });
    next();
}

router.use(verifyTeamAccess);

/**
 * @swagger
 * /api/coach/teams/{teamId}/coaches:
 *   get:
 *     summary: List coaches on a team
 *     tags: [Coach - Team]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Array of coaches }
 */
router.get("/coaches", authedHandler(async (req, res) => {
    return res.status(200).json(await coach.getCoaches(req.params.teamId as string));
}));

/**
 * @swagger
 * /api/coach/teams/{teamId}/coaches:
 *   post:
 *     summary: Add a coach to a team by email
 *     tags: [Coach - Team]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       201: { description: Coach added }
 *       400: { description: Missing email }
 */
router.post("/coaches", authedHandler(async (req, res) => {
    const { email } = req.body as { email?: string };
    if (!email) return res.status(400).json({ message: "Missing email" });
    return res.status(201).json(await coach.addCoach(req.params.teamId as string, email));
}));

/**
 * @swagger
 * /api/coach/teams/{teamId}/coaches/{coachId}:
 *   delete:
 *     summary: Remove a coach from a team
 *     tags: [Coach - Team]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: coachId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Removed }
 *       404: { description: Not found }
 */
router.delete("/coaches/:coachId", authedHandler(async (req, res) => {
    try {
        await coach.removeCoach(req.params.teamId as string, req.params.coachId as string);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
}));

/**
 * @swagger
 * /api/coach/teams/{teamId}/students:
 *   get:
 *     summary: List students on a team roster
 *     tags: [Coach - Team]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Array of students }
 */
router.get("/students", authedHandler(async (req, res) => {
    return res.status(200).json(await coach.getStudents(req.params.teamId as string));
}));

/**
 * @swagger
 * /api/coach/teams/{teamId}/students:
 *   post:
 *     summary: Add a student to the team roster
 *     tags: [Coach - Team]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [student_name]
 *             properties:
 *               student_name: { type: string }
 *               pronouns: { type: string }
 *     responses:
 *       201: { description: Student added }
 *       400: { description: Missing student_name }
 *       409: { description: Student already on roster }
 */
router.post("/students", authedHandler(async (req, res) => {
    const { student_name, pronouns } = req.body as { student_name?: string; pronouns?: string };
    if (!student_name?.trim()) return res.status(400).json({ message: "Missing student_name" });
    try {
        return res.status(201).json(await coach.addStudent(req.params.teamId as string, student_name.trim(), pronouns ?? null));
    } catch (e) {
        if (e instanceof AlreadyExistsError) return res.status(409).json({ message: 'Student already on roster' });
        throw e;
    }
}));

/**
 * @swagger
 * /api/coach/teams/{teamId}/students/{studentId}:
 *   delete:
 *     summary: Remove a student from the roster
 *     tags: [Coach - Team]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Removed }
 *       400: { description: Invalid student ID }
 *       404: { description: Not found }
 */
router.delete("/students/:studentId", authedHandler(async (req, res) => {
    const studentId = req.params.studentId as string;
    if (!uuidRegex.test(studentId)) return res.status(400).json({ message: "Invalid student ID" });
    try {
        await coach.removeStudent(studentId);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
}));

/**
 * @swagger
 * /api/coach/teams/{teamId}/pairings/{pairingId}/witness-order:
 *   get:
 *     summary: Get witness call order for a team in a pairing
 *     tags: [Coach - Team]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: pairingId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Witness call order }
 *       400: { description: Invalid pairing ID }
 */
router.get("/pairings/:pairingId/witness-order", authedHandler(async (req, res) => {
    const pairingId = req.params.pairingId as string;
    if (!uuidRegex.test(pairingId)) return res.status(400).json({ message: "Invalid pairing ID" });
    return res.status(200).json(await coach.getWitnessCallOrder(pairingId, req.params.teamId as string));
}));

/**
 * @swagger
 * /api/coach/teams/{teamId}/pairings/{pairingId}/witness-order:
 *   put:
 *     summary: Set witness call order for a team in a pairing
 *     tags: [Coach - Team]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: pairingId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [witness_ids]
 *             properties:
 *               witness_ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Invalid ID or witness_ids not an array }
 */
router.put("/pairings/:pairingId/witness-order", authedHandler(async (req, res) => {
    const pairingId = req.params.pairingId as string;
    if (!uuidRegex.test(pairingId)) return res.status(400).json({ message: "Invalid pairing ID" });
    const { witness_ids } = req.body as { witness_ids?: string[] };
    if (!Array.isArray(witness_ids)) return res.status(400).json({ message: "witness_ids must be an array" });
    await coach.setWitnessCallOrder(pairingId, req.params.teamId as string, witness_ids);
    return res.status(200).json({ success: true });
}));

/**
 * @swagger
 * /api/coach/teams/{teamId}/pairings/{pairingId}/assignments:
 *   get:
 *     summary: Get student role assignments for a team in a pairing
 *     tags: [Coach - Team]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: pairingId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Assignments }
 *       400: { description: Invalid pairing ID }
 */
router.get("/pairings/:pairingId/assignments", authedHandler(async (req, res) => {
    const pairingId = req.params.pairingId as string;
    if (!uuidRegex.test(pairingId)) return res.status(400).json({ message: "Invalid pairing ID" });
    return res.status(200).json(await coach.getStudentAssignments(pairingId, req.params.teamId as string));
}));

/**
 * @swagger
 * /api/coach/teams/{teamId}/pairings/{pairingId}/assignments:
 *   put:
 *     summary: Upsert a student assignment for a scoring field
 *     tags: [Coach - Team]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: pairingId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [field_id, student_id]
 *             properties:
 *               field_id: { type: string, format: uuid }
 *               student_id: { type: string, format: uuid }
 *               witness_id: { type: string, format: uuid }
 *     responses:
 *       200: { description: Assignment saved }
 *       400: { description: Missing or invalid fields }
 *       500: { description: Unable to save assignment }
 */
router.put("/pairings/:pairingId/assignments", authedHandler(async (req, res) => {
    const pairingId = req.params.pairingId as string;
    if (!uuidRegex.test(pairingId)) return res.status(400).json({ message: "Invalid pairing ID" });
    const { field_id, student_id, witness_id } = req.body as { field_id?: string; student_id?: string; witness_id?: string };
    if (!field_id || !student_id) return res.status(400).json({ message: "Missing field_id or student_id" });
    try {
        return res.status(200).json(await coach.upsertStudentAssignment(pairingId, req.params.teamId as string, field_id, student_id, witness_id ?? null));
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Unable to save assignment' });
        throw e;
    }
}));

export default router;
