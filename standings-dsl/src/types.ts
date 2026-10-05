// Core standings/tiebreaker DSL types.
//
// These describe the *parsed* shape of the standings DSL (`StandingsConfig`),
// which is the single serialized source of truth stored in the DB. They are
// intentionally Blockly-free so the parse/compute paths carry no editor
// dependency. The frontend Blockly editor imports these types and converts
// to/from this shape.
//
// `StatDef.expr` is a fully typed `Expr` AST (not an opaque string). The parser
// produces it after validating every field reference, stat reference, operator
// arity, and enum token — so a parsed config is guaranteed interpretable.

// ── Builtin registries (the authoritative set of valid field references) ───────
//
// These mirror the evaluation context the interpreter builds (`pairingCtx` and
// the team-level builtins). The parser validates `(pairing X)` / `(ballot X)`
// against PAIRING_FIELDS and `(team X)` against TEAM_FIELDS.

/** Per-pairing fields available to `(pairing ...)` / `(ballot ...)`. */
export const PAIRING_FIELDS = [
  'ballots_won',
  'ballots_lost',
  'ballots_tied',
  'points_for',
  'points_against',
  'won_presider_tb',
  'ballot_pf',
  'ballot_pa',
  'ballot_pd',
  'ballot_raw',
  'num_ballots',
  'num_scorers',
] as const;
export type PairingField = (typeof PAIRING_FIELDS)[number];

/** Team-level builtin fields available to `(team ...)`. */
export const TEAM_FIELDS = [
  'ballots_won',
  'ballots_lost',
  'ballots_tied',
  'points_for',
  'points_against',
  'won_presider_tb',
  'ballot_pf',
  'ballot_pa',
  'ballot_pd',
  'ballot_raw',
  'num_scorers',
  'num_pairings',
] as const;
export type TeamField = (typeof TEAM_FIELDS)[number];

export const AGGS = ['sum', 'avg', 'max', 'min', 'count'] as const;
export type Agg = (typeof AGGS)[number];

export const ORDERS = ['asc', 'desc'] as const;
export type Order = (typeof ORDERS)[number];

/**
 * Final rank-assignment methods, modeled on pandas `DataFrame.rank(method=...)`.
 * They control how teams that remain tied after every tiebreaker rule are
 * assigned rank numbers:
 *   - `first`   — tied teams keep input order; ranks are strictly sequential (no shared ranks).
 *   - `min`     — every tied team gets the lowest rank in its group (gaps after).
 *   - `max`     — every tied team gets the highest rank in its group (gaps after).
 *   - `average` — every tied team gets the average of the group's ranks.
 *   - `dense`   — like `min`, but the next group's rank is only +1 (no gaps).
 */
export const RANK_METHODS = ['average', 'min', 'max', 'first', 'dense'] as const;
export type RankMethod = (typeof RANK_METHODS)[number];

/** Team identity fields usable for alphabetical ordering. */
export const ALPHA_FIELDS = ['code', 'name'] as const;
export type AlphaField = (typeof ALPHA_FIELDS)[number];

export const ARITH_OPS = ['+', '-', '*', '/', '**'] as const;
export type ArithOp = (typeof ARITH_OPS)[number];

export const COMPARE_OPS = ['=', '!=', '<', '<=', '>', '>='] as const;
export type CompareOp = (typeof COMPARE_OPS)[number];

export const LOGIC_OPS = ['and', 'or'] as const;
export type LogicOp = (typeof LOGIC_OPS)[number];

/** Unary math functions. */
export const MATH_FNS = ['sqrt', 'abs', 'neg', 'ln', 'log10', 'exp', 'pow10'] as const;
export type MathFn = (typeof MATH_FNS)[number];

// ── Typed expression AST ───────────────────────────────────────────────────────
//
// A discriminated union over `kind`. Every node is a plain JSON-serializable
// object (no functions, no class instances), so a `StandingsConfig` round-trips
// cleanly through `JSON.stringify` and `toEqual` in tests.

export interface NumberExpr { kind: 'number'; value: number; }
/** `(pairing FIELD)` / `(ballot FIELD)` — a per-pairing field read. */
export interface PairingFieldExpr { kind: 'pairingField'; field: PairingField; }
/** `(team FIELD)` — a team-level builtin field read. */
export interface TeamFieldExpr { kind: 'teamField'; field: TeamField; }
/** `(stat "Name")` — reference to a declared stat/trimmed/team-stat. */
export interface StatRefExpr { kind: 'statRef'; name: string; }
/** `(intermediate "Name")` — reference to a declared intermediate. */
export interface IntermediateRefExpr { kind: 'intermediateRef'; name: string; }
/** `(opponent "Name")` — reference to the opponent's value of a declared stat. */
export interface OpponentRefExpr { kind: 'opponentRef'; name: string; }
export interface ArithExpr { kind: 'arith'; op: ArithOp; left: Expr; right: Expr; }
export interface CompareExpr { kind: 'compare'; op: CompareOp; left: Expr; right: Expr; }
export interface LogicExpr { kind: 'logic'; op: LogicOp; left: Expr; right: Expr; }
export interface IfExpr { kind: 'if'; test: Expr; then: Expr; else: Expr; }
export interface CallExpr { kind: 'call'; fn: MathFn; arg: Expr; }

export type Expr =
  | NumberExpr
  | PairingFieldExpr
  | TeamFieldExpr
  | StatRefExpr
  | IntermediateRefExpr
  | OpponentRefExpr
  | ArithExpr
  | CompareExpr
  | LogicExpr
  | IfExpr
  | CallExpr;

// ── Config shape ────────────────────────────────────────────────────────────────

export interface StatDef {
  name: string;
  agg: Agg;
  /** Fully typed, validated expression AST. */
  expr: Expr;
  trim?: number;
  /** If true, expr is evaluated once at team level using the stats dict. */
  teamLevel?: boolean;
  /** If true, computed per-pairing and stored in the intermediate dict. */
  intermediate?: boolean;
}

export interface ColumnConfig {
  stat: string;
  label: string;
}

export type TiebreakerRule =
  | { type: 'stat'; stat: string; order: Order }
  | { type: 'h2h_conditional'; stat: string; order: Order }
  | { type: 'alpha'; field: AlphaField; order: Order }
  | { type: 'when_tied'; min: number; max: number; rules: TiebreakerRule[] };

/**
 * The tiebreaker configuration: an ordered list of rules plus the final
 * rank-assignment `method` (how teams still tied after all rules get ranked).
 */
export interface TiebreakerConfig {
  method: RankMethod;
  rules: TiebreakerRule[];
}

export interface StandingsConfig {
  statDefs: StatDef[];
  columns: ColumnConfig[];
  tiebreakers: TiebreakerConfig;
}
