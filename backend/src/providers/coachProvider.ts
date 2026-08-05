import { dbQuery } from '../db';
import type {
    ICoachTournament, ICoachScheduleRound, ICoachResultRound,
    ICoach, IStudent, IWitnessCallOrder, IStudentAssignment, ICompetitionTeam, ITournament
} from '@mock-scores/shared';
import { AlreadyExistsError, DbError, NotFoundError } from '../errors';
import {ITeamRow, ITournamentRow} from "../types/dbtypes";


export async function getTeam(teamId: string): Promise<ICompetitionTeam | null> {
    const result = await dbQuery<ITeamRow>(`SELECT * from teams where teams.id = $1`, [teamId]);
    if(!result) throw new DbError('getTeam');

    if (result.rowCount == 0) return null;

    return result.rows[0]
}

export async function getTournamentFromTeamId(teamId: string): Promise<ITournament | null> {
    const result = await dbQuery<ITournamentRow>(`SELECT * from tournaments join teams on teams.tournament_id = tournaments.id where teams.id = $1`, [teamId]);
    if(!result || result.rowCount == null || result.rowCount > 1) throw new DbError('getTeam');

    if (result.rowCount == 0) return null;

    return result.rows[0]
}

export async function getAllTournaments(userId: string): Promise<ICoachTournament[]> {
    const result = await dbQuery<ICoachTournament>(
        `SELECT t.id, t.name, t.location, t.start_date, t.end_date, t.num_teams, t.num_rounds,
                teams.id AS team_id, teams.name AS team_name, teams.code AS team_code
         FROM tournaments t
         JOIN teams ON t.id = teams.tournament_id
         JOIN team_coaches ON team_coaches.team_id = teams.id
         WHERE team_coaches.coach_id = $1`,
        [userId]
    );
    if (!result) throw new DbError('getAllTournaments');
    return result.rows;
}

/** Returns the team ID for a coach in a given tournament, or null if they have no team there. */
export async function getTeamIdForCoach(tournamentId: string, userId: string): Promise<string | null> {
    const row = (await dbQuery<{ team_id: string }>(
        `SELECT teams.id AS team_id FROM teams
         JOIN team_coaches ON team_coaches.team_id = teams.id
         WHERE teams.tournament_id = $1 AND team_coaches.coach_id = $2
         LIMIT 1`,
        [tournamentId, userId],
    ))?.rows[0];
    return row?.team_id ?? null;
}

export async function getSchedule(tournamentId: string, teamId: string): Promise<ICoachScheduleRound[]> {
    const rounds = (await dbQuery<{ round_id: string; name: string; round_time: Date | null }>(
        `SELECT round_id, name, round_time FROM rounds WHERE tournament_id=$1 AND teams_public=true ORDER BY round_time desc`,
        [tournamentId]
    ))?.rows ?? [];
    return Promise.all(rounds.map(async r => ({
        round_id: r.round_id,
        name: r.name,
        round_time: r.round_time?.toISOString() ?? null,
        pairings: (await dbQuery<{ pairing_id: string; p_team_id: string; p_team_name: string; p_team_code: string; d_team_id: string; d_team_name: string; d_team_code: string; courtroom_name: string | null; has_assignments: boolean; has_call_order: boolean }>(
            `SELECT p.pairing_id,
                    pt.id AS p_team_id, pt.name AS p_team_name, pt.code AS p_team_code,
                    dt.id AS d_team_id, dt.name AS d_team_name, dt.code AS d_team_code,
                    c.name AS courtroom_name,
                    EXISTS (
                        SELECT 1 FROM student_assignments sa
                        WHERE sa.pairing_id = p.pairing_id AND sa.team_id = $2
                    ) AS has_assignments,
                    EXISTS (
                        SELECT 1 FROM witness_call_order wco
                        WHERE wco.pairing_id = p.pairing_id AND wco.team_id = $2
                    ) AS has_call_order
             FROM pairings p
             JOIN teams pt ON pt.id = p.p_team
             JOIN teams dt ON dt.id = p.d_team
             LEFT JOIN courtrooms c ON c.id = p.courtroom
             WHERE p.round_id=$1
               AND (p.p_team = $2 OR p.d_team = $2)`,
            [r.round_id, teamId]
        ))?.rows ?? [],
    })));
}

export async function getResults(tournamentId: string): Promise<ICoachResultRound[]> {
    const rounds = (await dbQuery<{ round_id: string; name: string; round_time: Date | null }>(
        `SELECT round_id, name, round_time FROM rounds WHERE tournament_id=$1 AND results_public=true ORDER BY round_time desc`,
        [tournamentId]
    ))?.rows ?? [];
    return Promise.all(rounds.map(async r => ({
        round_id: r.round_id,
        name: r.name,
        round_time: r.round_time?.toISOString() ?? null,
        pairings: (await dbQuery<{ pairing_id: string; p_team_name: string; p_team_code: string; d_team_name: string; d_team_code: string; p_points: number; d_points: number }>(
            `SELECT p.pairing_id,
                    pt.name AS p_team_name, pt.code AS p_team_code,
                    dt.name AS d_team_name, dt.code AS d_team_code,
                    COALESCE(SUM(b.p_points), 0)::int AS p_points,
                    COALESCE(SUM(b.d_points), 0)::int AS d_points
             FROM pairings p
             JOIN teams pt ON pt.id = p.p_team
             JOIN teams dt ON dt.id = p.d_team
             LEFT JOIN ballots b ON b.pairing_id = p.pairing_id
             WHERE p.round_id=$1
             GROUP BY p.pairing_id, pt.name, pt.code, dt.name, dt.code`,
            [r.round_id]
        ))?.rows ?? [],
    })));
}

export async function getCoaches(teamId: string): Promise<ICoach[]> {
    const joined = (await dbQuery<ICoach>(
        `SELECT tc.coach_id, a.first_name || ' ' || a.last_name AS name, a.email, tc.is_owner, true AS has_joined
         FROM team_coaches tc JOIN auth a ON a.user_id = tc.coach_id
         WHERE tc.team_id = $1`,
        [teamId]
    ))?.rows ?? [];
    const invited = (await dbQuery<ICoach>(
        `SELECT ti.id AS coach_id, ti.invite_email AS name, ti.invite_email AS email, false AS is_owner, false AS has_joined
         FROM team_invites ti WHERE ti.team_id = $1`,
        [teamId]
    ))?.rows ?? [];
    return [...joined, ...invited];
}

export async function addCoach(teamId: string, email: string): Promise<ICoach> {
    const user = (await dbQuery<{ user_id: string; first_name: string; last_name: string; email: string }>(
        `SELECT user_id, first_name, last_name, email FROM auth WHERE LOWER(email)=LOWER($1)`, [email]
    ))?.rows[0];
    if (user) {
        await dbQuery(
            `INSERT INTO team_coaches (coach_id, team_id, is_owner) VALUES ($1,$2,false) ON CONFLICT DO NOTHING`,
            [user.user_id, teamId]
        );
        return { coach_id: user.user_id, name: `${user.first_name} ${user.last_name}`, email: user.email, is_owner: false, has_joined: true };
    }
    const row = (await dbQuery<{ id: string }>(
        `INSERT INTO team_invites (team_id, invite_email) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id`,
        [teamId, email]
    ))?.rows[0];
    return { coach_id: row?.id ?? '', name: email, email, is_owner: false, has_joined: false };
}

export async function removeCoach(teamId: string, coachId: string): Promise<void> {
    const r1 = await dbQuery(
        `DELETE FROM team_coaches WHERE team_id=$1 AND coach_id=$2 AND is_owner=false`,
        [teamId, coachId]
    );
    if (r1 && (r1.rowCount ?? 0) > 0) return;
    const r2 = await dbQuery(`DELETE FROM team_invites WHERE team_id=$1 AND id=$2`, [teamId, coachId]);
    if (!r2 || (r2.rowCount ?? 0) === 0) throw new NotFoundError('coach');
}

export async function transferOwnership(teamId: string, newOwnerCoachId: string): Promise<void> {
    const member = (await dbQuery<{ coach_id: string }>(
        `SELECT coach_id FROM team_coaches WHERE team_id=$1 AND coach_id=$2`,
        [teamId, newOwnerCoachId]
    ))?.rows[0];
    if (!member) throw new NotFoundError('coach on team');
    await dbQuery(`UPDATE team_coaches SET is_owner=false WHERE team_id=$1`, [teamId]);
    await dbQuery(`UPDATE team_coaches SET is_owner=true WHERE team_id=$1 AND coach_id=$2`, [teamId, newOwnerCoachId]);
}

export async function getStudents(teamId: string): Promise<IStudent[]> {
    return (await dbQuery<IStudent>(
        `SELECT student_id, team_id, student_name, pronouns FROM team_rostered_students WHERE team_id=$1 ORDER BY student_name`,
        [teamId]
    ))?.rows ?? [];
}

export async function addStudent(teamId: string, studentName: string, pronouns?: string | null): Promise<IStudent> {
    const row = (await dbQuery<IStudent>(
        `INSERT INTO team_rostered_students (team_id, student_name, pronouns) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING RETURNING student_id, team_id, student_name, pronouns`,
        [teamId, studentName, pronouns ?? null]
    ))?.rows[0];
    if (!row) throw new AlreadyExistsError('student');
    return row;
}

export async function removeStudent(studentId: string): Promise<void> {
    const result = await dbQuery(`DELETE FROM team_rostered_students WHERE student_id=$1 RETURNING student_id`, [studentId]);
    if (!result) throw new DbError('removeStudent');
    if (!result.rows[0]) throw new NotFoundError('student');
}

export async function getWitnessCallOrder(pairingId: string, teamId: string): Promise<IWitnessCallOrder[]> {
    return (await dbQuery<IWitnessCallOrder>(
        `SELECT w.id, w.pairing_id, w.team_id, w.witness_id, cw.name AS witness_name, w.position
         FROM witness_call_order w JOIN case_witnesses cw ON cw.id = w.witness_id
         WHERE w.pairing_id=$1 AND w.team_id=$2 ORDER BY w.position`,
        [pairingId, teamId]
    ))?.rows ?? [];
}

export async function setWitnessCallOrder(pairingId: string, teamId: string, witnessIds: string[]): Promise<void> {
    await dbQuery(`DELETE FROM witness_call_order WHERE pairing_id=$1 AND team_id=$2`, [pairingId, teamId]);
    if (witnessIds.length) {
        await Promise.all(witnessIds.map((wid, i) =>
            dbQuery(
                `INSERT INTO witness_call_order (pairing_id, team_id, witness_id, position) VALUES ($1,$2,$3,$4)`,
                [pairingId, teamId, wid, i + 1]
            )
        ));
    }
}

export async function getStudentAssignments(pairingId: string, teamId: string): Promise<IStudentAssignment[]> {
    return (await dbQuery<IStudentAssignment>(
        `SELECT sa.id, sa.pairing_id, sa.team_id, sa.field_id, sf.label AS field_label,
                sa.witness_id, sa.student_id, trs.student_name
         FROM student_assignments sa
         JOIN scoring_fields sf ON sf.id = sa.field_id
         JOIN team_rostered_students trs ON trs.student_id = sa.student_id
         WHERE sa.pairing_id=$1 AND sa.team_id=$2`,
        [pairingId, teamId]
    ))?.rows ?? [];
}

export async function upsertStudentAssignment(pairingId: string, teamId: string, fieldId: string, studentId: string, witnessId?: string | null): Promise<IStudentAssignment> {
    const row = (await dbQuery<IStudentAssignment>(
        `INSERT INTO student_assignments (pairing_id, team_id, field_id, witness_id, student_id)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (pairing_id, team_id, field_id, witness_id) DO UPDATE SET student_id=EXCLUDED.student_id
         RETURNING id, pairing_id, team_id, field_id,
           (SELECT label FROM scoring_fields WHERE id=$3) AS field_label,
           witness_id, student_id,
           (SELECT student_name FROM team_rostered_students WHERE student_id=$5) AS student_name`,
        [pairingId, teamId, fieldId, witnessId ?? null, studentId]
    ))?.rows[0];
    if (!row) throw new DbError('upsertStudentAssignment');
    return row;
}

export async function bulkUpsertStudentAssignments(
    pairingId: string,
    teamId: string,
    assignments: { field_id: string; student_id: string; witness_id?: string | null }[],
): Promise<void> {
    if (!assignments.length) return;
    await Promise.all(assignments.map(a =>
        dbQuery(
            `INSERT INTO student_assignments (pairing_id, team_id, field_id, witness_id, student_id)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (pairing_id, team_id, field_id, witness_id) DO UPDATE SET student_id=EXCLUDED.student_id`,
            [pairingId, teamId, a.field_id, a.witness_id ?? null, a.student_id],
        )
    ));
}

// ── Default call order ────────────────────────────────────────────────────────

export async function getDefaultWitnessCallOrder(teamId: string): Promise<{ witness_id: string; witness_name: string; position: number }[]> {
    return (await dbQuery<{ witness_id: string; witness_name: string; position: number }>(
        `SELECT d.witness_id, cw.name AS witness_name, d.position
         FROM default_witness_call_order d
         JOIN case_witnesses cw ON cw.id = d.witness_id
         WHERE d.team_id = $1
         ORDER BY d.position`,
        [teamId],
    ))?.rows ?? [];
}

export async function setDefaultWitnessCallOrder(teamId: string, witnessIds: string[]): Promise<void> {
    await dbQuery('DELETE FROM default_witness_call_order WHERE team_id = $1', [teamId]);
    if (witnessIds.length) {
        await Promise.all(witnessIds.map((wid, i) =>
            dbQuery(
                'INSERT INTO default_witness_call_order (team_id, witness_id, position) VALUES ($1,$2,$3)',
                [teamId, wid, i + 1],
            )
        ));
    }
}

// ── Default student assignments ────────────────────────────────────────────────

export async function getDefaultStudentAssignments(teamId: string): Promise<IStudentAssignment[]> {
    return (await dbQuery<IStudentAssignment>(
        `SELECT d.id, null::uuid AS pairing_id, d.team_id, d.field_id,
                sf.label AS field_label, d.witness_id, d.student_id, trs.student_name
         FROM default_student_assignments d
         JOIN scoring_fields sf ON sf.id = d.field_id
         JOIN team_rostered_students trs ON trs.student_id = d.student_id
         WHERE d.team_id = $1`,
        [teamId],
    ))?.rows ?? [];
}

export async function upsertDefaultStudentAssignment(
    teamId: string, fieldId: string, studentId: string, witnessId?: string | null,
): Promise<void> {
    await dbQuery(
        `INSERT INTO default_student_assignments (team_id, field_id, witness_id, student_id)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (team_id, field_id, witness_id) DO UPDATE SET student_id = EXCLUDED.student_id`,
        [teamId, fieldId, witnessId ?? null, studentId],
    );
}

export async function deleteDefaultStudentAssignment(teamId: string, fieldId: string, witnessId?: string | null): Promise<void> {
    await dbQuery(
        'DELETE FROM default_student_assignments WHERE team_id=$1 AND field_id=$2 AND witness_id IS NOT DISTINCT FROM $3',
        [teamId, fieldId, witnessId ?? null],
    );
}

export async function getCompetitionField(tournamentId: string): Promise<ICompetitionTeam[]> {
    return (await dbQuery<ICompetitionTeam>(
        `SELECT id, name, code FROM teams WHERE tournament_id=$1 ORDER BY name`,
        [tournamentId]
    ))?.rows ?? [];
}

export async function getWitnessesForTournament(tournamentId: string): Promise<{ id: string; name: string; side: string }[]> {
    return (await dbQuery<{ id: string; name: string; side: string }>(
        `SELECT cw.id, cw.name, cw.side
         FROM case_witnesses cw
         JOIN tournament_format tf ON tf.format_id = cw.case_format
         JOIN tournaments t ON t.case_format_id = tf.format_id
         WHERE t.id = $1`,
        [tournamentId]
    ))?.rows ?? [];
}

export async function getFormatForTournament(tournamentId: string): Promise<{ p_witnesses_called: number; d_witnesses_called: number; criminal_case: boolean } | null> {
    return (await dbQuery<{ p_witnesses_called: number; d_witnesses_called: number; criminal_case: boolean }>(
        `SELECT tf.p_witnesses_called, tf.d_witnesses_called, tf.criminal_case
         FROM tournament_format tf JOIN tournaments t ON t.case_format_id = tf.format_id
         WHERE t.id = $1`,
        [tournamentId]
    ))?.rows[0] ?? null;
}


export async function getPairingBallots(pairingId: string): Promise<{
    p_points: number;
    d_points: number;
    assignment_id: string;
}[]> {
    const rows = (await dbQuery<{ p_points: number; d_points: number; scorer_assignment_id: string }>(
        `SELECT b.p_points, b.d_points, b.scorer_assignment_id
         FROM ballots b
         WHERE b.pairing_id = $1`,
        [pairingId]
    ))?.rows ?? [];
    return rows.map(r => ({ p_points: r.p_points, d_points: r.d_points, assignment_id: r.scorer_assignment_id }));
}

export async function getStandingsData(tournamentId: string): Promise<{
    config: { statsXml: string; standingsXml: string } | null;
    teams: { id: string; name: string; code: string }[];
    ballots: { p_team_id: string; d_team_id: string; p_points: number; d_points: number; pairing_id: string }[];
}> {
    const [configRow, ballotsRows, teamsRows] = await Promise.all([
        dbQuery<{ stats_xml: string; standings_xml: string }>(
            `SELECT sc.stats_xml, sc.standings_xml FROM tournaments t
             JOIN standings_configs sc ON sc.id = t.standings_config_id WHERE t.id=$1`,
            [tournamentId]
        ),
        dbQuery<{ p_team_id: string; d_team_id: string; p_points: number; d_points: number; pairing_id: string }>(
            `SELECT b.p_team_id, b.d_team_id, b.p_points, b.d_points, b.pairing_id
             FROM ballots b
             JOIN pairings p ON p.pairing_id = b.pairing_id
             JOIN rounds r   ON r.round_id   = p.round_id
             WHERE b.tournament_id = $1
               AND r.results_public = true`,
            [tournamentId]
        ),
        dbQuery<{ id: string; name: string; code: string }>(
            `SELECT id, name, code FROM teams WHERE tournament_id=$1`, [tournamentId]
        ),
    ]);
    const row = configRow?.rows[0];
    return {
        config: row ? { statsXml: row.stats_xml, standingsXml: row.standings_xml } : null,
        teams: teamsRows?.rows ?? [],
        ballots: ballotsRows?.rows ?? [],
    };
}
