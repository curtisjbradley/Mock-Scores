import type { IStandingsTeam, IStandingsPairing } from '@mock-scores/shared';
// Local aliases so the rest of the file is unchanged
type DummyTeam = IStandingsTeam;
type Pairing = IStandingsPairing;
import type { StandingsConfig, StatDef, TiebreakerRule } from './standingsGenerator';

export interface TeamStats {
  code: string;
  name: string;
  [key: string]: number | string;
}

// Per-pairing context object passed into user expressions
interface PairingCtx {
  ballots_won: number;
  ballots_lost: number;
  ballots_tied: number;
  points_for: number;
  points_against: number;
  won_presider_tb: number; // 1 or 0
  ballot_pf: number;       // sum of ballot pf
  ballot_pa: number;       // sum of ballot pa
  ballot_pd: number;       // sum of (pf - pa) per ballot
  ballot_raw: number;      // sum of pf per ballot (same as ballot_pf, alias for clarity)
  num_ballots: number;
}

function pairingCtx(p: Pairing): PairingCtx {
  const bw = p.ballots.filter(b => b.pointsFor > b.pointsAgainst).length;
  const bl = p.ballots.filter(b => b.pointsFor < b.pointsAgainst).length;
  const bt = p.ballots.length - bw - bl;
  const pf = p.ballots.reduce((s, b) => s + b.pointsFor, 0);
  const pa = p.ballots.reduce((s, b) => s + b.pointsAgainst, 0);
  const pd = p.ballots.reduce((s, b) => s + (b.pointsFor - b.pointsAgainst), 0);
  const nb = p.ballots.length;

  return {
    ballots_won: bw, ballots_lost: bl, ballots_tied: bt,
    points_for: pf, points_against: pa,
    won_presider_tb: p.won_presider_tiebreaker ? 1 : 0,
    ballot_pf: pf, ballot_pa: pa,
    ballot_pd: pd, ballot_raw: pf,
    num_ballots: nb
  };
}

function evalExpr(expr: string, p: PairingCtx, stats: Record<string, number>, opponent: Record<string, number>, intermediate: Record<string, number>): number {
  try {
     
    return Number(new Function('p', 'stats', 'opponent', 'intermediate', `return ${expr}`)(p, stats, opponent, intermediate));
  } catch {
    return 0;
  }
}

function aggregate(values: number[], agg: StatDef['agg'], trim = 0): number {
  let v = [...values];
  if (trim > 0 && v.length > trim * 2) {
    v.sort((a, b) => a - b);
    v = v.slice(trim, v.length - trim);
  }
  if (!v.length) return 0;
  switch (agg) {
    case 'sum':   return v.reduce((a, b) => a + b, 0);
    case 'avg':   return v.reduce((a, b) => a + b, 0) / v.length;
    case 'max':   return Math.max(...v);
    case 'min':   return Math.min(...v);
    case 'count': return v.filter(x => x !== 0).length;
  }
}

function computeTeamStats(
  team: DummyTeam,
  statDefs: StatDef[],
  teamStatsByCode: Record<string, Record<string, number>>,
): TeamStats {
  const ctxs = team.pairings.map(pairingCtx);

  const builtins: Record<string, number> = {
    ballots_won:      ctxs.reduce((s, c) => s + c.ballots_won, 0),
    ballots_lost:     ctxs.reduce((s, c) => s + c.ballots_lost, 0),
    ballots_tied:     ctxs.reduce((s, c) => s + c.ballots_tied, 0),
    points_for:       ctxs.reduce((s, c) => s + c.points_for, 0),
    points_against:   ctxs.reduce((s, c) => s + c.points_against, 0),
    won_presider_tb:  ctxs.reduce((s, c) => s + c.won_presider_tb, 0),
    ballot_pf:        ctxs.reduce((s, c) => s + c.ballot_pf, 0),
    ballot_pa:        ctxs.reduce((s, c) => s + c.ballot_pa, 0),
    ballot_pd:        ctxs.reduce((s, c) => s + c.ballot_pd, 0),
    ballot_raw:       ctxs.reduce((s, c) => s + c.ballot_raw, 0),
  };

  const stats: Record<string, number> = { ...builtins };
  for (const def of statDefs) {
    if (def.teamLevel) {
      stats[def.name] = evalExpr(def.expr, ctxs[0] ?? {} as PairingCtx, stats, {}, {});
    } else if (def.intermediate) {
      // Computed per-pairing but stored in intermediate, not aggregated into stats yet
      // (aggregation happens when a stat_hat references this intermediate via intermediate_ref)
      // We skip here — intermediate values are computed inline during pairing evaluation below
    } else {
      const values = team.pairings.map((p, i) => {
        const opponent = teamStatsByCode[p.opponent] ?? {};
        // Build intermediate dict for this pairing (in topo order, so earlier intermediates are available)
        const intermediate: Record<string, number> = {};
        for (const iDef of statDefs.filter(d => d.intermediate)) {
          intermediate[iDef.name] = evalExpr(iDef.expr, ctxs[i], stats, opponent, intermediate);
        }
        return evalExpr(def.expr, ctxs[i], stats, opponent, intermediate);
      });
      stats[def.name] = aggregate(values, def.agg, def.trim ?? 0);
    }
  }

  return { code: team.code, name: team.name, ...stats };
}

function h2hWinner(a: TeamStats, b: TeamStats, teams: DummyTeam[], statDefs: StatDef[], stat: string, order: 'asc' | 'desc'): number {
  const teamA = teams.find(t => t.code === a.code);
  if (!teamA) return 0;
  const pairing = teamA.pairings.find(p => p.opponent === b.code);
  if (!pairing) return 0;
  const ctx = pairingCtx(pairing);
  // Compute intermediate dict for this pairing
  const intermediate: Record<string, number> = {};
  for (const iDef of statDefs.filter(d => d.intermediate)) {
    intermediate[iDef.name] = evalExpr(iDef.expr, ctx, a as unknown as Record<string, number>, b as unknown as Record<string, number>, intermediate);
  }
  const av = intermediate[stat] ?? (ctx as unknown as Record<string, number>)[stat] ?? 0;

  // Get B's perspective
  const teamB = teams.find(t => t.code === b.code);
  const pairingB = teamB?.pairings.find(p => p.opponent === a.code);
  const ctxB = pairingB ? pairingCtx(pairingB) : ctx;
  const intermediateB: Record<string, number> = {};
  for (const iDef of statDefs.filter(d => d.intermediate)) {
    intermediateB[iDef.name] = evalExpr(iDef.expr, ctxB, b as unknown as Record<string, number>, a as unknown as Record<string, number>, intermediateB);
  }
  const bv = intermediateB[stat] ?? (ctxB as unknown as Record<string, number>)[stat] ?? 0;

  if (av !== bv) return order === 'desc' ? bv - av : av - bv;
  return 0;
}

function sortByTiebreakers(rows: TeamStats[], rules: TiebreakerRule[], teams: DummyTeam[], statDefs: StatDef[]): TeamStats[] {
  return [...rows].sort((a, b) => {
    for (const rule of rules) {
      if (rule.type === 'h2h_conditional') {
        const r = h2hWinner(a, b, teams, statDefs, rule.stat, rule.order);
        if (r !== 0) return r;
      } else {
        const av = (a[rule.stat] as number) ?? 0;
        const bv = (b[rule.stat] as number) ?? 0;
        if (av !== bv) return rule.order === 'desc' ? bv - av : av - bv;
      }
    }
    return 0;
  });
}

export function computeStandings(teams: DummyTeam[], config: StandingsConfig): TeamStats[] {
  // Iterate passes until opponent-dependent stats converge.
  // Number of passes = number of stat defs (worst case: each stat depends on previous).
  const passes = Math.max(2, config.statDefs.length);
  let byCode: Record<string, Record<string, number>> = {};
  let rows: TeamStats[] = [];

  for (let i = 0; i < passes; i++) {
    rows = teams.map(t => computeTeamStats(t, config.statDefs, byCode));
    byCode = {};
    for (const r of rows) byCode[r.code] = r as unknown as Record<string, number>;
  }

  return sortByTiebreakers(rows, config.tiebreakers, teams, config.statDefs);
}
