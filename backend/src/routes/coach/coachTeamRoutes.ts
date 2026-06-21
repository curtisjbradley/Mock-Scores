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

// ── Coaches ───────────────────────────────────────────────────────────────────

router.get("/coaches", authedHandler(async (req, res) => {
    return res.status(200).json(await coach.getCoaches(req.params.teamId as string));
}));

router.post("/coaches", authedHandler(async (req, res) => {
    const { email } = req.body as { email?: string };
    if (!email) return res.status(400).json({ message: "Missing email" });
    return res.status(201).json(await coach.addCoach(req.params.teamId as string, email));
}));

router.delete("/coaches/:coachId", authedHandler(async (req, res) => {
    try {
        await coach.removeCoach(req.params.teamId as string, req.params.coachId as string);
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: e.message });
        throw e;
    }
}));

// ── Student roster ────────────────────────────────────────────────────────────

router.get("/students", authedHandler(async (req, res) => {
    return res.status(200).json(await coach.getStudents(req.params.teamId as string));
}));

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

// ── Witness call order ────────────────────────────────────────────────────────

router.get("/pairings/:pairingId/witness-order", authedHandler(async (req, res) => {
    const pairingId = req.params.pairingId as string;
    if (!uuidRegex.test(pairingId)) return res.status(400).json({ message: "Invalid pairing ID" });
    return res.status(200).json(await coach.getWitnessCallOrder(pairingId, req.params.teamId as string));
}));

router.put("/pairings/:pairingId/witness-order", authedHandler(async (req, res) => {
    const pairingId = req.params.pairingId as string;
    if (!uuidRegex.test(pairingId)) return res.status(400).json({ message: "Invalid pairing ID" });
    const { witness_ids } = req.body as { witness_ids?: string[] };
    if (!Array.isArray(witness_ids)) return res.status(400).json({ message: "witness_ids must be an array" });
    await coach.setWitnessCallOrder(pairingId, req.params.teamId as string, witness_ids);
    return res.status(200).json({ success: true });
}));

// ── Student assignments ───────────────────────────────────────────────────────

router.get("/pairings/:pairingId/assignments", authedHandler(async (req, res) => {
    const pairingId = req.params.pairingId as string;
    if (!uuidRegex.test(pairingId)) return res.status(400).json({ message: "Invalid pairing ID" });
    return res.status(200).json(await coach.getStudentAssignments(pairingId, req.params.teamId as string));
}));

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
