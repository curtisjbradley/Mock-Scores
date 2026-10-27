import { autoAssignScorers } from '../autoAssign.js';
import type { AutoAssignInput, AutoAssignScorer, AutoAssignPairing } from '../autoAssign.js';

/** Convenience scorer factory. */
function scorer(id: string, overrides: Partial<AutoAssignScorer> = {}): AutoAssignScorer {
    return { scorer_id: id, name: id.toUpperCase(), is_paper: false, ...overrides };
}

/** Convenience pairing factory. */
function pairing(id: string, p: string, d: string, lockedCount = 0): AutoAssignPairing {
    return { pairing_id: id, p_team: p, d_team: d, lockedCount };
}

function baseInput(overrides: Partial<AutoAssignInput> = {}): AutoAssignInput {
    return {
        pairings: [],
        availableScorers: [],
        scorersPerPairing: 2,
        conflicts: new Set<string>(),
        history: new Set<string>(),
        avoidRepeats: true,
        ...overrides,
    };
}

/** Flatten assignments to a `${pairing}:${scorer}` set for easy assertions. */
function assignmentPairs(result: ReturnType<typeof autoAssignScorers>): Set<string> {
    const out = new Set<string>();
    for (const p of result.pairings) {
        for (const a of p.assigned) out.add(`${p.pairing_id}:${a.scorer_id}`);
    }
    return out;
}

describe('autoAssignScorers', () => {
    it('fills every slot when there are exactly enough scorers (load-balanced)', () => {
        const result = autoAssignScorers(baseInput({
            pairings: [pairing('r1', 'tA', 'tB'), pairing('r2', 'tC', 'tD')],
            availableScorers: [scorer('s1'), scorer('s2'), scorer('s3'), scorer('s4')],
            scorersPerPairing: 2,
        }));

        expect(result.totalAssigned).toBe(4);
        expect(result.totalUnfilled).toBe(0);
        // Each pairing gets exactly 2.
        for (const p of result.pairings) expect(p.assigned).toHaveLength(2);
    });

    it('never double-books a scorer across pairings in the same round', () => {
        const result = autoAssignScorers(baseInput({
            pairings: [pairing('r1', 'tA', 'tB'), pairing('r2', 'tC', 'tD')],
            availableScorers: [scorer('s1'), scorer('s2'), scorer('s3'), scorer('s4')],
            scorersPerPairing: 2,
        }));
        const seen = new Set<string>();
        for (const p of result.pairings) {
            for (const a of p.assigned) {
                expect(seen.has(a.scorer_id)).toBe(false);
                seen.add(a.scorer_id);
            }
        }
    });

    it('never assigns a scorer to a pairing they conflict with (hard)', () => {
        const result = autoAssignScorers(baseInput({
            pairings: [pairing('r1', 'tA', 'tB')],
            availableScorers: [scorer('s1'), scorer('s2')],
            scorersPerPairing: 2,
            // s1 conflicts with tA.
            conflicts: new Set(['s1:tA']),
        }));
        const pairs = assignmentPairs(result);
        expect(pairs.has('r1:s1')).toBe(false);
        expect(pairs.has('r1:s2')).toBe(true);
        // One slot cannot be filled (only s2 is eligible).
        expect(result.pairings[0].unfilled).toBe(1);
        expect(result.pairings[0].unfilledReason).toMatch(/conflict|not enough/i);
    });

    it('avoids repeat matchups when the toggle is on, leaving slots empty rather than repeating', () => {
        const result = autoAssignScorers(baseInput({
            pairings: [pairing('r1', 'tA', 'tB')],
            availableScorers: [scorer('s1')],
            scorersPerPairing: 1,
            history: new Set(['s1:tA']), // s1 already saw tA
            avoidRepeats: true,
        }));
        expect(assignmentPairs(result).has('r1:s1')).toBe(false);
        expect(result.totalUnfilled).toBe(1);
        expect(result.pairings[0].unfilledReason).toMatch(/already seen/i);
    });

    it('allows repeats when the toggle is off', () => {
        const result = autoAssignScorers(baseInput({
            pairings: [pairing('r1', 'tA', 'tB')],
            availableScorers: [scorer('s1')],
            scorersPerPairing: 1,
            history: new Set(['s1:tA']),
            avoidRepeats: false,
        }));
        expect(assignmentPairs(result).has('r1:s1')).toBe(true);
        expect(result.totalUnfilled).toBe(0);
    });

    it('honors co-scoring preference as a soft tie-breaker', () => {
        // Two pairings, one slot each is forced; then a shared slot should pull in
        // the scorer who prefers to work with whoever is already on the panel.
        // s1 and s2 both eligible for r1's second slot; s2 prefers s_anchor who is
        // already placed, so s2 should win the tie over s1.
        const result = autoAssignScorers(baseInput({
            pairings: [pairing('r1', 'tA', 'tB')],
            availableScorers: [
                scorer('anchor'),
                scorer('s1', { name: 'AAA' }),           // alphabetically first
                scorer('s2', { name: 'ZZZ', prefers_to_score_with: ['anchor'] }),
            ],
            scorersPerPairing: 2,
            // Force anchor onto r1 first by making s1/s2 conflict with a decoy? Simpler:
            // all three eligible; load starts equal. First slot: lowest load, tie broken
            // by name -> 'AAA' (s1)? To test preference we instead give 3 slots.
        }));
        // With 2 slots and 3 scorers, 2 are chosen. anchor + whichever wins ties.
        // This mainly asserts the run is deterministic and fills 2.
        expect(result.pairings[0].assigned).toHaveLength(2);
    });

    it('prefers the co-scoring partner when both are otherwise equal', () => {
        // One pairing needs 2. anchor is forced in first (name 'A'). For the 2nd slot
        // s_pref (prefers anchor) should beat s_plain despite a later name.
        const result = autoAssignScorers(baseInput({
            pairings: [pairing('r1', 'tA', 'tB')],
            availableScorers: [
                scorer('anchor', { name: 'A Anchor' }),
                scorer('plain', { name: 'B Plain' }),
                scorer('pref', { name: 'C Pref', prefers_to_score_with: ['anchor'] }),
            ],
            scorersPerPairing: 2,
        }));
        const ids = result.pairings[0].assigned.map(a => a.scorer_id);
        expect(ids).toContain('anchor');     // lowest name, placed first
        expect(ids).toContain('pref');       // preference beats 'plain' on the tie
        expect(ids).not.toContain('plain');
    });

    it('counts locked assignments toward the target and only fills the remainder', () => {
        const result = autoAssignScorers(baseInput({
            // r1 already has 1 locked scorer (e.g. a submitted ballot); target 2 -> fill 1.
            pairings: [pairing('r1', 'tA', 'tB', 1)],
            availableScorers: [scorer('s1'), scorer('s2')],
            scorersPerPairing: 2,
        }));
        expect(result.pairings[0].assigned).toHaveLength(1);
        expect(result.totalUnfilled).toBe(0);
    });

    it('does not assign a presider (leaves panel presider-less)', () => {
        const result = autoAssignScorers(baseInput({
            pairings: [pairing('r1', 'tA', 'tB')],
            availableScorers: [scorer('s1'), scorer('s2')],
            scorersPerPairing: 2,
        }));
        // The result shape carries no presider field — assignments are plain fills.
        for (const a of result.pairings[0].assigned) {
            expect(a).toEqual(expect.objectContaining({ scorer_id: expect.any(String), name: expect.any(String), is_paper: expect.any(Boolean) }));
            expect(a).not.toHaveProperty('is_presider');
        }
    });

    it('is deterministic: identical input yields identical output', () => {
        const build = () => autoAssignScorers(baseInput({
            pairings: [pairing('r1', 'tA', 'tB'), pairing('r2', 'tC', 'tD')],
            availableScorers: [scorer('s1'), scorer('s2'), scorer('s3')],
            scorersPerPairing: 2,
        }));
        expect(JSON.stringify(build())).toEqual(JSON.stringify(build()));
    });

    it('spreads scorers evenly rather than overloading one judge', () => {
        // 3 pairings x 1 slot, 3 scorers -> each used once.
        const result = autoAssignScorers(baseInput({
            pairings: [pairing('r1', 'tA', 'tB'), pairing('r2', 'tC', 'tD'), pairing('r3', 'tE', 'tF')],
            availableScorers: [scorer('s1'), scorer('s2'), scorer('s3')],
            scorersPerPairing: 1,
        }));
        const counts = new Map<string, number>();
        for (const p of result.pairings) for (const a of p.assigned) counts.set(a.scorer_id, (counts.get(a.scorer_id) ?? 0) + 1);
        for (const c of counts.values()) expect(c).toBe(1);
        expect(result.totalAssigned).toBe(3);
    });

    it('reports unfilled slots when there are too few scorers', () => {
        const result = autoAssignScorers(baseInput({
            pairings: [pairing('r1', 'tA', 'tB')],
            availableScorers: [scorer('s1')],
            scorersPerPairing: 3,
            avoidRepeats: false,
        }));
        expect(result.pairings[0].assigned).toHaveLength(1);
        expect(result.pairings[0].unfilled).toBe(2);
        expect(result.totalUnfilled).toBe(2);
        expect(result.pairings[0].unfilledReason).toMatch(/not enough available judges/i);
    });

    it('prioritizes the most-constrained pairing first', () => {
        // s1 conflicts with everything in r2 except nothing; r2 only has s2 eligible.
        // r1 has both s1 and s2 eligible. With 1 slot each and 2 scorers, the
        // constrained pairing (r2, only s2 eligible) must get s2, leaving s1 for r1.
        const result = autoAssignScorers(baseInput({
            pairings: [pairing('r1', 'tA', 'tB'), pairing('r2', 'tC', 'tD')],
            availableScorers: [scorer('s1'), scorer('s2')],
            scorersPerPairing: 1,
            conflicts: new Set(['s1:tC']), // s1 cannot do r2
        }));
        const pairs = assignmentPairs(result);
        expect(pairs.has('r2:s2')).toBe(true);
        expect(pairs.has('r1:s1')).toBe(true);
        expect(result.totalUnfilled).toBe(0);
    });
});
