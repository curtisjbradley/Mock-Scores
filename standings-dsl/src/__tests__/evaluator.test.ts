import type { IStandingsTeam } from '@mock-scores/shared';
import { interp, computeStandings, parseDsl, serializeExpr, DslInternalError, assertNever } from '../index';
import type { StandingsConfig, Expr } from '../index';

// A single team with two pairings against opponents O1 and O2. All built-in
// per-pairing fields are predictable from these ballots, so a `(stat ...)` that
// aggregates a given expression lets us assert the evaluator's output exactly.
//
// Pairing 1 vs O1: ballots [{200,100}, {150,160}]
//   ballots_won=1, ballots_lost=1, ballots_tied=0
//   points_for=350, points_against=260, ballot_pd=90, num_ballots=2, num_scorers=2
//   won_presider_tb=1
// Pairing 2 vs O2: ballots [{180,180}]
//   ballots_won=0, ballots_lost=0, ballots_tied=1
//   points_for=180, points_against=180, ballot_pd=0, num_ballots=1, num_scorers=1
//   won_presider_tb=0
function singleTeam(): IStandingsTeam[] {
  return [
    {
      name: 'Main', code: 'M',
      pairings: [
        { opponent: 'O1', ballots: [{ pointsFor: 200, pointsAgainst: 100 }, { pointsFor: 150, pointsAgainst: 160 }], won_presider_tiebreaker: true, num_scorers: 2 },
        { opponent: 'O2', ballots: [{ pointsFor: 180, pointsAgainst: 180 }], won_presider_tiebreaker: false, num_scorers: 1 },
      ],
    },
    // Opponents, so opponent references resolve.
    {
      name: 'Opp1', code: 'O1',
      pairings: [
        { opponent: 'M', ballots: [{ pointsFor: 100, pointsAgainst: 200 }, { pointsFor: 160, pointsAgainst: 150 }], won_presider_tiebreaker: false, num_scorers: 2 },
      ],
    },
    {
      name: 'Opp2', code: 'O2',
      pairings: [
        { opponent: 'M', ballots: [{ pointsFor: 180, pointsAgainst: 180 }], won_presider_tiebreaker: true, num_scorers: 1 },
      ],
    },
  ];
}

/** Evaluate a per-pairing expr via a `sum` stat and return team M's value. */
function evalSum(exprDsl: string): number {
  const rows = computeStandings(singleTeam(), parseDsl(`(config (stat "R" sum ${exprDsl}) (columns) (tiebreakers))`));
  return rows.find(r => r.code === 'M')!.R as number;
}

describe('AST evaluator — field reads', () => {
  it('reads pairing fields (summed across pairings)', () => {
    expect(evalSum('(pairing ballots_won)')).toBe(1);     // 1 + 0
    expect(evalSum('(pairing ballots_lost)')).toBe(1);    // 1 + 0
    expect(evalSum('(pairing ballots_tied)')).toBe(1);    // 0 + 1
    expect(evalSum('(pairing points_for)')).toBe(530);    // 350 + 180
    expect(evalSum('(pairing points_against)')).toBe(440);// 260 + 180
    expect(evalSum('(pairing ballot_pd)')).toBe(90);      // 90 + 0
    expect(evalSum('(pairing num_ballots)')).toBe(3);     // 2 + 1
    expect(evalSum('(pairing num_scorers)')).toBe(3);     // 2 + 1
    expect(evalSum('(pairing won_presider_tb)')).toBe(1); // 1 + 0
  });

  it('reads a numeric literal', () => {
    expect(evalSum('42')).toBe(84); // 42 summed over 2 pairings
  });
});

describe('AST evaluator — arithmetic', () => {
  it('covers + - * / **', () => {
    expect(evalSum('(+ 2 3)')).toBe(10);   // 5 * 2 pairings
    expect(evalSum('(- 10 4)')).toBe(12);  // 6 * 2
    expect(evalSum('(* 3 4)')).toBe(24);   // 12 * 2
    expect(evalSum('(/ 20 4)')).toBe(10);  // 5 * 2
    expect(evalSum('(** 2 3)')).toBe(16);  // 8 * 2
  });

  it('returns 0 for division by zero', () => {
    expect(evalSum('(/ 5 0)')).toBe(0);
  });
});

describe('AST evaluator — comparisons', () => {
  it('covers = != < <= > >= (each yields 1 per pairing when true)', () => {
    expect(evalSum('(= 1 1)')).toBe(2);
    expect(evalSum('(!= 1 2)')).toBe(2);
    expect(evalSum('(< 1 2)')).toBe(2);
    expect(evalSum('(<= 2 2)')).toBe(2);
    expect(evalSum('(> 3 2)')).toBe(2);
    expect(evalSum('(>= 2 2)')).toBe(2);
    // false case -> 0
    expect(evalSum('(= 1 2)')).toBe(0);
  });
});

describe('AST evaluator — logic', () => {
  it('covers and / or (true and false branches)', () => {
    expect(evalSum('(and (= 1 1) (= 2 2))')).toBe(2); // true
    expect(evalSum('(and (= 1 1) (= 2 3))')).toBe(0); // false
    expect(evalSum('(or (= 1 2) (= 2 2))')).toBe(2);  // true
    expect(evalSum('(or (= 1 2) (= 2 3))')).toBe(0);  // false
  });
});

describe('AST evaluator — if (both branches)', () => {
  it('takes the then branch when test is truthy', () => {
    expect(evalSum('(if (> 2 1) 5 9)')).toBe(10); // 5 * 2
  });
  it('takes the else branch when test is falsy', () => {
    expect(evalSum('(if (> 1 2) 5 9)')).toBe(18); // 9 * 2
  });
});

describe('AST evaluator — math functions', () => {
  it('covers sqrt abs neg ln log10 exp pow10', () => {
    expect(evalSum('(sqrt 9)')).toBe(6);            // 3 * 2
    expect(evalSum('(abs (neg 4))')).toBe(8);       // |−4|=4, * 2 (also covers neg)
    expect(evalSum('(neg 3)')).toBe(-6);            // −3 * 2
    expect(evalSum('(log10 100)')).toBe(4);         // 2 * 2
    expect(evalSum('(pow10 2)')).toBe(200);         // 100 * 2
    // ln(e) == 1 within float tolerance; exp(0) == 1
    expect(evalSum('(ln (exp 1))')).toBeCloseTo(2); // 1 * 2
  });
});

describe('AST evaluator — team / intermediate / opponent references', () => {
  it('evaluates a team-stat against the team-level stats dict', () => {
    const rows = computeStandings(
      singleTeam(),
      parseDsl('(config (team-stat "G" (team num_pairings)) (columns) (tiebreakers))'),
    );
    expect(rows.find(r => r.code === 'M')!.G).toBe(2);
  });

  it('aggregates an intermediate referenced by a stat', () => {
    const rows = computeStandings(
      singleTeam(),
      parseDsl(`(config
        (intermediate "PD" sum (- (pairing points_for) (pairing points_against)))
        (stat "SumPD" sum (intermediate "PD"))
        (columns) (tiebreakers))`),
    );
    // PD per pairing: (350-260)=90, (180-180)=0 -> summed as stat = 90
    expect(rows.find(r => r.code === 'M')!.SumPD).toBe(90);
  });

  it('coerces a non-finite intermediate value to 0 when referenced', () => {
    // (ln -1) is NaN; stored in the intermediate dict, then read via an
    // intermediateRef -> num() must coerce NaN to 0 (the finite-guard fallback).
    const rows = computeStandings(
      singleTeam(),
      parseDsl(`(config
        (intermediate "Bad" sum (ln (neg 1)))
        (stat "FromBad" sum (intermediate "Bad"))
        (columns) (tiebreakers))`),
    );
    expect(rows.find(r => r.code === 'M')!.FromBad).toBe(0);
  });

  it('resolves opponent references', () => {
    const rows = computeStandings(
      singleTeam(),
      parseDsl(`(config
        (stat "Wins" sum (pairing ballots_won))
        (stat "OppWins" sum (opponent "Wins"))
        (columns) (tiebreakers))`),
    );
    // O1 wins = 1 (160>150), O2 wins = 0 (tie) -> OppWins = 1
    expect(rows.find(r => r.code === 'M')!.OppWins).toBe(1);
  });
});

describe('aggregations', () => {
  const base = singleTeam();
  function agg(aggName: string, exprDsl: string): number {
    const rows = computeStandings(base, parseDsl(`(config (stat "R" ${aggName} ${exprDsl}) (columns) (tiebreakers))`));
    return rows.find(r => r.code === 'M')!.R as number;
  }

  it('covers sum avg max min count', () => {
    // points_for per pairing: 350, 180
    expect(agg('sum', '(pairing points_for)')).toBe(530);
    expect(agg('avg', '(pairing points_for)')).toBe(265);
    expect(agg('max', '(pairing points_for)')).toBe(350);
    expect(agg('min', '(pairing points_for)')).toBe(180);
    // count = number of non-zero values; ballots_tied per pairing: 0, 1 -> count 1
    expect(agg('count', '(pairing ballots_tied)')).toBe(1);
  });

  it('applies trimmed aggregation (drops from each end)', () => {
    // Build a team with 5 pairings of distinct points_for so trimming is observable.
    const teams: IStandingsTeam[] = [
      {
        name: 'T', code: 'T',
        pairings: [10, 20, 30, 40, 50].map((pf, i) => ({
          opponent: `X${i}`,
          ballots: [{ pointsFor: pf, pointsAgainst: 0 }],
          won_presider_tiebreaker: false,
          num_scorers: 1,
        })),
      },
    ];
    // trim 1 from each end of [10,20,30,40,50] -> [20,30,40], avg = 30
    const rows = computeStandings(teams, parseDsl('(config (trimmed "R" avg 1 (pairing points_for)) (columns) (tiebreakers))'));
    expect(rows.find(r => r.code === 'T')!.R).toBe(30);
  });
});

describe('references across stats', () => {
  it('evaluates a statRef to another declared stat', () => {
    const teams: IStandingsTeam[] = [
      { name: 'M', code: 'M', pairings: [{ opponent: 'O', ballots: [{ pointsFor: 200, pointsAgainst: 100 }], won_presider_tiebreaker: true, num_scorers: 1 }] },
      { name: 'O', code: 'O', pairings: [{ opponent: 'M', ballots: [{ pointsFor: 100, pointsAgainst: 200 }], won_presider_tiebreaker: false, num_scorers: 1 }] },
    ];
    const rows = computeStandings(teams, parseDsl(`(config
      (stat "Base" sum (pairing points_for))
      (stat "Double" sum (* (stat "Base") 2))
      (columns) (tiebreakers (by "Double" desc)))`));
    expect(rows.find(r => r.code === 'M')!.Double).toBe(400);
  });

  it('reads an opponent stat as 0 when the opponent is absent from the results', () => {
    const teams: IStandingsTeam[] = [
      { name: 'M', code: 'M', pairings: [{ opponent: 'Ghost', ballots: [{ pointsFor: 200, pointsAgainst: 100 }], won_presider_tiebreaker: true, num_scorers: 1 }] },
    ];
    const rows = computeStandings(teams, parseDsl(`(config
      (stat "W" sum (pairing ballots_won))
      (stat "OppW" sum (opponent "W"))
      (columns) (tiebreakers (by "OppW" desc)))`));
    expect(rows.find(r => r.code === 'M')!.OppW).toBe(0);
  });
});

describe('tiebreakers', () => {
  const twoTeams: IStandingsTeam[] = [
    { name: 'Low', code: 'L', pairings: [{ opponent: 'H', ballots: [{ pointsFor: 100, pointsAgainst: 200 }], won_presider_tiebreaker: false, num_scorers: 1 }] },
    { name: 'High', code: 'H', pairings: [{ opponent: 'L', ballots: [{ pointsFor: 200, pointsAgainst: 100 }], won_presider_tiebreaker: true, num_scorers: 1 }] },
  ];

  it('sorts descending by a stat', () => {
    const rows = computeStandings(twoTeams, parseDsl('(config (stat "PF" sum (pairing points_for)) (columns) (tiebreakers (by "PF" desc)))'));
    expect(rows.map(r => r.code)).toEqual(['H', 'L']);
  });

  it('sorts ascending by a stat', () => {
    const rows = computeStandings(twoTeams, parseDsl('(config (stat "PF" sum (pairing points_for)) (columns) (tiebreakers (by "PF" asc)))'));
    expect(rows.map(r => r.code)).toEqual(['L', 'H']);
  });

  it('falls back to 0 for a tiebreaker that references an intermediate (not on the row)', () => {
    const teams: IStandingsTeam[] = [
      { name: 'A', code: 'A', pairings: [{ opponent: 'B', ballots: [{ pointsFor: 200, pointsAgainst: 100 }], won_presider_tiebreaker: true, num_scorers: 1 }] },
      { name: 'B', code: 'B', pairings: [{ opponent: 'A', ballots: [{ pointsFor: 100, pointsAgainst: 200 }], won_presider_tiebreaker: false, num_scorers: 1 }] },
    ];
    const rows = computeStandings(teams, parseDsl(`(config
      (intermediate "PD" sum (- (pairing points_for) (pairing points_against)))
      (stat "W" sum (pairing ballots_won))
      (columns)
      (tiebreakers (by "PD" desc) (by "W" desc)))`));
    // "PD" is an intermediate, absent from the row -> reads 0 (tie) -> W decides.
    expect(rows.map(r => r.code)).toEqual(['A', 'B']);
  });
});

describe('head-to-head tiebreakers', () => {
  const played: IStandingsTeam[] = [
    { name: 'A', code: 'A', pairings: [{ opponent: 'B', ballots: [{ pointsFor: 200, pointsAgainst: 150 }], won_presider_tiebreaker: true, num_scorers: 1 }] },
    { name: 'B', code: 'B', pairings: [{ opponent: 'A', ballots: [{ pointsFor: 150, pointsAgainst: 200 }], won_presider_tiebreaker: false, num_scorers: 1 }] },
  ];

  it('resolves order from the head-to-head game (asc and desc)', () => {
    const desc = computeStandings(played, parseDsl('(config (stat "W" sum (pairing ballots_won)) (columns) (tiebreakers (h2h "W" desc)))'));
    expect(new Set(desc.map(r => r.code))).toEqual(new Set(['A', 'B']));
    const asc = computeStandings(played, parseDsl('(config (stat "W" sum (pairing ballots_won)) (columns) (tiebreakers (h2h "W" asc)))'));
    expect(new Set(asc.map(r => r.code))).toEqual(new Set(['A', 'B']));
  });

  it('reads the h2h value from an intermediate computed in that game', () => {
    const rows = computeStandings(played, parseDsl(`(config
      (intermediate "MarginI" sum (- (pairing points_for) (pairing points_against)))
      (stat "Margin" sum (intermediate "MarginI"))
      (stat "Zero" sum (- (pairing num_scorers) (pairing num_scorers)))
      (columns)
      (tiebreakers (by "Zero" desc) (h2h "MarginI" desc)))`));
    // Zero ties; h2h margin: A +50 vs B -50 -> A first.
    expect(rows.map(r => r.code)).toEqual(['A', 'B']);
    expect(rows.find(r => r.code === 'A')!.Margin).toBe(50);
    expect(rows.find(r => r.code === 'B')!.Margin).toBe(-50);
  });

  it('reads the h2h value from a builtin pairing field', () => {
    const teams: IStandingsTeam[] = [
      { name: 'A', code: 'A', pairings: [{ opponent: 'B', ballots: [{ pointsFor: 200, pointsAgainst: 100 }, { pointsFor: 190, pointsAgainst: 110 }], won_presider_tiebreaker: true, num_scorers: 2 }] },
      { name: 'B', code: 'B', pairings: [{ opponent: 'A', ballots: [{ pointsFor: 100, pointsAgainst: 200 }, { pointsFor: 110, pointsAgainst: 190 }], won_presider_tiebreaker: false, num_scorers: 2 }] },
    ];
    const rows = computeStandings(teams, parseDsl(`(config
      (stat "Tie" sum (- (pairing num_scorers) (pairing num_scorers)))
      (columns)
      (tiebreakers (by "Tie" desc) (h2h "ballots_won" desc)))`));
    expect(rows.map(r => r.code)).toEqual(['A', 'B']);
  });

  it('returns no signal when the head-to-head values are equal', () => {
    const drawn: IStandingsTeam[] = [
      { name: 'A', code: 'A', pairings: [{ opponent: 'B', ballots: [{ pointsFor: 180, pointsAgainst: 180 }], won_presider_tiebreaker: false, num_scorers: 1 }] },
      { name: 'B', code: 'B', pairings: [{ opponent: 'A', ballots: [{ pointsFor: 180, pointsAgainst: 180 }], won_presider_tiebreaker: false, num_scorers: 1 }] },
    ];
    const rows = computeStandings(drawn, parseDsl(`(config
      (stat "Tie" sum (- (pairing num_scorers) (pairing num_scorers)))
      (columns)
      (tiebreakers (by "Tie" desc) (h2h "ballots_won" desc)))`));
    expect(new Set(rows.map(r => r.code))).toEqual(new Set(['A', 'B']));
  });

  it('returns no signal when the two teams never played each other', () => {
    const noGame: IStandingsTeam[] = [
      { name: 'A', code: 'A', pairings: [{ opponent: 'X', ballots: [{ pointsFor: 200, pointsAgainst: 100 }], won_presider_tiebreaker: true, num_scorers: 1 }] },
      { name: 'B', code: 'B', pairings: [{ opponent: 'X', ballots: [{ pointsFor: 150, pointsAgainst: 100 }], won_presider_tiebreaker: true, num_scorers: 1 }] },
      { name: 'X', code: 'X', pairings: [
        { opponent: 'A', ballots: [{ pointsFor: 100, pointsAgainst: 200 }], won_presider_tiebreaker: false, num_scorers: 1 },
        { opponent: 'B', ballots: [{ pointsFor: 100, pointsAgainst: 150 }], won_presider_tiebreaker: false, num_scorers: 1 },
      ] },
    ];
    const rows = computeStandings(noGame, parseDsl(`(config
      (stat "W" sum (pairing ballots_won))
      (stat "PF" sum (pairing points_for))
      (columns)
      (tiebreakers (h2h "W" desc) (by "PF" desc)))`));
    // No A-B game -> h2h can't decide -> PF decides (A 200 > B 150).
    expect(rows.findIndex(r => r.code === 'A')).toBeLessThan(rows.findIndex(r => r.code === 'B'));
  });

  it('tolerates an asymmetric pairing (opponent has no return game)', () => {
    const asym: IStandingsTeam[] = [
      { name: 'A', code: 'A', pairings: [{ opponent: 'B', ballots: [{ pointsFor: 200, pointsAgainst: 100 }], won_presider_tiebreaker: true, num_scorers: 1 }] },
      { name: 'B', code: 'B', pairings: [{ opponent: 'Z', ballots: [{ pointsFor: 150, pointsAgainst: 120 }], won_presider_tiebreaker: true, num_scorers: 1 }] },
    ];
    const rows = computeStandings(asym, parseDsl(`(config
      (stat "Tie" sum (- (pairing num_scorers) (pairing num_scorers)))
      (stat "W" sum (pairing ballots_won))
      (columns)
      (tiebreakers (by "Tie" desc) (h2h "W" desc)))`));
    expect(new Set(rows.map(r => r.code))).toEqual(new Set(['A', 'B']));
  });
});

describe('interp entry point', () => {
  it('aggregates a stat to 0 for a team with no pairings', () => {
    const teams: IStandingsTeam[] = [{ name: 'Empty', code: 'E', pairings: [] }];
    const rows = interp('(config (stat "PF" sum (pairing points_for)) (columns) (tiebreakers))', teams);
    expect(rows.find(r => r.code === 'E')!.PF).toBe(0);
  });

  it('evaluates a team-stat to 0 for a team with no pairings', () => {
    const teams: IStandingsTeam[] = [{ name: 'Empty', code: 'E', pairings: [] }];
    const rows = interp('(config (team-stat "G" (team num_pairings)) (columns) (tiebreakers))', teams);
    expect(rows.find(r => r.code === 'E')!.G).toBe(0);
  });
});

describe('alphabetical tiebreaker', () => {
  // Three teams fully tied on every stat (identical single pairing vs a shared
  // filler) so only the alpha rule decides the order.
  function tiedTeams(): IStandingsTeam[] {
    const mk = (code: string, name: string): IStandingsTeam => ({
      name, code,
      pairings: [{ opponent: 'Z', ballots: [{ pointsFor: 100, pointsAgainst: 100 }], won_presider_tiebreaker: false, num_scorers: 1 }],
    });
    // Insert in a non-alphabetical order to prove the rule (not input order) sorts them.
    return [mk('C', 'Charlie'), mk('A', 'Alpha'), mk('B', 'Bravo')];
  }

  it('orders by team code ascending', () => {
    const rows = computeStandings(tiedTeams(), parseDsl('(config (stat "W" sum (pairing ballots_won)) (columns) (tiebreakers (alpha code asc)))'));
    expect(rows.map(r => r.code)).toEqual(['A', 'B', 'C']);
  });

  it('orders by team code descending', () => {
    const rows = computeStandings(tiedTeams(), parseDsl('(config (stat "W" sum (pairing ballots_won)) (columns) (tiebreakers (alpha code desc)))'));
    expect(rows.map(r => r.code)).toEqual(['C', 'B', 'A']);
  });

  it('orders by team name ascending', () => {
    const rows = computeStandings(tiedTeams(), parseDsl('(config (stat "W" sum (pairing ballots_won)) (columns) (tiebreakers (alpha name asc)))'));
    expect(rows.map(r => r.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('acts only as a final tiebreaker after a primary stat rule', () => {
    const teams: IStandingsTeam[] = [
      { name: 'Zeta', code: 'Z', pairings: [{ opponent: 'F', ballots: [{ pointsFor: 200, pointsAgainst: 100 }], won_presider_tiebreaker: true, num_scorers: 1 }] },
      { name: 'Alpha', code: 'A', pairings: [{ opponent: 'F', ballots: [{ pointsFor: 100, pointsAgainst: 100 }], won_presider_tiebreaker: false, num_scorers: 1 }] },
      { name: 'Beta', code: 'B', pairings: [{ opponent: 'F', ballots: [{ pointsFor: 100, pointsAgainst: 100 }], won_presider_tiebreaker: false, num_scorers: 1 }] },
    ];
    // Z leads on wins; A and B tie on wins, broken alphabetically by code.
    const rows = computeStandings(teams, parseDsl('(config (stat "W" sum (pairing ballots_won)) (columns) (tiebreakers (by "W" desc) (alpha code asc)))'));
    expect(rows.map(r => r.code)).toEqual(['Z', 'A', 'B']);
  });
});

describe('when-tied group-size targeting', () => {
  // Four teams. On the primary stat "W": A,B,C all tie at 1 win (a 3-way tie),
  // D stands alone at 0. A secondary stat "PF" distinguishes A/B/C.
  function teams(): IStandingsTeam[] {
    return [
      { name: 'A', code: 'A', pairings: [{ opponent: 'F', ballots: [{ pointsFor: 300, pointsAgainst: 100 }], won_presider_tiebreaker: true, num_scorers: 1 }] },
      { name: 'B', code: 'B', pairings: [{ opponent: 'F', ballots: [{ pointsFor: 200, pointsAgainst: 100 }], won_presider_tiebreaker: true, num_scorers: 1 }] },
      { name: 'C', code: 'C', pairings: [{ opponent: 'F', ballots: [{ pointsFor: 150, pointsAgainst: 100 }], won_presider_tiebreaker: true, num_scorers: 1 }] },
      { name: 'D', code: 'D', pairings: [{ opponent: 'F', ballots: [{ pointsFor: 100, pointsAgainst: 300 }], won_presider_tiebreaker: false, num_scorers: 1 }] },
    ];
  }

  it('applies nested rules when the tie-group size is within [min,max]', () => {
    // 3-way tie on W among A,B,C -> when-tied 3 999 fires -> order by PF desc.
    const rows = computeStandings(teams(), parseDsl(`(config
      (stat "W" sum (pairing ballots_won))
      (stat "PF" sum (pairing points_for))
      (columns)
      (tiebreakers (by "W" desc) (when-tied 3 999 (by "PF" desc))))`));
    expect(rows.map(r => r.code)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('does NOT apply nested rules when the group size is outside the range', () => {
    // Only fire for exactly 2-way ties. The A,B,C tie is 3-way, so when-tied is
    // skipped and they keep input order (method defaults to first => stable).
    const rows = computeStandings(teams(), parseDsl(`(config
      (stat "W" sum (pairing ballots_won))
      (stat "PF" sum (pairing points_for))
      (columns)
      (tiebreakers (by "W" desc) (when-tied 2 2 (by "PF" desc))))`));
    // A,B,C retain their input order (stable) because the block didn't fire.
    expect(rows.map(r => r.code)).toEqual(['A', 'B', 'C', 'D']);
    // Prove it was order-preserving, not PF-sorted, by reversing input: still input order.
    const reversed = teams().reverse();
    const rows2 = computeStandings(reversed, parseDsl(`(config
      (stat "W" sum (pairing ballots_won))
      (stat "PF" sum (pairing points_for))
      (columns)
      (tiebreakers (by "W" desc) (when-tied 2 2 (by "PF" desc))))`));
    // Input was D,C,B,A; D is alone last. C,B,A tie on W and keep their (reversed) input order.
    expect(rows2.map(r => r.code)).toEqual(['C', 'B', 'A', 'D']);
  });

  it('fires a 2-way-only block on a genuine 2-way tie', () => {
    const two: IStandingsTeam[] = [
      { name: 'A', code: 'A', pairings: [{ opponent: 'F', ballots: [{ pointsFor: 150, pointsAgainst: 100 }], won_presider_tiebreaker: true, num_scorers: 1 }] },
      { name: 'B', code: 'B', pairings: [{ opponent: 'F', ballots: [{ pointsFor: 300, pointsAgainst: 100 }], won_presider_tiebreaker: true, num_scorers: 1 }] },
    ];
    // Both win 1 (2-way tie). when-tied 2 2 fires -> PF desc -> B above A.
    const rows = computeStandings(two, parseDsl(`(config
      (stat "W" sum (pairing ballots_won))
      (stat "PF" sum (pairing points_for))
      (columns)
      (tiebreakers (by "W" desc) (when-tied 2 2 (by "PF" desc))))`));
    expect(rows.map(r => r.code)).toEqual(['B', 'A']);
  });
});

describe('final rank method (pandas-style)', () => {
  // Group pattern after sorting by W desc: A alone (1 win), then B,C,D tied
  // (0 wins). Positions are 1, then 2/3/4 for the tied trio.
  function teams(): IStandingsTeam[] {
    return [
      { name: 'A', code: 'A', pairings: [{ opponent: 'F', ballots: [{ pointsFor: 200, pointsAgainst: 100 }], won_presider_tiebreaker: true, num_scorers: 1 }] },
      { name: 'B', code: 'B', pairings: [{ opponent: 'F', ballots: [{ pointsFor: 100, pointsAgainst: 100 }], won_presider_tiebreaker: false, num_scorers: 1 }] },
      { name: 'C', code: 'C', pairings: [{ opponent: 'F', ballots: [{ pointsFor: 100, pointsAgainst: 100 }], won_presider_tiebreaker: false, num_scorers: 1 }] },
      { name: 'D', code: 'D', pairings: [{ opponent: 'F', ballots: [{ pointsFor: 100, pointsAgainst: 100 }], won_presider_tiebreaker: false, num_scorers: 1 }] },
    ];
  }
  const dsl = (m: string) => `(config (stat "W" sum (pairing ballots_won)) (columns) (tiebreakers ${m} (by "W" desc)))`;

  it('first: strictly sequential ranks, no shared ranks', () => {
    const rows = computeStandings(teams(), parseDsl(dsl('first')));
    expect(rows.map(r => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it('min: every tied team gets the lowest rank in its group', () => {
    const rows = computeStandings(teams(), parseDsl(dsl('min')));
    expect(rows.map(r => r.rank)).toEqual([1, 2, 2, 2]);
  });

  it('max: every tied team gets the highest rank in its group', () => {
    const rows = computeStandings(teams(), parseDsl(dsl('max')));
    expect(rows.map(r => r.rank)).toEqual([1, 4, 4, 4]);
  });

  it('average: tied teams get the average of the group ranks', () => {
    const rows = computeStandings(teams(), parseDsl(dsl('average')));
    expect(rows.map(r => r.rank)).toEqual([1, 3, 3, 3]); // (2+3+4)/3 = 3
  });

  it('dense: tied group shares a rank and the next group is +1 (no gaps)', () => {
    const rows = computeStandings(teams(), parseDsl(dsl('dense')));
    expect(rows.map(r => r.rank)).toEqual([1, 2, 2, 2]);
  });

  it('defaults to first when no method is given', () => {
    const rows = computeStandings(teams(), parseDsl('(config (stat "W" sum (pairing ballots_won)) (columns) (tiebreakers (by "W" desc)))'));
    expect(rows.map(r => r.rank)).toEqual([1, 2, 3, 4]);
  });
});

describe('exhaustiveness guards (assertNever)', () => {
  // These construct intentionally-invalid structures via `as` casts to bypass
  // the type system, proving the runtime guards throw DslInternalError rather
  // than silently returning 0. In normal operation parseDsl prevents all of these.

  function configWithExpr(expr: Expr): StandingsConfig {
    return { statDefs: [{ name: 'R', agg: 'sum', expr }], columns: [], tiebreakers: { method: 'first', rules: [] } };
  }

  const oneTeam: IStandingsTeam[] = [
    { name: 'M', code: 'M', pairings: [{ opponent: 'O', ballots: [{ pointsFor: 10, pointsAgainst: 5 }], won_presider_tiebreaker: false, num_scorers: 1 }] },
  ];

  it('throws on an unknown expression kind', () => {
    const bad = configWithExpr({ kind: 'bogus' } as unknown as Expr);
    expect(() => computeStandings(oneTeam, bad)).toThrow(DslInternalError);
  });

  it('throws on an unknown arithmetic operator', () => {
    const bad = configWithExpr({ kind: 'arith', op: '%', left: { kind: 'number', value: 1 }, right: { kind: 'number', value: 2 } } as unknown as Expr);
    expect(() => computeStandings(oneTeam, bad)).toThrow(DslInternalError);
  });

  it('throws on an unknown comparison operator', () => {
    const bad = configWithExpr({ kind: 'compare', op: '~', left: { kind: 'number', value: 1 }, right: { kind: 'number', value: 2 } } as unknown as Expr);
    expect(() => computeStandings(oneTeam, bad)).toThrow(DslInternalError);
  });

  it('throws on an unknown math function', () => {
    const bad = configWithExpr({ kind: 'call', fn: 'tan', arg: { kind: 'number', value: 1 } } as unknown as Expr);
    expect(() => computeStandings(oneTeam, bad)).toThrow(DslInternalError);
  });

  it('throws on an unknown aggregation', () => {
    const bad: StandingsConfig = { statDefs: [{ name: 'R', agg: 'median' as unknown as 'sum', expr: { kind: 'pairingField', field: 'points_for' } }], columns: [], tiebreakers: { method: 'first', rules: [] } };
    expect(() => computeStandings(oneTeam, bad)).toThrow(DslInternalError);
  });

  it('serializeExpr throws on an unknown expression kind', () => {
    expect(() => serializeExpr({ kind: 'bogus' } as unknown as Expr)).toThrow(DslInternalError);
  });

  it('assertNever throws directly with the provided context', () => {
    expect(() => assertNever('x' as never, 'thing')).toThrow(DslInternalError);
    expect(() => assertNever('x' as never, 'thing')).toThrow(/thing/);
  });

  it('assertNever uses the default context when none is provided', () => {
    // Covers the `context = 'value'` default-parameter branch.
    expect(() => assertNever('x' as never)).toThrow(/value/);
  });
});
