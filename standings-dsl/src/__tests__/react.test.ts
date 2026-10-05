// Tests for the pure (non-React, non-Blockly) surface of the `src/react/` UI
// module. The React components themselves mount Blockly / render DOM and are
// out of scope for the node test environment, but their underlying data and
// helpers are deterministic and worth locking down:
//
//   • dummyTeams    — the sample data that drives the live preview / docs playground
//   • AMTA_DEMO_DSL — the playground's default config (must stay parseable + round-trip)
//   • formatRank    — the rank-display helper shared by every standings table

import { dummyTeams } from '../react/dummyTeams';
import { AMTA_DEMO_DSL } from '../react/demoConfigs';
import { formatRank } from '../react/formatRank';
import { parseDsl, serializeConfig } from '../dsl';
import { computeStandings } from '../interp';
import type { IStandingsTeam } from '@mock-scores/shared';

describe('react module — dummyTeams', () => {
  it('is a non-empty, well-formed IStandingsTeam[]', () => {
    expect(dummyTeams.length).toBeGreaterThan(0);
    for (const t of dummyTeams) {
      expect(typeof t.name).toBe('string');
      expect(typeof t.code).toBe('string');
      expect(Array.isArray(t.pairings)).toBe(true);
      expect(t.pairings.length).toBeGreaterThan(0);
      for (const p of t.pairings) {
        expect(typeof p.opponent).toBe('string');
        expect(p.ballots.length).toBeGreaterThan(0);
        expect(typeof p.won_presider_tiebreaker).toBe('boolean');
        expect(typeof p.num_scorers).toBe('number');
        for (const b of p.ballots) {
          expect(typeof b.pointsFor).toBe('number');
          expect(typeof b.pointsAgainst).toBe('number');
        }
      }
    }
  });

  it('has unique team codes', () => {
    const codes = dummyTeams.map(t => t.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('every pairing opponent refers to a real team code', () => {
    const codes = new Set(dummyTeams.map(t => t.code));
    for (const t of dummyTeams) {
      for (const p of t.pairings) {
        expect(codes.has(p.opponent)).toBe(true);
      }
    }
  });

  it('produces a full, uniquely-ranked standings under the AMTA demo config', () => {
    const rows = computeStandings(dummyTeams as IStandingsTeam[], parseDsl(AMTA_DEMO_DSL));
    expect(rows.length).toBe(dummyTeams.length);
    // Default method is `first` -> strictly sequential ranks 1..N.
    expect(rows.map(r => r.rank)).toEqual(dummyTeams.map((_, i) => i + 1));
  });
});

describe('react module — AMTA_DEMO_DSL', () => {
  it('parses without throwing', () => {
    expect(() => parseDsl(AMTA_DEMO_DSL)).not.toThrow();
  });

  it('round-trips through parse/serialize', () => {
    const cfg = parseDsl(AMTA_DEMO_DSL);
    const reparsed = parseDsl(serializeConfig(cfg));
    expect(reparsed).toEqual(cfg);
  });

  it('defines the four AMTA stats and tiebreakers', () => {
    const cfg = parseDsl(AMTA_DEMO_DSL);
    expect(cfg.statDefs.map(s => s.name)).toEqual([
      'Ballots', 'Combined Strength', 'Point Differential', 'Opponent Combined Strength',
    ]);
    expect(cfg.tiebreakers.rules).toHaveLength(4);
    expect(cfg.tiebreakers.rules.every(r => r.type === 'stat')).toBe(true);
  });
});

describe('react module — formatRank', () => {
  it('renders an integer rank as-is', () => {
    expect(formatRank(1, 0)).toBe('1');
    expect(formatRank(4, 3)).toBe('4');
  });

  it('renders a fractional (average-method) rank with one decimal', () => {
    expect(formatRank(1.5, 0)).toBe('1.5');
    expect(formatRank(2.5, 1)).toBe('2.5');
  });

  it('falls back to index + 1 when rank is undefined', () => {
    expect(formatRank(undefined, 0)).toBe('1');
    expect(formatRank(undefined, 6)).toBe('7');
  });
});
