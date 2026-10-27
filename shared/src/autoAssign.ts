/**
 * Pure, deterministic auto-assignment of scorers to the pairings of a single
 * round. Framework-free so it can be unit-tested in isolation and reused by the
 * organizer auto-assign wizard.
 *
 * Hard constraints (NEVER violated):
 *   - Conflict: a scorer is never placed on a pairing involving a team they
 *     conflict with (scorer_conflicts).
 *   - Double-booking: a scorer is assigned to at most one pairing in the round.
 *
 * Soft constraints (honored when possible, toggm/relaxable):
 *   - Avoid repeats: when `avoidRepeats` is true, a scorer is not placed on a
 *     pairing involving a team they have already scored in a prior round. If no
 *     eligible scorer remains for a slot, the slot is left EMPTY rather than
 *     violating the constraint.
 *   - Co-scoring preference: when choosing between otherwise-equal candidates,
 *     prefer a scorer who "wants to score with" someone already on the panel.
 *
 * The presider is intentionally left unset — the organizer chooses it afterward.
 */

export interface AutoAssignScorer {
    scorer_id: string;
    name: string;
    is_paper: boolean;
    /** Scorer IDs this judge prefers to score alongside (soft hint). */
    prefers_to_score_with?: string[];
}

export interface AutoAssignPairing {
    pairing_id: string;
    p_team: string;
    d_team: string;
    /**
     * Number of scorers already assigned to this pairing that will NOT be
     * removed (e.g. a scorer with a submitted ballot). The algorithm only fills
     * UP TO `scorersPerPairing`, counting these toward the target.
     */
    lockedCount?: number;
}

export interface AutoAssignInput {
    pairings: AutoAssignPairing[];
    /** Scorers the organizer marked available for this round. */
    availableScorers: AutoAssignScorer[];
    /** Target number of scorers per pairing (>= 1). */
    scorersPerPairing: number;
    /** Set of `${scorer_id}:${team_id}` conflict keys. */
    conflicts: Set<string>;
    /** Set of `${scorer_id}:${team_id}` prior-round history keys. */
    history: Set<string>;
    /** When true, avoid placing a scorer on a team they have already seen. */
    avoidRepeats: boolean;
}

export interface AutoAssignSlotFill {
    scorer_id: string;
    name: string;
    is_paper: boolean;
}

export interface AutoAssignPairingResult {
    pairing_id: string;
    /** Newly proposed scorer assignments for this pairing (excludes locked ones). */
    assigned: AutoAssignSlotFill[];
    /** How many slots could not be filled under the active constraints. */
    unfilled: number;
    /** Human-readable reason when `unfilled > 0`, else null. */
    unfilledReason: string | null;
}

export interface AutoAssignResult {
    pairings: AutoAssignPairingResult[];
    /** Total newly assigned slots across all pairings. */
    totalAssigned: number;
    /** Total slots left empty across all pairings. */
    totalUnfilled: number;
}

/** True when a scorer conflicts with either team of a pairing. */
function hasConflict(conflicts: Set<string>, scorerId: string, p: AutoAssignPairing): boolean {
    return conflicts.has(`${scorerId}:${p.p_team}`) || conflicts.has(`${scorerId}:${p.d_team}`);
}

/** True when a scorer has already seen either team of a pairing (prior rounds). */
function hasSeen(history: Set<string>, scorerId: string, p: AutoAssignPairing): boolean {
    return history.has(`${scorerId}:${p.p_team}`) || history.has(`${scorerId}:${p.d_team}`);
}

/**
 * Picks the open pairing with the fewest eligible scorers (most-constrained-first),
 * skipping any with zero eligible. Returns null when no open pairing is fillable.
 */
function mostConstrained(
    open: AutoAssignPairing[],
    eligibleFor: (p: AutoAssignPairing) => AutoAssignScorer[],
): AutoAssignPairing | null {
    let target: AutoAssignPairing | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const p of open) {
        const count = eligibleFor(p).length;
        if (count > 0 && count < best) {
            target = p;
            best = count;
        }
    }
    return target;
}

/**
 * Chooses the best eligible scorer for a slot: least-loaded first, then soft
 * co-scoring preference, then name for determinism.
 */
function bestCandidate(
    eligible: AutoAssignScorer[],
    load: Map<string, number>,
    panelIds: Set<string>,
    all: AutoAssignScorer[],
): AutoAssignScorer {
    return [...eligible].sort((a, b) => {
        const la = load.get(a.scorer_id) ?? 0;
        const lb = load.get(b.scorer_id) ?? 0;
        if (la !== lb) return la - lb;
        const pref = prefScore(b, panelIds, all) - prefScore(a, panelIds, all);
        if (pref !== 0) return pref;
        return a.name.localeCompare(b.name);
    })[0];
}

/**
 * Runs the load-balancing greedy assignment. Deterministic: pairings are
 * processed most-constrained-first (fewest eligible scorers), and within a slot
 * the least-loaded eligible scorer wins, tie-broken by co-scoring preference
 * satisfaction and then by name for stability.
 */
export function autoAssignScorers(input: AutoAssignInput): AutoAssignResult {
    const { pairings, availableScorers, conflicts, history, avoidRepeats } = input;
    const scorersPerPairing = Math.max(1, Math.floor(input.scorersPerPairing));

    // Per-scorer load (number of pairings assigned so far this run) and the set
    // of scorers already placed in the round (double-booking guard).
    const load = new Map<string, number>();
    for (const s of availableScorers) load.set(s.scorer_id, 0);
    const usedThisRound = new Set<string>();

    // Panels being built, keyed by pairing. Seeded empty (locked assignments are
    // counted via lockedCount but are not enumerated here).
    const panels = new Map<string, AutoAssignSlotFill[]>();
    for (const p of pairings) panels.set(p.pairing_id, []);

    /** Scorers eligible for a pairing right now (hard + active soft constraints). */
    const eligibleFor = (p: AutoAssignPairing): AutoAssignScorer[] =>
        availableScorers.filter(s =>
            !usedThisRound.has(s.scorer_id) &&
            !hasConflict(conflicts, s.scorer_id, p) &&
            !(avoidRepeats && hasSeen(history, s.scorer_id, p)),
        );

    const slotsNeeded = (p: AutoAssignPairing): number =>
        Math.max(0, scorersPerPairing - (p.lockedCount ?? 0) - (panels.get(p.pairing_id)!.length));

    const results = new Map<string, AutoAssignPairingResult>();
    for (const p of pairings) {
        results.set(p.pairing_id, { pairing_id: p.pairing_id, assigned: [], unfilled: 0, unfilledReason: null });
    }

    // Fill one slot across the round at a time, always targeting the pairing with
    // the fewest eligible candidates (most-constrained-first) to reduce dead ends.
    // Loop until no pairing can take another scorer.
    for (;;) {
        const open = pairings.filter(p => slotsNeeded(p) > 0);
        if (open.length === 0) break;

        const target = mostConstrained(open, eligibleFor);
        // No open pairing has any eligible scorer left — stop; remaining slots
        // are recorded as unfilled below.
        if (target === null) break;

        const panel = panels.get(target.pairing_id)!;
        const panelIds = new Set(panel.map(a => a.scorer_id));
        const chosen = bestCandidate(eligibleFor(target), load, panelIds, availableScorers);

        panel.push({ scorer_id: chosen.scorer_id, name: chosen.name, is_paper: chosen.is_paper });
        results.get(target.pairing_id)!.assigned.push({ scorer_id: chosen.scorer_id, name: chosen.name, is_paper: chosen.is_paper });
        usedThisRound.add(chosen.scorer_id);
        load.set(chosen.scorer_id, (load.get(chosen.scorer_id) ?? 0) + 1);
    }

    // Record unfilled slots + reasons for any pairing still short of the target.
    let totalAssigned = 0;
    let totalUnfilled = 0;
    for (const p of pairings) {
        const r = results.get(p.pairing_id)!;
        totalAssigned += r.assigned.length;
        const short = slotsNeeded(p);
        if (short > 0) {
            r.unfilled = short;
            r.unfilledReason = unfilledReason(p, input);
            totalUnfilled += short;
        }
    }

    return { pairings: pairings.map(p => results.get(p.pairing_id)!), totalAssigned, totalUnfilled };
}

/**
 * Soft co-scoring score for a candidate relative to the current panel: +1 if the
 * candidate prefers someone on the panel, +1 if someone on the panel prefers the
 * candidate. Higher is better.
 */
function prefScore(candidate: AutoAssignScorer, panelIds: Set<string>, all: AutoAssignScorer[]): number {
    let score = 0;
    const wants = candidate.prefers_to_score_with ?? [];
    if (wants.some(id => panelIds.has(id))) score += 1;
    for (const panelId of panelIds) {
        const panelScorer = all.find(s => s.scorer_id === panelId);
        if (panelScorer?.prefers_to_score_with?.includes(candidate.scorer_id)) {
            score += 1;
            break;
        }
    }
    return score;
}

/** Explains why a pairing could not be fully staffed. */
function unfilledReason(p: AutoAssignPairing, input: AutoAssignInput): string {
    const { availableScorers, conflicts, history, avoidRepeats } = input;
    // Were there scorers who were only excluded by the (soft) repeat rule?
    const blockedByRepeatOnly = availableScorers.some(s =>
        !hasConflict(conflicts, s.scorer_id, p) &&
        avoidRepeats && hasSeen(history, s.scorer_id, p),
    );
    if (blockedByRepeatOnly) {
        return 'Not enough eligible judges: every remaining available judge has already seen one of these teams. Turn off “avoid repeat matchups” or add more judges.';
    }
    const anyNonConflicting = availableScorers.some(s => !hasConflict(conflicts, s.scorer_id, p));
    if (!anyNonConflicting) {
        return 'Not enough eligible judges: every available judge conflicts with one of these teams.';
    }
    return 'Not enough available judges to fill every slot — add more judges or lower the scorers-per-pairing target.';
}
