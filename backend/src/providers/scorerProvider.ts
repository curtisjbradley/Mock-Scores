import { dbQuery, withTransaction } from '../db';
import type { IScoreSheetFormat, ScorecardPayload } from '@mock-scores/shared';
import { DbError, NotFoundError, AlreadySubmittedError, ConflictReportedError } from '../errors';

// ─── Shared format builder ───────────────────────────────────────────────────

/** Resolved pairing context needed to build the scoresheet/ballot format. */
interface PairingFormatContext {
    pairingId: string;
    tournamentId: string;
    pTeam: string;
    dTeam: string;
    courtroomName: string | null;
    presiderName: string;
    /** assignment_id to embed as scorerID; empty string for a blank/pairing-level ballot. */
    scorerAssignmentId: string;
    scorerFirstName: string;
    scorerLastName: string;
    isPaper: boolean;
    fillableScores: boolean;
}

/**
 * Builds the scoring categories, students, witnesses, and award categories for a
 * pairing. Shared by {@link getScoreSheet} (scorer view) and
 * {@link getPairingBallotFormat} (blank printable ballot).
 *
 * Throws NotFoundError when the tournament/format cannot be resolved.
 * Throws DbError when a query fails.
 */
async function buildScoreSheetForPairing(ctx: PairingFormatContext): Promise<IScoreSheetFormat> {
    const { pairingId: pairing_id, tournamentId: tournament_id, pTeam: p_team, dTeam: d_team } = ctx;

    // ── 3. Tournament / format ────────────────────────────────────────────────
    const tourney = (await dbQuery<{
        tournament_name: string;
        case_name: string;
        criminal_case: boolean;
        p_witnesses_called: number;
        d_witnesses_called: number;
        has_swing: boolean;
        format_id: string;
    }>(`
        SELECT t.name AS tournament_name, tf.case_name, tf.criminal_case, tf.p_witnesses_called,
               tf.d_witnesses_called, tf.has_swing, tf.format_id
        FROM tournaments t
        JOIN tournament_format tf ON tf.format_id = t.case_format_id
        WHERE t.id = $1
    `, [tournament_id]))?.rows[0];

    if (!tourney) throw new NotFoundError('Tournament not found');

    // ── 4. Teams ──────────────────────────────────────────────────────────────
    const teamsRows = (await dbQuery<{ id: string; code: string; name: string }>(
        'SELECT id, code, name FROM teams WHERE id = ANY($1)',
        [[p_team, d_team]],
    ))?.rows ?? [];
    const teamMap = Object.fromEntries(teamsRows.map(t => [t.id, t]));
    const pTeam = teamMap[p_team];
    const dTeam = teamMap[d_team];

    // ── 6. Scoring categories + fields ────────────────────────────────────────
    const catRows = (await dbQuery<{
        id: string;
        name: string;
        witness_category: boolean;
        position: number;
    }>(
        'SELECT id, name, witness_category, position FROM scoring_categories WHERE tournament_id = $1 ORDER BY position',
        [tournament_id],
    ))?.rows ?? [];

    const fieldRows = (await dbQuery<{
        id: string;
        category_id: string;
        label: string;
        min_score: number;
        max_score: number;
        assignable: boolean;
        prosecution: boolean;
        defense: boolean;
        calling: boolean;
        crossing: boolean;
        visible_to_scorers: boolean;
        position: number;
        award_category_id: string | null;
    }>(
        `SELECT id, category_id, label, min_score, max_score, assignable,
                prosecution, defense, calling, crossing, visible_to_scorers, position,
                award_category_id
         FROM scoring_fields
         WHERE category_id = ANY($1)
           AND visible_to_scorers = true
         ORDER BY position`,
        [catRows.map(c => c.id)],
    ))?.rows ?? [];

    const fieldsByCat = new Map<string, typeof fieldRows>();
    for (const f of fieldRows) {
        if (!fieldsByCat.has(f.category_id)) fieldsByCat.set(f.category_id, []);
        fieldsByCat.get(f.category_id)!.push(f);
    }

    // ── 7. Witnesses for this format ──────────────────────────────────────────
    const witnessRows = (await dbQuery<{ id: string; name: string; side: 'P' | 'D' | 'S' }>(
        'SELECT id, name, side FROM case_witnesses WHERE case_format = $1',
        [tourney.format_id],
    ))?.rows ?? [];

    // ── 7b. Witness call order for this pairing ───────────────────────────────
    const callOrderRows = (await dbQuery<{
        team_id: string;
        witness_id: string;
        position: number;
    }>(
        `SELECT team_id, witness_id, position
         FROM witness_call_order
         WHERE pairing_id = $1
         ORDER BY team_id, position`,
        [pairing_id],
    ))?.rows ?? [];

    const pCallOrder = callOrderRows.filter(r => r.team_id === p_team).map(r => r.witness_id);
    const dCallOrder = callOrderRows.filter(r => r.team_id === d_team).map(r => r.witness_id);

    const witnessMap = new Map(witnessRows.map(w => [w.id, w]));

    const pWitnesses = witnessRows.filter(w => w.side === 'P');
    const dWitnesses = witnessRows.filter(w => w.side === 'D');
    const swingWitnesses = witnessRows.filter(w => w.side === 'S');

    const resolvedPWitnesses = pCallOrder.length > 0
        ? pCallOrder.map(id => witnessMap.get(id)).filter((w): w is typeof witnessRows[0] => w != null)
        : [...pWitnesses.slice(0, tourney.p_witnesses_called), ...swingWitnesses];

    const resolvedDWitnesses = dCallOrder.length > 0
        ? dCallOrder.map(id => witnessMap.get(id)).filter((w): w is typeof witnessRows[0] => w != null)
        : [...dWitnesses.slice(0, tourney.d_witnesses_called), ...swingWitnesses];

    // ── 8. Student assignments for this pairing ───────────────────────────────
    const studentAsgRows = (await dbQuery<{
        field_id: string;
        witness_id: string | null;
        student_id: string;
        team_id: string;
    }>(
        `SELECT field_id, witness_id, student_id, team_id
         FROM student_assignments
         WHERE pairing_id = $1`,
        [pairing_id],
    ))?.rows ?? [];

    const studentByField = new Map<string, { pStudentId: string | null; dStudentId: string | null }>();
    for (const sa of studentAsgRows) {
        const key = sa.witness_id ? `${sa.field_id}:${sa.witness_id}` : sa.field_id;
        const existing = studentByField.get(key) ?? { pStudentId: null, dStudentId: null };
        if (sa.team_id === p_team) existing.pStudentId = sa.student_id;
        else if (sa.team_id === d_team) existing.dStudentId = sa.student_id;
        studentByField.set(key, existing);
    }

    // ── 9. Student info ───────────────────────────────────────────────────────
    const studentsRecord: IScoreSheetFormat['students'] = {};
    const studentIds = new Set(studentAsgRows.map(sa => sa.student_id));
    if (studentIds.size > 0) {
        const studentRows = (await dbQuery<{
            student_id: string;
            student_name: string;
            pronouns: string | null;
            team_id: string;
        }>(
            'SELECT student_id, student_name, pronouns, team_id FROM team_rostered_students WHERE student_id = ANY($1)',
            [[...studentIds]],
        ))?.rows ?? [];
        for (const s of studentRows) {
            studentsRecord[s.student_id] = { name: s.student_name, pronouns: s.pronouns, schoolId: s.team_id };
        }
    }

    // ── 10. Assemble categories ───────────────────────────────────────────────
    const scoringCategories: IScoreSheetFormat['scoringCategories'] = {};
    const categoryOrder: string[] = [];
    const witnessesRecord: IScoreSheetFormat['witnesses'] = {};

    for (const cat of catRows) {
        const catFields = fieldsByCat.get(cat.id) ?? [];
        if (!catFields.length) continue;

        if (!cat.witness_category) {
            categoryOrder.push(cat.id);
            scoringCategories[cat.id] = {
                categoryName: cat.name,
                witnessId: null,
                categoryAssignments: catFields.map(f => {
                    const students = studentByField.get(f.id) ?? { pStudentId: null, dStudentId: null };
                    const side: 'P' | 'D' | 'BOTH' = f.prosecution && f.defense ? 'BOTH' : f.prosecution ? 'P' : 'D';
                    return {
                        assignmentName: f.label,
                        assignmentKey: `${cat.id}__${f.id}`,
                        pStudentId: side !== 'D' ? students.pStudentId : null,
                        dStudentId: side !== 'P' ? students.dStudentId : null,
                        side,
                        minScore: f.min_score,
                        maxScore: f.max_score,
                    };
                }),
            };
        } else {
            const seenWitnesses = new Set<string>();
            const calledWitnesses: typeof witnessRows = [];
            for (const w of [...resolvedPWitnesses, ...resolvedDWitnesses]) {
                if (!seenWitnesses.has(w.id)) { seenWitnesses.add(w.id); calledWitnesses.push(w); }
            }

            for (const witness of calledWitnesses) {
                witnessesRecord[witness.id] = { characterName: witness.name };
                const catId = `${cat.id}__${witness.id}`;
                categoryOrder.push(catId);
                scoringCategories[catId] = {
                    categoryName: cat.name,
                    witnessId: witness.id,
                    categoryAssignments: catFields.map(f => {
                        const students = studentByField.get(`${f.id}:${witness.id}`) ?? { pStudentId: null, dStudentId: null };
                        let side: 'P' | 'D' | 'BOTH' = f.prosecution && f.defense ? 'BOTH' : f.prosecution ? 'P' : 'D';
                        if (f.calling && !f.crossing) side = witness.side === 'P' || witness.side === 'S' ? 'P' : 'D';
                        else if (f.crossing && !f.calling) side = witness.side === 'P' || witness.side === 'S' ? 'D' : 'P';
                        return {
                            assignmentName: f.label,
                            assignmentKey: `${cat.id}__${f.id}__${witness.id}`,
                            pStudentId: side !== 'D' ? students.pStudentId : null,
                            dStudentId: side !== 'P' ? students.dStudentId : null,
                            side,
                            minScore: f.min_score,
                            maxScore: f.max_score,
                        };
                    }),
                };
            }
        }
    }

    // ── 12. Award categories ──────────────────────────────────────────────────
    const awardCatRows = (await dbQuery<{
        id: string; name: string; min_nominees: number; max_nominees: number;
    }>(
        'SELECT id, name, min_nominees, max_nominees FROM individual_award_categories WHERE tournament_id = $1 ORDER BY name',
        [tournament_id],
    ))?.rows ?? [];

    const awardCategories: IScoreSheetFormat['awardCategories'] = {};
    if (awardCatRows.length > 0) {
        const fieldsByAwardCat = new Map<string, string[]>();
        for (const f of fieldRows) {
            if (f.award_category_id) {
                if (!fieldsByAwardCat.has(f.award_category_id)) fieldsByAwardCat.set(f.award_category_id, []);
                fieldsByAwardCat.get(f.award_category_id)!.push(f.id);
            }
        }

        for (const ac of awardCatRows) {
            const linkedFieldIds = fieldsByAwardCat.get(ac.id) ?? [];
            const eligibleStudentIds = new Set<string>();
            for (const sa of studentAsgRows) {
                if (linkedFieldIds.includes(sa.field_id)) {
                    eligibleStudentIds.add(sa.student_id);
                }
            }
            awardCategories[ac.id] = {
                name: ac.name,
                minNominees: ac.min_nominees,
                maxNominees: ac.max_nominees,
                eligibleStudentIds: [...eligibleStudentIds],
            };
        }
    }

    return {
        isCriminal: tourney.criminal_case,
        ballotOptions: { fillableScores: ctx.fillableScores },
        pairingID: pairing_id,
        scorer: {
            firstName: ctx.scorerFirstName,
            lastName: ctx.scorerLastName,
            scorerID: ctx.scorerAssignmentId,
            isPaper: ctx.isPaper,
        },
        presiderName: ctx.presiderName,
        courtroomNumber: ctx.courtroomName ?? '',
        caseName: tourney.case_name,
        tournamentName: tourney.tournament_name,
        prosecutionCode: pTeam?.code ?? '',
        defenseCode: dTeam?.code ?? '',
        students: studentsRecord,
        witnesses: witnessesRecord,
        scoringCategories,
        categoryOrder,
        awardCategories,
    };
}

// ─── getPairingBallotFormat ──────────────────────────────────────────────────

/**
 * Builds a blank, printable ballot format for a pairing without requiring a
 * scorer assignment. Used by the organizer "download ballot" feature. Scores are
 * always fillable and no scorer name is attached (the scorer fills their name in
 * by hand). The presider name reflects whoever is currently assigned, if any.
 *
 * Throws NotFoundError when the pairing does not exist.
 * Throws DbError when a query fails.
 */
export async function getPairingBallotFormat(pairingId: string): Promise<IScoreSheetFormat> {
    const pairing = (await dbQuery<{
        p_team: string;
        d_team: string;
        courtroom_name: string | null;
        tournament_id: string;
    }>(`
        SELECT p.p_team, p.d_team, cr.name AS courtroom_name, r.tournament_id
        FROM pairings p
        JOIN rounds r           ON r.round_id = p.round_id
        LEFT JOIN courtrooms cr ON cr.id      = p.courtroom
        WHERE p.pairing_id = $1
    `, [pairingId]))?.rows[0];

    if (!pairing) throw new NotFoundError('Pairing not found');

    // Resolve the currently assigned presider's name, if any.
    let presiderName = '';
    const pres = (await dbQuery<{
        registered_scorer_id: string | null;
        paper_scorer_id: string | null;
    }>(`
        SELECT spa.registered_scorer_id, spa.paper_scorer_id
        FROM scorer_presider_assignment pa
        JOIN scorer_pairing_assignments spa ON spa.assignment_id = pa.scorer_assignment_id
        WHERE pa.pairing_id = $1
    `, [pairingId]))?.rows[0];
    if (pres?.registered_scorer_id) {
        const pr = (await dbQuery<{ first_name: string; last_name: string }>(
            'SELECT first_name, last_name FROM scorers WHERE scorer_id = $1',
            [pres.registered_scorer_id],
        ))?.rows[0];
        if (pr) presiderName = `${pr.first_name} ${pr.last_name}`;
    } else if (pres?.paper_scorer_id) {
        const pr = (await dbQuery<{ name: string }>(
            'SELECT name FROM paper_scorers WHERE scorer_id = $1',
            [pres.paper_scorer_id],
        ))?.rows[0];
        if (pr) presiderName = pr.name;
    }

    return buildScoreSheetForPairing({
        pairingId,
        tournamentId: pairing.tournament_id,
        pTeam: pairing.p_team,
        dTeam: pairing.d_team,
        courtroomName: pairing.courtroom_name,
        presiderName,
        scorerAssignmentId: '',
        scorerFirstName: '',
        scorerLastName: '',
        isPaper: true,
        fillableScores: true,
    });
}

// ─── getScoreSheet ─────────────────────────────────────────────────────────────

/**
 * Builds the full IScoreSheetFormat for a scorer given their assignment ID.
 * The assignment ID is the UUID in scorer_pairing_assignments.assignment_id and
 * is embedded in the unique link sent to the judge.
 *
 * Throws NotFoundError when the assignment does not exist.
 * Throws DbError when a query fails.
 */
export async function getScoreSheet(assignmentId: string, options?: { skipGuards?: boolean }): Promise<IScoreSheetFormat> {
    // ── 1. Resolve assignment → pairing → tournament ──────────────────────────
    const asg = (await dbQuery<{
        pairing_id: string;
        registered_scorer_id: string | null;
        paper_scorer_id: string | null;
        p_team: string;
        d_team: string;
        courtroom_name: string | null;
        tournament_id: string;
        presider_scorer_assignment_id: string | null;
        show_scores: boolean | null;
        conflict_reported: boolean;
    }>(`
        SELECT
            spa.pairing_id,
            spa.registered_scorer_id,
            spa.paper_scorer_id,
            p.p_team,
            p.d_team,
            cr.name                          AS courtroom_name,
            r.tournament_id,
            spa2.scorer_assignment_id        AS presider_scorer_assignment_id,
            spa2.show_scores,
            spa.conflict_reported
        FROM scorer_pairing_assignments spa
        JOIN pairings p                          ON p.pairing_id = spa.pairing_id
        JOIN rounds r                            ON r.round_id   = p.round_id
        LEFT JOIN courtrooms cr                  ON cr.id        = p.courtroom
        LEFT JOIN scorer_presider_assignment spa2
               ON spa2.pairing_id = spa.pairing_id
        WHERE spa.assignment_id = $1
    `, [assignmentId]))?.rows[0];

    if (!asg) throw new NotFoundError('Assignment not found');

    // If the scorer has reported a conflict, block access until reassigned
    if (asg.conflict_reported && !options?.skipGuards) throw new ConflictReportedError();

    // Prevent re-entry: if a ballot already exists this link is spent
    if (!options?.skipGuards) {
        const existing = (await dbQuery<{ ballot_id: string }>(
            'SELECT ballot_id FROM ballots WHERE scorer_assignment_id = $1 LIMIT 1',
            [assignmentId],
        ))?.rows[0];
        if (existing) throw new AlreadySubmittedError();
    }

    const { pairing_id, tournament_id, p_team, d_team } = asg;
    // This scorer is the presider when their assignment_id matches the presider row's scorer_assignment_id
    const isPresider = asg.presider_scorer_assignment_id === assignmentId;

    // ── 2. Scorer name ────────────────────────────────────────────────────────
    let scorerFirstName = '';
    let scorerLastName = '';
    if (asg.registered_scorer_id) {
        const sr = (await dbQuery<{ first_name: string; last_name: string }>(
            'SELECT first_name, last_name FROM scorers WHERE scorer_id = $1',
            [asg.registered_scorer_id],
        ))?.rows[0];
        if (sr) { scorerFirstName = sr.first_name; scorerLastName = sr.last_name; }
    } else if (asg.paper_scorer_id) {
        const pr = (await dbQuery<{ name: string }>(
            'SELECT name FROM paper_scorers WHERE scorer_id = $1',
            [asg.paper_scorer_id],
        ))?.rows[0];
        if (pr) scorerFirstName = pr.name;
    }

    // ── 3. Tournament / format ────────────────────────────────────────────────
    const tourney = (await dbQuery<{
        tournament_name: string;
        case_name: string;
        criminal_case: boolean;
        p_witnesses_called: number;
        d_witnesses_called: number;
        has_swing: boolean;
        format_id: string;
    }>(`
        SELECT t.name AS tournament_name, tf.case_name, tf.criminal_case, tf.p_witnesses_called,
               tf.d_witnesses_called, tf.has_swing, tf.format_id
        FROM tournaments t
        JOIN tournament_format tf ON tf.format_id = t.case_format_id
        WHERE t.id = $1
    `, [tournament_id]))?.rows[0];

    if (!tourney) throw new NotFoundError('Tournament not found');

    // ── 4. Teams ──────────────────────────────────────────────────────────────
    const teamsRows = (await dbQuery<{ id: string; code: string; name: string }>(
        'SELECT id, code, name FROM teams WHERE id = ANY($1)',
        [[p_team, d_team]],
    ))?.rows ?? [];
    const teamMap = Object.fromEntries(teamsRows.map(t => [t.id, t]));
    const pTeam = teamMap[p_team];
    const dTeam = teamMap[d_team];

    // ── 5. Presider name ──────────────────────────────────────────────────────
    // Resolve the name of whoever IS the presider for this pairing (not necessarily this scorer).
    let presiderName = '';
    if (asg.presider_scorer_assignment_id) {
        const pa = (await dbQuery<{
            registered_scorer_id: string | null;
            paper_scorer_id: string | null;
        }>(
            'SELECT registered_scorer_id, paper_scorer_id FROM scorer_pairing_assignments WHERE assignment_id = $1',
            [asg.presider_scorer_assignment_id],
        ))?.rows[0];

        if (pa?.registered_scorer_id) {
            const pr = (await dbQuery<{ first_name: string; last_name: string }>(
                'SELECT first_name, last_name FROM scorers WHERE scorer_id = $1',
                [pa.registered_scorer_id],
            ))?.rows[0];
            if (pr) presiderName = `${pr.first_name} ${pr.last_name}`;
        } else if (pa?.paper_scorer_id) {
            const pr = (await dbQuery<{ name: string }>(
                'SELECT name FROM paper_scorers WHERE scorer_id = $1',
                [pa.paper_scorer_id],
            ))?.rows[0];
            if (pr) presiderName = pr.name;
        }
    }

    // ── 6. Scoring categories + fields ────────────────────────────────────────
    const catRows = (await dbQuery<{
        id: string;
        name: string;
        witness_category: boolean;
        position: number;
    }>(
        'SELECT id, name, witness_category, position FROM scoring_categories WHERE tournament_id = $1 ORDER BY position',
        [tournament_id],
    ))?.rows ?? [];

    const fieldRows = (await dbQuery<{
        id: string;
        category_id: string;
        label: string;
        min_score: number;
        max_score: number;
        assignable: boolean;
        prosecution: boolean;
        defense: boolean;
        calling: boolean;
        crossing: boolean;
        visible_to_scorers: boolean;
        position: number;
        award_category_id: string | null;
    }>(
        `SELECT id, category_id, label, min_score, max_score, assignable,
                prosecution, defense, calling, crossing, visible_to_scorers, position,
                award_category_id
         FROM scoring_fields
         WHERE category_id = ANY($1)
           AND visible_to_scorers = true
         ORDER BY position`,
        [catRows.map(c => c.id)],
    ))?.rows ?? [];

    const fieldsByCat = new Map<string, typeof fieldRows>();
    for (const f of fieldRows) {
        if (!fieldsByCat.has(f.category_id)) fieldsByCat.set(f.category_id, []);
        fieldsByCat.get(f.category_id)!.push(f);
    }

    // ── 7. Witnesses for this format ──────────────────────────────────────────
    const witnessRows = (await dbQuery<{ id: string; name: string; side: 'P' | 'D' | 'S' }>(
        'SELECT id, name, side FROM case_witnesses WHERE case_format = $1',
        [tourney.format_id],
    ))?.rows ?? [];

    // ── 7b. Witness call order for this pairing ───────────────────────────────
    const callOrderRows = (await dbQuery<{
        team_id: string;
        witness_id: string;
        position: number;
    }>(
        `SELECT team_id, witness_id, position
         FROM witness_call_order
         WHERE pairing_id = $1
         ORDER BY team_id, position`,
        [pairing_id],
    ))?.rows ?? [];

    const pCallOrder = callOrderRows.filter(r => r.team_id === p_team).map(r => r.witness_id);
    const dCallOrder = callOrderRows.filter(r => r.team_id === d_team).map(r => r.witness_id);

    const witnessMap = new Map(witnessRows.map(w => [w.id, w]));

    const pWitnesses = witnessRows.filter(w => w.side === 'P');
    const dWitnesses = witnessRows.filter(w => w.side === 'D');
    const swingWitnesses = witnessRows.filter(w => w.side === 'S');

    const resolvedPWitnesses = pCallOrder.length > 0
        ? pCallOrder.map(id => witnessMap.get(id)).filter((w): w is typeof witnessRows[0] => w != null)
        : [...pWitnesses.slice(0, tourney.p_witnesses_called), ...swingWitnesses];

    const resolvedDWitnesses = dCallOrder.length > 0
        ? dCallOrder.map(id => witnessMap.get(id)).filter((w): w is typeof witnessRows[0] => w != null)
        : [...dWitnesses.slice(0, tourney.d_witnesses_called), ...swingWitnesses];

    // ── 8. Student assignments for this pairing ───────────────────────────────
    const studentAsgRows = (await dbQuery<{
        field_id: string;
        witness_id: string | null;
        student_id: string;
        team_id: string;
    }>(
        `SELECT field_id, witness_id, student_id, team_id
         FROM student_assignments
         WHERE pairing_id = $1`,
        [pairing_id],
    ))?.rows ?? [];

    const studentByField = new Map<string, { pStudentId: string | null; dStudentId: string | null }>();
    for (const sa of studentAsgRows) {
        const key = sa.witness_id ? `${sa.field_id}:${sa.witness_id}` : sa.field_id;
        const existing = studentByField.get(key) ?? { pStudentId: null, dStudentId: null };
        if (sa.team_id === p_team) existing.pStudentId = sa.student_id;
        else if (sa.team_id === d_team) existing.dStudentId = sa.student_id;
        studentByField.set(key, existing);
    }

    // ── 9. Student info ───────────────────────────────────────────────────────
    const studentsRecord: IScoreSheetFormat['students'] = {};
    const studentIds = new Set(studentAsgRows.map(sa => sa.student_id));
    if (studentIds.size > 0) {
        const studentRows = (await dbQuery<{
            student_id: string;
            student_name: string;
            pronouns: string | null;
            team_id: string;
        }>(
            'SELECT student_id, student_name, pronouns, team_id FROM team_rostered_students WHERE student_id = ANY($1)',
            [[...studentIds]],
        ))?.rows ?? [];
        for (const s of studentRows) {
            studentsRecord[s.student_id] = { name: s.student_name, pronouns: s.pronouns, schoolId: s.team_id };
        }
    }

    // ── 10. Assemble categories ───────────────────────────────────────────────
    const scoringCategories: IScoreSheetFormat['scoringCategories'] = {};
    const categoryOrder: string[] = [];
    const witnessesRecord: IScoreSheetFormat['witnesses'] = {};

    for (const cat of catRows) {
        const catFields = fieldsByCat.get(cat.id) ?? [];
        if (!catFields.length) continue;

        if (!cat.witness_category) {
            categoryOrder.push(cat.id);
            scoringCategories[cat.id] = {
                categoryName: cat.name,
                witnessId: null,
                categoryAssignments: catFields.map(f => {
                    const students = studentByField.get(f.id) ?? { pStudentId: null, dStudentId: null };
                    const side: 'P' | 'D' | 'BOTH' = f.prosecution && f.defense ? 'BOTH' : f.prosecution ? 'P' : 'D';
                    return {
                        assignmentName: f.label,
                        assignmentKey: `${cat.id}__${f.id}`,
                        pStudentId: side !== 'D' ? students.pStudentId : null,
                        dStudentId: side !== 'P' ? students.dStudentId : null,
                        side,
                        minScore: f.min_score,
                        maxScore: f.max_score,
                    };
                }),
            };
        } else {
            const seenWitnesses = new Set<string>();
            const calledWitnesses: typeof witnessRows = [];
            for (const w of [...resolvedPWitnesses, ...resolvedDWitnesses]) {
                if (!seenWitnesses.has(w.id)) { seenWitnesses.add(w.id); calledWitnesses.push(w); }
            }

            for (const witness of calledWitnesses) {
                witnessesRecord[witness.id] = { characterName: witness.name };
                const catId = `${cat.id}__${witness.id}`;
                categoryOrder.push(catId);
                scoringCategories[catId] = {
                    categoryName: cat.name,
                    witnessId: witness.id,
                    categoryAssignments: catFields.map(f => {
                        const students = studentByField.get(`${f.id}:${witness.id}`) ?? { pStudentId: null, dStudentId: null };
                        let side: 'P' | 'D' | 'BOTH' = f.prosecution && f.defense ? 'BOTH' : f.prosecution ? 'P' : 'D';
                        if (f.calling && !f.crossing) side = witness.side === 'P' || witness.side === 'S' ? 'P' : 'D';
                        else if (f.crossing && !f.calling) side = witness.side === 'P' || witness.side === 'S' ? 'D' : 'P';
                        return {
                            assignmentName: f.label,
                            assignmentKey: `${cat.id}__${f.id}__${witness.id}`,
                            pStudentId: side !== 'D' ? students.pStudentId : null,
                            dStudentId: side !== 'P' ? students.dStudentId : null,
                            side,
                            minScore: f.min_score,
                            maxScore: f.max_score,
                        };
                    }),
                };
            }
        }
    }

    // ── 11. Ballot options ────────────────────────────────────────────────────
    // Presiders with show_scores=false get tiebreaker-only mode.
    // show_scores=null means no presider row exists at all (this scorer is a regular judge).
    const fillableScores = !isPresider || asg.show_scores === true;

    // ── 12. Award categories ──────────────────────────────────────────────────
    const awardCatRows = (await dbQuery<{
        id: string; name: string; min_nominees: number; max_nominees: number;
    }>(
        'SELECT id, name, min_nominees, max_nominees FROM individual_award_categories WHERE tournament_id = $1 ORDER BY name',
        [tournament_id],
    ))?.rows ?? [];

    const awardCategories: IScoreSheetFormat['awardCategories'] = {};
    if (awardCatRows.length > 0) {
        const fieldsByAwardCat = new Map<string, string[]>();
        for (const f of fieldRows) {
            if (f.award_category_id) {
                if (!fieldsByAwardCat.has(f.award_category_id)) fieldsByAwardCat.set(f.award_category_id, []);
                fieldsByAwardCat.get(f.award_category_id)!.push(f.id);
            }
        }

        for (const ac of awardCatRows) {
            const linkedFieldIds = fieldsByAwardCat.get(ac.id) ?? [];
            const eligibleStudentIds = new Set<string>();
            for (const sa of studentAsgRows) {
                if (linkedFieldIds.includes(sa.field_id)) {
                    eligibleStudentIds.add(sa.student_id);
                }
            }
            awardCategories[ac.id] = {
                name: ac.name,
                minNominees: ac.min_nominees,
                maxNominees: ac.max_nominees,
                eligibleStudentIds: [...eligibleStudentIds],
            };
        }
    }

    return {
        isCriminal: tourney.criminal_case,
        ballotOptions: { fillableScores },
        pairingID: pairing_id,
        scorer: {
            firstName: scorerFirstName,
            lastName: scorerLastName,
            scorerID: assignmentId,
            isPaper: asg.paper_scorer_id != null,
        },
        presiderName,
        courtroomNumber: asg.courtroom_name ?? '',
        caseName: tourney.case_name,
        tournamentName: tourney.tournament_name,
        prosecutionCode: pTeam?.code ?? '',
        defenseCode: dTeam?.code ?? '',
        students: studentsRecord,
        witnesses: witnessesRecord,
        scoringCategories,
        categoryOrder,
        awardCategories,
    };
}

// ─── submitBallot ──────────────────────────────────────────────────────────────

/**
 * Persists a submitted ballot. Calculates raw point totals for p_points / d_points
 * from the scores array and inserts into the ballots table.
 * Throws NotFoundError if the assignment does not exist.
 */
export async function submitBallot(assignmentId: string, payload: ScorecardPayload): Promise<void> {
    const asg = (await dbQuery<{
        pairing_id: string;
        tournament_id: string;
        p_team: string;
        d_team: string;
        is_presider: boolean;
    }>(`
        SELECT spa.pairing_id, r.tournament_id, p.p_team, p.d_team, pres.presider_assignment_id = $1 as is_presider
        FROM scorer_pairing_assignments spa
        JOIN pairings p ON p.pairing_id = spa.pairing_id
        JOIN rounds r   ON r.round_id   = p.round_id
        join scorer_presider_assignment pres on pres.pairing_id = p.pairing_id
        WHERE spa.assignment_id = $1
    `, [assignmentId]))?.rows[0];

    if (!asg) throw new NotFoundError('Assignment not found');

    const pPoints = payload.scores.filter(s => s.side === 'P').reduce((sum, s) => sum + s.score, 0);
    const dPoints = payload.scores.filter(s => s.side === 'D').reduce((sum, s) => sum + s.score, 0);

    // Insert the ballot and its nominations atomically: if any nomination insert
    // fails, the ballot insert is rolled back too, so we never persist a ballot
    // with a partial set of nominations. Errors (including the 23505
    // unique-constraint violation on scorer_assignment_id, used by the route to
    // return 409) propagate to the caller.
    await withTransaction(async (client) => {
        const ballotResult = await client.query<{ ballot_id: string }>(
            `INSERT INTO ballots
                (scorer_assignment_id, tournament_id, pairing_id, ballot_json, p_team_id, d_team_id, p_points, d_points,  tiebreaker, presider_ballot)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8,$9,$10)
             RETURNING ballot_id`,
            [assignmentId, asg.tournament_id, asg.pairing_id, JSON.stringify(payload), asg.p_team, asg.d_team, pPoints, dPoints, payload.tiebreaker, asg.is_presider],
        );
        const ballotId = ballotResult.rows[0]?.ballot_id;
        if (!ballotId) throw new DbError('Failed to insert ballot');

        // Insert nominations into the structured table if present
        if (payload.nominations && payload.nominations.length > 0) {
            for (const nom of payload.nominations) {
                await client.query(
                    'INSERT INTO nominations (ballot_id, award_category_id, student_id, rank) VALUES ($1, $2, $3, $4)',
                    [ballotId, nom.awardCategoryId, nom.studentId, nom.rank],
                );
            }
        }
    });
}

// ─── reportConflict ───────────────────────────────────────────────────────────

/**
 * Atomically marks the assignment as conflict-reported (only when not already set)
 * and returns the context needed to send the notification email.
 * Returns null when the assignment doesn't exist.
 * Returns 'already_reported' when the flag was already set — suppresses duplicate emails.
 * The flag is cleared automatically when the assignment is deleted (CASCADE),
 * so a fresh assignment always starts clean.
 */
export async function getConflictReportContext(assignmentId: string): Promise<{
    scorerName: string;
    tournamentName: string;
    roundName: string | null;
    courtroomName: string | null;
    ownerEmail: string;
    ownerFirstName: string;
} | null | 'already_reported'> {
    // Single conditional UPDATE: only sets the flag if it was false.
    // rowCount === 0 means either the row doesn't exist or it was already reported.
    const flagResult = await dbQuery(
        `UPDATE scorer_pairing_assignments
         SET conflict_reported = true
         WHERE assignment_id = $1 AND conflict_reported = false`,
        [assignmentId],
    );

    if (!flagResult) return null; // DB error
    if ((flagResult.rowCount ?? 0) === 0) {
        // Distinguish not-found from already-reported
        const exists = (await dbQuery<{ assignment_id: string }>(
            'SELECT assignment_id FROM scorer_pairing_assignments WHERE assignment_id = $1',
            [assignmentId],
        ))?.rows[0];
        return exists ? 'already_reported' : null;
    }

    const row = (await dbQuery<{
        scorer_first_name: string;
        scorer_last_name: string;
        paper_name: string | null;
        tournament_name: string;
        round_name: string;
        courtroom_name: string | null;
        owner_email: string;
        owner_first_name: string;
    }>(`
        SELECT
            s.first_name        AS scorer_first_name,
            s.last_name         AS scorer_last_name,
            ps.name             AS paper_name,
            t.name              AS tournament_name,
            r.name              AS round_name,
            cr.name             AS courtroom_name,
            a.email             AS owner_email,
            a.first_name        AS owner_first_name
        FROM scorer_pairing_assignments spa
        JOIN pairings p     ON p.pairing_id  = spa.pairing_id
        JOIN rounds r       ON r.round_id    = p.round_id
        JOIN tournaments t  ON t.id          = r.tournament_id
        JOIN tournament_owners tow
                            ON tow.tournament_id = t.id AND tow.role = 'owner'
        JOIN auth a         ON a.user_id     = tow.delegate_id
        LEFT JOIN scorers s ON s.scorer_id   = spa.registered_scorer_id
        LEFT JOIN paper_scorers ps
                            ON ps.scorer_id  = spa.paper_scorer_id
        LEFT JOIN courtrooms cr ON cr.id     = p.courtroom
        WHERE spa.assignment_id = $1
        LIMIT 1
    `, [assignmentId]))?.rows[0];

    if (!row) return null;

    return {
        scorerName: row.paper_name ?? `${row.scorer_first_name} ${row.scorer_last_name}`,
        tournamentName: row.tournament_name,
        roundName: row.round_name,
        courtroomName: row.courtroom_name,
        ownerEmail: row.owner_email,
        ownerFirstName: row.owner_first_name,
    };
}

// ─── getBallot ────────────────────────────────────────────────────────────────

/**
 * Returns the stored ballot_json for a given assignment, or null if none has
 * been submitted yet. Used by the organizer scorecard viewer.
 */
export async function getBallot(assignmentId: string): Promise<ScorecardPayload | null> {
    const row = (await dbQuery<{ ballot_json: ScorecardPayload }>(
        'SELECT ballot_json FROM ballots WHERE scorer_assignment_id = $1',
        [assignmentId],
    ))?.rows[0];
    return row?.ballot_json ?? null;
}

// ─── submitNominations ────────────────────────────────────────────────────────

/**
 * Updates an existing ballot's ballot_json with nominations and inserts
 * structured rows into the nominations table.
 * This is the post-ballot step: after submitting scores, the scorer selects
 * students for each award category.
 * Throws NotFoundError if no ballot exists for this assignment.
 */
export async function submitNominations(
    assignmentId: string,
    nominations: { awardCategoryId: string; studentId: string; rank: number }[],
): Promise<void> {
    const existing = (await dbQuery<{ ballot_id: string; ballot_json: ScorecardPayload }>(
        'SELECT ballot_id, ballot_json FROM ballots WHERE scorer_assignment_id = $1',
        [assignmentId],
    ))?.rows[0];

    if (!existing) throw new NotFoundError('Ballot not found — submit scores first');

    // Merge nominations into the existing ballot_json
    const updatedPayload = {
        ...(typeof existing.ballot_json === 'string' ? JSON.parse(existing.ballot_json) : existing.ballot_json),
        nominations,
    };

    const result = await dbQuery(
        'UPDATE ballots SET ballot_json = $1 WHERE ballot_id = $2',
        [JSON.stringify(updatedPayload), existing.ballot_id],
    );
    if (!result) throw new DbError('submitNominations');

    // Insert structured nomination rows (replace any existing for this ballot)
    await dbQuery('DELETE FROM nominations WHERE ballot_id = $1', [existing.ballot_id]);
    if (nominations.length > 0) {
        await Promise.all(nominations.map(nom =>
            dbQuery(
                'INSERT INTO nominations (ballot_id, award_category_id, student_id, rank) VALUES ($1, $2, $3, $4)',
                [existing.ballot_id, nom.awardCategoryId, nom.studentId, nom.rank],
            )
        ));
    }
}
