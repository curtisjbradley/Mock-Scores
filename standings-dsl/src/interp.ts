// Standings interpreter.
//
// Given a parsed `StandingsConfig` (or a raw DSL string via `interp`) and the
// tournament's past results (`IStandingsTeam[]` — each team with its pairings
// and submitted ballots), this computes each team's stats and sorts them by the
// configured tiebreaker rules.
//
// This module is Blockly-free. `StatDef.expr` is a typed `Expr` AST (produced by
// `parseDsl`), which is evaluated recursively against a per-pairing context — no
// `eval` / `new Function`.

import type { IStandingsTeam, IStandingsPairing } from '@mock-scores/shared';
import type { StandingsConfig, StatDef, TiebreakerRule, RankMethod, Expr } from './types.js';
import { parseDsl } from './dsl.js';
import { assertNever } from './errors.js';

// Local aliases so the rest of the file reads naturally.
type ResultTeam = IStandingsTeam;
type Pairing = IStandingsPairing;

export interface TeamStats {
  code: string;
  name: string;
  /** 1-based rank assigned by the tiebreakers' final method (present after sorting). */
  rank?: number;
  [key: string]: number | string | undefined;
}

// Per-pairing context object the AST evaluator reads for (pairing ...) fields.
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
  num_scorers: number;     // scorers (submitted ballots) on this pairing
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
    num_ballots: nb,
    num_scorers: p.num_scorers,
  };
}

// ── Typed-AST evaluator (no eval / no new Function) ────────────────────────────
//
// Comparisons and logic evaluate to 1/0 to match the original DSL semantics.
// Because `parseDsl` has already validated every field and reference, lookups
// here are guaranteed to resolve; a missing key falls back to 0 defensively.

function num(x: unknown): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function evalExpr(
  e: Expr,
  p: PairingCtx,
  stats: Record<string, number>,
  opponent: Record<string, number>,
  intermediate: Record<string, number>,
): number {
  switch (e.kind) {
    case 'number':
      return e.value;
    case 'pairingField':
      return num((p as unknown as Record<string, number>)[e.field]);
    case 'teamField':
      return num(stats[e.field]);
    case 'statRef':
      return num(stats[e.name]);
    case 'intermediateRef':
      return num(intermediate[e.name]);
    case 'opponentRef':
      return num(opponent[e.name]);
    case 'arith': {
      const a = evalExpr(e.left, p, stats, opponent, intermediate);
      const b = evalExpr(e.right, p, stats, opponent, intermediate);
      switch (e.op) {
        case '+':  return a + b;
        case '-':  return a - b;
        case '*':  return a * b;
        case '/':  return b === 0 ? 0 : a / b;
        case '**': return a ** b;
        default:   return assertNever(e as never, 'arithmetic operator');
      }
    }
    case 'compare': {
      const a = evalExpr(e.left, p, stats, opponent, intermediate);
      const b = evalExpr(e.right, p, stats, opponent, intermediate);
      let r: boolean;
      switch (e.op) {
        case '=':  r = a === b; break;
        case '!=': r = a !== b; break;
        case '<':  r = a < b;   break;
        case '<=': r = a <= b;  break;
        case '>':  r = a > b;   break;
        case '>=': r = a >= b;  break;
        default:   return assertNever(e as never, 'comparison operator');
      }
      return r ? 1 : 0;
    }
    case 'logic': {
      const a = evalExpr(e.left, p, stats, opponent, intermediate);
      const b = evalExpr(e.right, p, stats, opponent, intermediate);
      const r = e.op === 'and' ? (a !== 0 && b !== 0) : (a !== 0 || b !== 0);
      return r ? 1 : 0;
    }
    case 'if': {
      const t = evalExpr(e.test, p, stats, opponent, intermediate);
      return t !== 0
        ? evalExpr(e.then, p, stats, opponent, intermediate)
        : evalExpr(e.else, p, stats, opponent, intermediate);
    }
    case 'call': {
      const x = evalExpr(e.arg, p, stats, opponent, intermediate);
      switch (e.fn) {
        case 'sqrt':  return Math.sqrt(x);
        case 'abs':   return Math.abs(x);
        case 'neg':   return -x;
        case 'ln':    return Math.log(x);
        case 'log10': return Math.log10(x);
        case 'exp':   return Math.exp(x);
        case 'pow10': return Math.pow(10, x);
        default:      return assertNever(e as never, 'math function');
      }
    }
    default:
      return assertNever(e, 'expression kind');
  }
}

function aggregate(values: number[], agg: StatDef['agg'], trim: number): number {
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
    default:      return assertNever(agg, 'aggregation');
  }
}

function computeTeamStats(
  team: ResultTeam,
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
    num_scorers:      ctxs.reduce((s, c) => s + c.num_scorers, 0),
    // Team-level primitive: how many pairings this team played.
    num_pairings:     team.pairings.length,
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

function h2hWinner(a: TeamStats, b: TeamStats, teams: ResultTeam[], statDefs: StatDef[], stat: string, order: 'asc' | 'desc'): number {
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

// ── Tiebreaker ordering ────────────────────────────────────────────────────────
//
// Rules are applied as *tie-group partitioning*: start with all rows in one
// group, then each rule refines the ordering within each still-tied group and
// splits it into finer groups wherever the rule produces a decision. This group
// model is what lets `when-tied` target groups of a particular size and lets the
// final `method` assign pandas-style rank numbers to the leftover ties.
//
// A rule's pairwise comparator returns <0 / 0 / >0. `h2hWinner` is used as-is.

type RuleComparator = (a: TeamStats, b: TeamStats) => number;

function statComparator(stat: string, order: 'asc' | 'desc'): RuleComparator {
  return (a, b) => {
    const av = (a[stat] as number) ?? 0;
    const bv = (b[stat] as number) ?? 0;
    if (av === bv) return 0;
    return order === 'desc' ? bv - av : av - bv;
  };
}

function alphaComparator(field: 'code' | 'name', order: 'asc' | 'desc'): RuleComparator {
  return (a, b) => {
    const av = String(a[field] ?? '');
    const bv = String(b[field] ?? '');
    const cmp = av.localeCompare(bv);
    if (cmp === 0) return 0;
    return order === 'desc' ? -cmp : cmp;
  };
}

/** Split an already-ordered group into runs of rows the comparator deems equal. */
function partitionByComparator(ordered: TeamStats[], cmp: RuleComparator): TeamStats[][] {
  const groups: TeamStats[][] = [];
  let current: TeamStats[] = [];
  for (let i = 0; i < ordered.length; i++) {
    if (i === 0) {
      current = [ordered[i]];
    } else if (cmp(ordered[i - 1], ordered[i]) === 0) {
      current.push(ordered[i]);
    } else {
      groups.push(current);
      current = [ordered[i]];
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

/**
 * Order a single tie-group through one rule, returning the (possibly finer)
 * list of tie-groups in final order.
 */
function applyRuleToGroup(
  group: TeamStats[],
  rule: TiebreakerRule,
  teams: ResultTeam[],
  statDefs: StatDef[],
): TeamStats[][] {
  if (rule.type === 'when_tied') {
    // Only recurse into this group if its size is within the configured range.
    if (group.length >= rule.min && group.length <= rule.max) {
      return applyRules(group, rule.rules, teams, statDefs);
    }
    return [group];
  }

  const cmp: RuleComparator =
    rule.type === 'h2h_conditional'
      ? (a, b) => h2hWinner(a, b, teams, statDefs, rule.stat, rule.order)
      : rule.type === 'alpha'
        ? alphaComparator(rule.field, rule.order)
        : statComparator(rule.stat, rule.order);

  const ordered = [...group].sort(cmp);
  return partitionByComparator(ordered, cmp);
}

/**
 * Apply an ordered list of rules to a group, refining its tie-groups rule by
 * rule. Returns the final ordered list of tie-groups (each inner array is a set
 * of rows that remain tied after every rule).
 */
function applyRules(
  group: TeamStats[],
  rules: TiebreakerRule[],
  teams: ResultTeam[],
  statDefs: StatDef[],
): TeamStats[][] {
  let groups: TeamStats[][] = [group];
  for (const rule of rules) {
    const next: TeamStats[][] = [];
    for (const g of groups) {
      if (g.length === 1) {
        next.push(g);
      } else {
        next.push(...applyRuleToGroup(g, rule, teams, statDefs));
      }
    }
    groups = next;
  }
  return groups;
}

/**
 * Assign pandas-style rank numbers to the ordered tie-groups and flatten to rows.
 * Each row gets a `rank` field per the chosen method.
 */
function assignRanks(groups: TeamStats[][], method: RankMethod): TeamStats[] {
  const out: TeamStats[] = [];
  let position = 1; // 1-based position of the first row in the current group
  let denseRank = 1; // for 'dense': increments by 1 per group regardless of size
  for (const g of groups) {
    const size = g.length;
    const min = position;
    const max = position + size - 1;
    for (let i = 0; i < size; i++) {
      let rank: number;
      switch (method) {
        case 'first':   rank = position + i; break;
        case 'min':     rank = min; break;
        case 'max':     rank = max; break;
        case 'average': rank = (min + max) / 2; break;
        case 'dense':   rank = denseRank; break;
        default:        return assertNever(method, 'rank method');
      }
      out.push({ ...g[i], rank });
    }
    position += size;
    denseRank += 1;
  }
  return out;
}

function sortByTiebreakers(
  rows: TeamStats[],
  tiebreakers: StandingsConfig['tiebreakers'],
  teams: ResultTeam[],
  statDefs: StatDef[],
): TeamStats[] {
  const groups = applyRules([...rows], tiebreakers.rules, teams, statDefs);
  return assignRanks(groups, tiebreakers.method);
}

/**
 * Compute standings from a parsed config and the tournament's past results.
 *
 * @param teams  Past results: each team with its pairings and submitted ballots.
 * @param config Parsed standings configuration.
 * @returns      Team rows sorted by the configured tiebreaker rules.
 */
export function computeStandings(teams: ResultTeam[], config: StandingsConfig): TeamStats[] {
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

/**
 * Interpret a standings DSL string against the tournament's past results.
 *
 * This is the primary entry point for the workspace: it parses the serialized
 * DSL (the DB source of truth) and computes the sorted standings in one call.
 *
 * @param dsl         The standings DSL string (an S-expression `(config ...)`).
 * @param pastResults Each team with its pairings and submitted ballots.
 * @returns           Team rows sorted by the configured tiebreaker rules.
 */
export function interp(dsl: string, pastResults: ResultTeam[]): TeamStats[] {
  const config = parseDsl(dsl);
  return computeStandings(pastResults, config);
}
