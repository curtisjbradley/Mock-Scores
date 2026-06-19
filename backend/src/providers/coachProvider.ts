import { dbQuery } from '../db';
import type {
    ICoachTournament, ICoachScheduleRound, ICoachResultRound,
    ICoach, IStudent, IWitnessCallOrder, IStudentAssignment, ICompetitionTeam
} from '@mock-scores/shared';

export async function getAllTournaments(userId: string): Promise<ICoachTournament[]> {
    return (await dbQuery<ICoachTournament>(
        `SELECT t.id, t.name, t.location, t.start_date, t.end_date, t.num_teams, t.num_rounds,
                teams.id AS team_id, teams.name AS team_name, teams.code AS team_code
         FROM tournaments t
         JOIN teams ON t.id = teams.tournament_id
         JOIN team_coaches ON team_coaches.team_id = teams.id
         WHERE team_coaches.coach_id = $1`,
        [userId]
    ))?.rows ?? [];
}

export async function getSchedule(tournamentId: string): Promise<ICoachScheduleRound[]> {
    const rounds = (await dbQuery<{ round_id: string; name: string; round_time: Date | null }>(
        `SELECT round_id, name, round_time FROM rounds WHERE tournament_id=$1 AND teams_public=true ORDER BY round_time desc`,
        [tournamentId]
    ))?.rows ?? [];
    return Promise.all(rounds.map(async r => ({
        round_id: r.round_id,
        name: r.name,
        round_time: r.round_time?.toISOString() ?? null,
        pairings: (await dbQuery<{ pairing_id: string; p_team_id: string; p_team_name: string; p_team_code: string; d_team_id: string; d_team_name: string; d_team_code: string; courtroom_name: string | null }>(
            `SELECT p.pairing_id,
                    pt.id AS p_team_id, pt.name AS p_team_name, pt.code AS p_team_code,
                    dt.id AS d_team_id, dt.name AS d_team_name, dt.code AS d_team_code,
                    c.name AS courtroom_name
             FROM pairings p
             JOIN teams pt ON pt.id = p.p_team
             JOIN teams dt ON dt.id = p.d_team
             LEFT JOIN courtrooms c ON c.id = p.courtroom
             WHERE p.round_id=$1`,
            [r.round_id]
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
        `INSERT INTO team_invites (team_id, invite_email) VALUES ($1,$2)
         ON CONFLICT DO NOTHING RETURNING id`,
        [teamId, email]
    ))?.rows[0];
    return { coach_id: row?.id ?? '', name: email, email, is_owner: false, has_joined: false };
}

export async function removeCoach(teamId: string, coachId: string): Promise<boolean> {
    // Try registered coach first (non-owner only)
    const r1 = await dbQuery(
        `DELETE FROM team_coaches WHERE team_id=$1 AND coach_id=$2 AND is_owner=false`,
        [teamId, coachId]
    );
    if (r1 && (r1.rowCount ?? 0) > 0) return true;
    // Fall back to invite
    const r2 = await dbQuery(
        `DELETE FROM team_invites WHERE team_id=$1 AND id=$2`,
        [teamId, coachId]
    );
    return !!(r2 && (r2.rowCount ?? 0) > 0);
}

export async function transferOwnership(teamId: string, newOwnerCoachId: string): Promise<boolean> {
    const member = (await dbQuery<{ coach_id: string }>(
        `SELECT coach_id FROM team_coaches WHERE team_id=$1 AND coach_id=$2`,
        [teamId, newOwnerCoachId]
    ))?.rows[0];
    if (!member) return false;
    await dbQuery(`UPDATE team_coaches SET is_owner=false WHERE team_id=$1`, [teamId]);
    await dbQuery(`UPDATE team_coaches SET is_owner=true WHERE team_id=$1 AND coach_id=$2`, [teamId, newOwnerCoachId]);
    return true;
}

export async function getStudents(teamId: string): Promise<IStudent[]> {
    return (await dbQuery<IStudent>(
        `SELECT student_id, team_id, student_name, pronouns FROM team_rostered_students WHERE team_id=$1 ORDER BY student_name`,
        [teamId]
    ))?.rows ?? [];
}

export async function addStudent(teamId: string, studentName: string, pronouns?: string | null): Promise<IStudent | null> {
    return (await dbQuery<IStudent>(
        `INSERT INTO team_rostered_students (team_id, student_name, pronouns) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING RETURNING student_id, team_id, student_name, pronouns`,
        [teamId, studentName, pronouns ?? null]
    ))?.rows[0] ?? null;
}

export async function removeStudent(studentId: string): Promise<boolean> {
    return !!(await dbQuery(`DELETE FROM team_rostered_students WHERE student_id=$1`, [studentId]));
}

export async function getWitnessCallOrder(pairingId: string, teamId: string): Promise<IWitnessCallOrder[]> {
    return (await dbQuery<IWitnessCallOrder>(
        `SELECT w.id, w.pairing_id, w.team_id, w.witness_id, cw.name AS witness_name, w.position
         FROM witness_call_order w JOIN case_witnesses cw ON cw.id = w.witness_id
         WHERE w.pairing_id=$1 AND w.team_id=$2 ORDER BY w.position`,
        [pairingId, teamId]
    ))?.rows ?? [];
}

export async function setWitnessCallOrder(pairingId: string, teamId: string, witnessIds: string[]): Promise<boolean> {
    await dbQuery(`DELETE FROM witness_call_order WHERE pairing_id=$1 AND team_id=$2`, [pairingId, teamId]);
    if (!witnessIds.length) return true;
    await Promise.all(witnessIds.map((wid, i) =>
        dbQuery(
            `INSERT INTO witness_call_order (pairing_id, team_id, witness_id, position) VALUES ($1,$2,$3,$4)`,
            [pairingId, teamId, wid, i + 1]
        )
    ));
    return true;
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

export async function upsertStudentAssignment(pairingId: string, teamId: string, fieldId: string, studentId: string, witnessId?: string | null): Promise<IStudentAssignment | null> {
    return (await dbQuery<IStudentAssignment>(
        `INSERT INTO student_assignments (pairing_id, team_id, field_id, witness_id, student_id)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (pairing_id, team_id, field_id, witness_id) DO UPDATE SET student_id=EXCLUDED.student_id
         RETURNING id, pairing_id, team_id, field_id,
           (SELECT label FROM scoring_fields WHERE id=$3) AS field_label,
           witness_id, student_id,
           (SELECT student_name FROM team_rostered_students WHERE student_id=$5) AS student_name`,
        [pairingId, teamId, fieldId, witnessId ?? null, studentId]
    ))?.rows[0] ?? null;
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

export async function getFormatForTournament(tournamentId: string): Promise<{ p_witnesses_called: number; d_witnesses_called: number } | null> {
    return (await dbQuery<{ p_witnesses_called: number; d_witnesses_called: number }>(
        `SELECT tf.p_witnesses_called, tf.d_witnesses_called
         FROM tournament_format tf
         JOIN tournaments t ON t.case_format_id = tf.format_id
         WHERE t.id = $1`,
        [tournamentId]
    ))?.rows[0] ?? null;
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
             FROM ballots b WHERE b.tournament_id=$1`,
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
