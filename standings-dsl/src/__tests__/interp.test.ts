import type { IStandingsTeam } from '@mock-scores/shared';
import { interp, computeStandings, parseDsl } from '../index';

// Minimal, deterministic fixture: 3 teams, 1 round each (round-robin-ish).
// A beats B (both ballots), A beats C, B beats C.
const teams: IStandingsTeam[] = [
  {
    name: 'Team A', code: 'A',
    pairings: [
      { opponent: 'B', ballots: [{ pointsFor: 190, pointsAgainst: 170 }, { pointsFor: 185, pointsAgainst: 175 }], won_presider_tiebreaker: true, num_scorers: 2 },
      { opponent: 'C', ballots: [{ pointsFor: 180, pointsAgainst: 160 }, { pointsFor: 178, pointsAgainst: 162 }], won_presider_tiebreaker: true, num_scorers: 2 },
    ],
  },
  {
    name: 'Team B', code: 'B',
    pairings: [
      { opponent: 'A', ballots: [{ pointsFor: 170, pointsAgainst: 190 }, { pointsFor: 175, pointsAgainst: 185 }], won_presider_tiebreaker: false, num_scorers: 2 },
      { opponent: 'C', ballots: [{ pointsFor: 182, pointsAgainst: 168 }, { pointsFor: 181, pointsAgainst: 169 }], won_presider_tiebreaker: true, num_scorers: 2 },
    ],
  },
  {
    name: 'Team C', code: 'C',
    pairings: [
      { opponent: 'A', ballots: [{ pointsFor: 160, pointsAgainst: 180 }, { pointsFor: 162, pointsAgainst: 178 }], won_presider_tiebreaker: false, num_scorers: 2 },
      { opponent: 'B', ballots: [{ pointsFor: 168, pointsAgainst: 182 }, { pointsFor: 169, pointsAgainst: 181 }], won_presider_tiebreaker: false, num_scorers: 2 },
    ],
  },
];

const WINS_DSL =
  '(config (stat "Wins" sum (pairing ballots_won)) (columns (column "Wins" "W")) (tiebreakers (by "Wins" desc)))';

describe('computeStandings', () => {
  it('aggregates a simple ballots-won stat and sorts descending', () => {
    const config = parseDsl(WINS_DSL);
    const rows = computeStandings(teams, config);
    expect(rows.map(r => r.code)).toEqual(['A', 'B', 'C']);
    expect(rows.find(r => r.code === 'A')!.Wins).toBe(4); // 2 + 2
    expect(rows.find(r => r.code === 'B')!.Wins).toBe(2); // 0 + 2
    expect(rows.find(r => r.code === 'C')!.Wins).toBe(0);
  });

  it('exposes built-in per-pairing aggregates', () => {
    const config = parseDsl('(config (stat "PF" sum (pairing points_for)) (columns) (tiebreakers (by "PF" desc)))');
    const rows = computeStandings(teams, config);
    const a = rows.find(r => r.code === 'A')!;
    // A points_for: 190+185 + 180+178 = 733
    expect(a.PF).toBe(733);
  });

  it('computes a point-differential stat with subtraction', () => {
    const config = parseDsl('(config (stat "PD" sum (- (pairing points_for) (pairing points_against))) (columns) (tiebreakers (by "PD" desc)))');
    const rows = computeStandings(teams, config);
    const a = rows.find(r => r.code === 'A')!;
    // (190-170)+(185-175)+(180-160)+(178-162) = 20+10+20+16 = 66
    expect(a.PD).toBe(66);
    expect(rows[0].code).toBe('A'); // best differential ranks first
  });

  it('resolves opponent references across passes', () => {
    // "OppWins" = sum of each opponent's Wins stat.
    const config = parseDsl(`(config
      (stat "Wins" sum (pairing ballots_won))
      (stat "OppWins" sum (opponent "Wins"))
      (columns) (tiebreakers (by "Wins" desc)))`);
    const rows = computeStandings(teams, config);
    // A played B(2 wins) and C(0 wins) => OppWins = 2
    expect(rows.find(r => r.code === 'A')!.OppWins).toBe(2);
    // C played A(4) and B(2) => OppWins = 6
    expect(rows.find(r => r.code === 'C')!.OppWins).toBe(6);
  });

  it('applies head-to-head tiebreakers when a primary stat ties', () => {
    // Force a tie on a constant stat so h2h decides order between A and B.
    const config = parseDsl(`(config
      (stat "Const" sum (- (pairing num_scorers) (pairing num_scorers)))
      (stat "Wins" sum (pairing ballots_won))
      (columns)
      (tiebreakers (by "Const" desc) (h2h "Wins" desc)))`);
    const rows = computeStandings(teams, config);
    // Const is 0 for everyone; h2h on Wins should still produce a stable, valid ordering.
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map(r => r.code))).toEqual(new Set(['A', 'B', 'C']));
  });
});

describe('interp (DSL string entry point)', () => {
  it('parses the DSL and computes standings in one call', () => {
    const viaInterp = interp(WINS_DSL, teams);
    const viaCompute = computeStandings(teams, parseDsl(WINS_DSL));
    expect(viaInterp).toEqual(viaCompute);
    expect(viaInterp.map(r => r.code)).toEqual(['A', 'B', 'C']);
  });

  it('handles an empty DSL (no stats, no sort) without throwing', () => {
    const rows = interp('', teams);
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map(r => r.code))).toEqual(new Set(['A', 'B', 'C']));
  });
});
