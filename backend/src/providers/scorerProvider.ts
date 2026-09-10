import { dbQuery, withTransaction } from '../db';
import type { IScoreSheetFormat, ScorecardPayload } from '@mock-scores/shared';
import { DbError, NotFoundError, AlreadySubmittedError, ConflictReportedError, RoundNotLockedError } from '../errors';
import {IBallotRow} from "../types/dbtypes";

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
    /** Whether to show the tiebreaker selection — true only for the presider's ballot. */
    showTiebreaker: boolean;
    roundLocked: boolean;
}

/**
 * Extracts the `field_id` embedded in an `assignmentKey`.
 *
 * Assignment keys are built by the scoresheet builder as either:
 *   - `${categoryId}__${fieldId}`                (non-witness category)
 *   - `${categoryId}__${fieldId}__${witnessId}`  (witness category)
 *
 * In both cases the field id is the second `__`-delimited segment. Returns null
 * when the key does not contain a field segment.
 */
export function fieldIdFromAssignmentKey(assignmentKey: string): string | null {
    const parts = assignmentKey.split('__');
    return parts.length >= 2 ? parts[1] : null;
}

/**
 * Computes P/D point totals from a set of scores, applying each scoring field's
 * multiplier. The multiplier is resolved from `assignmentKey` (which embeds the
 * field id) rather than `categoryId`, since a category has many fields and the
 * multiplier is per-field.
 *
 * `multipliers` maps field_id → multiplier. A missing entry defaults to 1 so an
 * unknown/legacy field never zeroes out its contribution. `numeric` columns come
 * back from pg as strings, so multipliers are coerced with Number().
 */
export function computeBallotTotals(
    scores: { side: 'P' | 'D'; assignmentKey: string; score: number }[],
    multipliers: Map<string, number>,
): { pPoints: number; dPoints: number } {
    const contribution = (s: { assignmentKey: string; score: number }) => {
        const fieldId = fieldIdFromAssignmentKey(s.assignmentKey);
        const mult = fieldId != null ? Number(multipliers.get(fieldId) ?? 1) : 1;
        return s.score * mult;
    };
    let pPoints = 0;
    let dPoints = 0;
    for (const s of scores) {
        if (s.side === 'P') pPoints += contribution(s);
        else if (s.side === 'D') dPoints += contribution(s);
    }
    return { pPoints, dPoints };
}

/**
 * Loads a field_id → multiplier map for every scoring field in a tournament.
 * Used to apply per-field multipliers when computing/recomputing ballot totals.
 */
export async function getFieldMultipliers(tournamentId: string): Promise<Map<string, number>> {
    const rows = (await dbQuery<{ id: string; multiplier: number }>(
        `SELECT sf.id, sf.multiplier
         FROM scoring_fields sf
                  JOIN scoring_categories sc ON sc.id = sf.category_id
         WHERE sc.tournament_id = $1`,
        [tournamentId],
    ))?.rows ?? [];
    return new Map(rows.map(r => [r.id, Number(r.multiplier)]));
}

/**
 * Builds the scoring categories, students, witnesses, and award categories for a
 * pairing. Shared by {@link getSheetFromAssignment}, {@link getSheetFromBallot},
 * and {@link getPairingBallotFormat} (blank printable ballot).
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
        multiplier: number;
        assignable: boolean;
        prosecution: boolean;
        defense: boolean;
        calling: boolean;
        crossing: boolean;
        visible_to_scorers: boolean;
        position: number;
        award_category_id: string | null;
    }>(
        `SELECT id, category_id, label, min_score, max_score, multiplier, assignable,
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
                        multiplier: Number(f.multiplier),
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
                            multiplier: Number(f.multiplier),
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
        ballotOptions: { fillableScores: ctx.fillableScores, showTiebreaker: ctx.showTiebreaker, },
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
        prosecutionId: p_team,
        defenseId: d_team,
        students: studentsRecord,
        witnesses: witnessesRecord,
        scoringCategories,
        categoryOrder,
        awardCategories,
        roundLocked: ctx.roundLocked,
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
        locked: boolean;
    }>(`
        SELECT p.p_team, p.d_team, cr.name AS courtroom_name, r.tournament_id, r.locked
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
        showTiebreaker: false,
        roundLocked: pairing.locked,
    });
}

// ─── scorer score sheets ───────────────────────────────────────────────────────

interface ScorerSheetRow {
    assignment_id: string;
    pairing_id: string;
    paper_scorer_id: string | null;
    p_team: string;
    d_team: string;
    courtroom_name: string | null;
    tournament_id: string;
    presider_scorer_assignment_id: string | null;
    show_scores: boolean | null;
    conflict_reported: boolean;
    locked: boolean;
    scorer_first_name: string | null;
    scorer_last_name: string | null;
    paper_scorer_name: string | null;
    presider_first_name: string | null;
    presider_last_name: string | null;
    presider_paper_name: string | null;
}

/**
 * Builds the full IScoreSheetFormat from an existing ballot ID.
 *
 * The ballot already exists by definition, so this path does not perform the
 * AlreadySubmittedError guard. It still honors the conflict guard unless
 * skipGuards is true.
 */
export async function getSheetFromBallot(
    ballotId: string,
    options?: { skipGuards?: boolean },
): Promise<IScoreSheetFormat> {
    const asg = (await dbQuery<ScorerSheetRow>(`
        SELECT
            spa.assignment_id,
            spa.pairing_id,
            spa.paper_scorer_id,
            p.p_team,
            p.d_team,
            cr.name AS courtroom_name,
            r.tournament_id,
            r.locked,
            pres.scorer_assignment_id AS presider_scorer_assignment_id,
            pres.show_scores,
            spa.conflict_reported,
            scorer.first_name AS scorer_first_name,
            scorer.last_name AS scorer_last_name,
            paper.name AS paper_scorer_name,
            presider_scorer.first_name AS presider_first_name,
            presider_scorer.last_name AS presider_last_name,
            presider_paper.name AS presider_paper_name
        FROM ballots b
        JOIN scorer_pairing_assignments spa
             ON spa.assignment_id = b.scorer_assignment_id
        JOIN pairings p
             ON p.pairing_id = spa.pairing_id
        JOIN rounds r
             ON r.round_id = p.round_id
        LEFT JOIN courtrooms cr
             ON cr.id = p.courtroom
        LEFT JOIN scorer_presider_assignment pres
             ON pres.pairing_id = spa.pairing_id
        LEFT JOIN scorer_pairing_assignments presider_assignment
             ON presider_assignment.assignment_id = pres.scorer_assignment_id
        LEFT JOIN scorers scorer
             ON scorer.scorer_id = spa.registered_scorer_id
        LEFT JOIN paper_scorers paper
             ON paper.scorer_id = spa.paper_scorer_id
        LEFT JOIN scorers presider_scorer
             ON presider_scorer.scorer_id = presider_assignment.registered_scorer_id
        LEFT JOIN paper_scorers presider_paper
             ON presider_paper.scorer_id = presider_assignment.paper_scorer_id
        WHERE b.ballot_id = $1
    `, [ballotId]))?.rows[0];

    if (!asg) throw new NotFoundError('Ballot not found');

    if (asg.conflict_reported && !options?.skipGuards) {
        throw new ConflictReportedError();
    }

    const isPresider = asg.presider_scorer_assignment_id === asg.assignment_id;

    const scorerFirstName = asg.paper_scorer_name ?? asg.scorer_first_name ?? '';
    const scorerLastName = asg.paper_scorer_name ? '' : asg.scorer_last_name ?? '';
    const presiderName = asg.presider_paper_name ??
        [asg.presider_first_name, asg.presider_last_name].filter(Boolean).join(' ');

    return buildScoreSheetForPairing({
        pairingId: asg.pairing_id,
        tournamentId: asg.tournament_id,
        pTeam: asg.p_team,
        dTeam: asg.d_team,
        courtroomName: asg.courtroom_name,
        presiderName,
        scorerAssignmentId: asg.assignment_id,
        scorerFirstName,
        scorerLastName,
        isPaper: asg.paper_scorer_id != null,
        fillableScores: !isPresider || asg.show_scores === true,
        showTiebreaker: isPresider,
        roundLocked: asg.locked,
    });
}

/**
 * Builds the full IScoreSheetFormat from a scorer assignment ID.
 *
 * This is the scorer-link path. If a ballot already exists for the assignment,
 * the link is spent and AlreadySubmittedError is thrown unless skipGuards is true.
 */
export async function getSheetFromAssignment(
    assignmentId: string,
    options?: { skipGuards?: boolean },
): Promise<IScoreSheetFormat> {
    const asg = (await dbQuery<ScorerSheetRow>(`
        SELECT
            spa.assignment_id,
            spa.pairing_id,
            spa.paper_scorer_id,
            p.p_team,
            p.d_team,
            cr.name AS courtroom_name,
            r.tournament_id,
            r.locked,
            pres.scorer_assignment_id AS presider_scorer_assignment_id,
            pres.show_scores,
            spa.conflict_reported,
            scorer.first_name AS scorer_first_name,
            scorer.last_name AS scorer_last_name,
            paper.name AS paper_scorer_name,
            presider_scorer.first_name AS presider_first_name,
            presider_scorer.last_name AS presider_last_name,
            presider_paper.name AS presider_paper_name
        FROM scorer_pairing_assignments spa
        JOIN pairings p
             ON p.pairing_id = spa.pairing_id
        JOIN rounds r
             ON r.round_id = p.round_id
        LEFT JOIN courtrooms cr
             ON cr.id = p.courtroom
        LEFT JOIN scorer_presider_assignment pres
             ON pres.pairing_id = spa.pairing_id
        LEFT JOIN scorer_pairing_assignments presider_assignment
             ON presider_assignment.assignment_id = pres.scorer_assignment_id
        LEFT JOIN scorers scorer
             ON scorer.scorer_id = spa.registered_scorer_id
        LEFT JOIN paper_scorers paper
             ON paper.scorer_id = spa.paper_scorer_id
        LEFT JOIN scorers presider_scorer
             ON presider_scorer.scorer_id = presider_assignment.registered_scorer_id
        LEFT JOIN paper_scorers presider_paper
             ON presider_paper.scorer_id = presider_assignment.paper_scorer_id
        WHERE spa.assignment_id = $1
    `, [assignmentId]))?.rows[0];

    if (!asg) throw new NotFoundError('Assignment not found');

    if (!options?.skipGuards) {
        if (asg.conflict_reported) {
            throw new ConflictReportedError();
        }

        const existing = (await dbQuery<{ ballot_id: string }>(
            'SELECT ballot_id FROM ballots WHERE scorer_assignment_id = $1 LIMIT 1',
            [assignmentId],
        ))?.rows[0];

        if (existing) throw new AlreadySubmittedError();
    }

    const isPresider = asg.presider_scorer_assignment_id === asg.assignment_id;

    const scorerFirstName = asg.paper_scorer_name ?? asg.scorer_first_name ?? '';
    const scorerLastName = asg.paper_scorer_name ? '' : asg.scorer_last_name ?? '';
    const presiderName = asg.presider_paper_name ??
        [asg.presider_first_name, asg.presider_last_name].filter(Boolean).join(' ');

    return buildScoreSheetForPairing({
        pairingId: asg.pairing_id,
        tournamentId: asg.tournament_id,
        pTeam: asg.p_team,
        dTeam: asg.d_team,
        courtroomName: asg.courtroom_name,
        presiderName,
        scorerAssignmentId: asg.assignment_id,
        scorerFirstName,
        scorerLastName,
        isPaper: asg.paper_scorer_id != null,
        fillableScores: !isPresider || asg.show_scores === true,
        showTiebreaker: isPresider,
        roundLocked: asg.locked,
    });
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
        locked: boolean;
    }>(`
        SELECT spa.pairing_id, r.tournament_id, p.p_team, p.d_team, r.locked,
               (pres.scorer_assignment_id = spa.assignment_id) AS is_presider
        FROM scorer_pairing_assignments spa
                 JOIN pairings p ON p.pairing_id = spa.pairing_id
                 JOIN rounds r   ON r.round_id   = p.round_id
                 LEFT JOIN scorer_presider_assignment pres ON pres.pairing_id = p.pairing_id
        WHERE spa.assignment_id = $1
    `, [assignmentId]))?.rows[0];

    if (!asg) throw new NotFoundError('Assignment not found');

    // Scoring only opens once the organizer has locked the round (i.e. finalized
    // pairings, rosters, and call orders). Reject ballots for unlocked rounds.
    if (!asg.locked) throw new RoundNotLockedError();

    const multipliers = await getFieldMultipliers(asg.tournament_id);
    const { pPoints, dPoints } = computeBallotTotals(payload.scores, multipliers);

    // Only the presider's ballot carries a tiebreaker. Every other ballot stores
    // NULL so standings never credit a non-presider ballot with a tiebreaker win.
    const isPresiderBallot = asg.is_presider === true;
    const tiebreaker = isPresiderBallot ? payload.tiebreaker : null;

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
            [assignmentId, asg.tournament_id, asg.pairing_id, JSON.stringify(payload), asg.p_team, asg.d_team, pPoints, dPoints, tiebreaker, isPresiderBallot],
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
export async function getBallot(ballotId: string): Promise<IBallotRow | null> {
    const row = (await dbQuery<IBallotRow>(
        'SELECT * FROM ballots WHERE ballot_id = $1',
        [ballotId],
    ))?.rows[0];
    return row ?? null;
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
