// Lisp-like DSL for standings/tiebreaker configuration.
//
// The DSL is the single serialized source of truth (stored in the DB). It maps
// 1:1 to `StandingsConfig`. Blockly is only a visual editor (in the frontend)
// that round-trips DSL <-> blocks; the compute/display paths interpret the DSL
// directly with no Blockly dependency.
//
// `parseDsl` produces a fully typed, validated `StandingsConfig`: every field
// reference, stat/intermediate/opponent reference, operator arity, aggregation,
// order and trim value is checked here. If `parseDsl` returns without throwing,
// the config is guaranteed to be interpretable — the interpreter never has to
// guess or swallow errors.
//
// Grammar (whitespace-insensitive S-expressions):
//
//   (config
//     (stat        "Name" AGG EXPR)        ; regular per-pairing stat, aggregated by AGG
//     (team-stat   "Name" EXPR)            ; team-level stat (evaluated once against the stats dict)
//     (intermediate "Name" AGG EXPR)       ; per-pairing intermediate value
//     (trimmed     "Name" AGG TRIM EXPR)   ; trimmed-mean style stat (drops TRIM from each end)
//     (columns (column "Stat" "Label") ...)
//     (tiebreakers [METHOD]
//       (by "Stat" ORDER)                 ; order by a stat/intermediate value
//       (h2h "Stat" ORDER)                ; head-to-head on a stat (unchanged)
//       (alpha code|name ORDER)           ; alphabetical by team code or name
//       (when-tied MIN MAX RULE...)))     ; apply nested RULEs only to tie-groups
//                                         ; whose size is in [MIN, MAX]
//
//   AGG    := sum | avg | max | min | count
//   ORDER  := asc | desc
//   METHOD := average | min | max | first | dense   ; optional, defaults to `first`.
//             Final rank-number assignment for teams still tied after all rules
//             (mirrors pandas DataFrame.rank(method=...)).
//   TRIM   := <number>
//   MIN,MAX := <non-negative integer>  ; group-size range the when-tied block targets
//
// EXPR forms:
//   (pairing FIELD)  (ballot FIELD)  (team FIELD)   field access
//   (stat "Name")  (intermediate "Name")  (opponent "Name")   references
//   <number>
//   (+ a b) (- a b) (* a b) (/ a b) (** a b)
//   (= a b) (!= a b) (< a b) (<= a b) (> a b) (>= a b)
//   (and a b) (or a b)
//   (if test then else)
//   (sqrt x) (abs x) (neg x) (ln x) (log10 x) (exp x) (pow10 x)
//
// Stat names are written as "quoted" string literals so multi-word names work.
// Field identifiers and keywords are bare atoms.

import parseSexp, { type SNode } from 's-expression';
import {
  DslSyntaxError,
  DslStructureError,
  DslArityError,
  DslUnknownFormError,
  DslInvalidTokenError,
  DslReferenceError,
  DslDuplicateError,
  DslNumberError,
  assertNever,
} from './errors.js';
import {
  AGGS,
  ORDERS,
  RANK_METHODS,
  ALPHA_FIELDS,
  ARITH_OPS,
  COMPARE_OPS,
  LOGIC_OPS,
  MATH_FNS,
  PAIRING_FIELDS,
  TEAM_FIELDS,
  type Agg,
  type Order,
  type RankMethod,
  type AlphaField,
  type ArithOp,
  type CompareOp,
  type LogicOp,
  type MathFn,
  type PairingField,
  type TeamField,
  type Expr,
  type StandingsConfig,
  type StatDef,
  type ColumnConfig,
  type TiebreakerRule,
  type TiebreakerConfig,
} from './types.js';

const AGG_SET = new Set<string>(AGGS);
const ORDER_SET = new Set<string>(ORDERS);
const RANK_METHOD_SET = new Set<string>(RANK_METHODS);
const ALPHA_FIELD_SET = new Set<string>(ALPHA_FIELDS);
const ARITH_SET = new Set<string>(ARITH_OPS);
const COMPARE_SET = new Set<string>(COMPARE_OPS);
const LOGIC_SET = new Set<string>(LOGIC_OPS);
const MATH_FN_SET = new Set<string>(MATH_FNS);
const PAIRING_FIELD_SET = new Set<string>(PAIRING_FIELDS);
const TEAM_FIELD_SET = new Set<string>(TEAM_FIELDS);

// ── Reader helpers ────────────────────────────────────────────────────────────

function isList(n: SNode): n is SNode[] {
  return Array.isArray(n);
}

/** A quoted string literal ("...") parses to a `String` object, distinct from atoms. */
function isStringLiteral(n: SNode): n is String {
  return n instanceof String;
}

/** A bare atom (symbol) parses to a primitive string. */
function isAtom(n: SNode): n is string {
  return typeof n === 'string';
}

/** Value of a name token: accepts both quoted literals and bare atoms. */
function nameOf(n: SNode | undefined, what: string): string {
  if (n === undefined) throw new DslStructureError(`Expected ${what}`);
  if (isStringLiteral(n)) return n.toString();
  if (isAtom(n)) return n;
  throw new DslStructureError(`Expected ${what} to be a name, got a list`);
}

/** Keyword/atom value (must be a bare atom, not a quoted literal or list). */
function keyword(n: SNode | undefined, what: string): string {
  if (n !== undefined && isAtom(n)) return n;
  throw new DslStructureError(`Expected keyword for ${what}`);
}

function head(list: SNode[], what: string): string {
  const h = list[0];
  if (!isAtom(h)) throw new DslStructureError(`Expected ${what} to start with a keyword`);
  return h;
}

// ── Symbol table ────────────────────────────────────────────────────────────────
//
// Collected in a first pass so expressions can reference any declared stat
// (including forward references and opponent references) and reference checking
// can distinguish stat vs. intermediate names.

interface SymbolTable {
  /** Names of `stat` / `trimmed` / `team-stat` definitions. */
  stats: Set<string>;
  /** Names of `intermediate` definitions. */
  intermediates: Set<string>;
}

/** A name resolvable as a stat reference: a declared stat, or a team builtin. */
function resolvesAsStat(name: string, syms: SymbolTable): boolean {
  return syms.stats.has(name) || TEAM_FIELD_SET.has(name);
}

// ── EXPR parsing: S-expr node -> typed Expr AST (with validation) ──────────────

function expectArity(op: string, list: SNode[], operands: number): void {
  // list includes the head keyword, so operand count is list.length - 1.
  const got = list.length - 1;
  if (got !== operands) throw new DslArityError(op, operands, got);
}

function parseExpr(node: SNode, syms: SymbolTable): Expr {
  // Bare atom in expression position: only a numeric literal is valid.
  if (isAtom(node)) {
    if (node !== '' && !Number.isNaN(Number(node))) {
      return { kind: 'number', value: Number(node) };
    }
    throw new DslInvalidTokenError(
      `Unexpected symbol "${node}" in expression; did you mean (pairing ${node}) or (stat "${node}")?`,
    );
  }
  if (isStringLiteral(node)) {
    throw new DslStructureError(`Unexpected string literal "${node.toString()}" in expression`);
  }

  const list = node;
  if (list.length === 0) throw new DslStructureError('Empty expression ()');
  const op = head(list, 'expression');

  // Field access.
  if (op === 'pairing' || op === 'ballot') {
    expectArity(op, list, 1);
    const field = keyword(list[1], `${op} field`);
    if (!PAIRING_FIELD_SET.has(field)) {
      throw new DslReferenceError(
        `Unknown pairing field "${field}". Valid fields: ${PAIRING_FIELDS.join(', ')}`,
      );
    }
    return { kind: 'pairingField', field: field as PairingField };
  }
  if (op === 'team') {
    expectArity(op, list, 1);
    const field = keyword(list[1], 'team field');
    if (!TEAM_FIELD_SET.has(field)) {
      throw new DslReferenceError(
        `Unknown team field "${field}". Valid fields: ${TEAM_FIELDS.join(', ')}`,
      );
    }
    return { kind: 'teamField', field: field as TeamField };
  }

  // References.
  if (op === 'stat') {
    expectArity(op, list, 1);
    const name = nameOf(list[1], 'stat name');
    if (!resolvesAsStat(name, syms)) {
      throw new DslReferenceError(`Reference to undefined stat "${name}"`);
    }
    return { kind: 'statRef', name };
  }
  if (op === 'intermediate') {
    expectArity(op, list, 1);
    const name = nameOf(list[1], 'intermediate name');
    if (!syms.intermediates.has(name)) {
      throw new DslReferenceError(`Reference to undefined intermediate "${name}"`);
    }
    return { kind: 'intermediateRef', name };
  }
  if (op === 'opponent') {
    expectArity(op, list, 1);
    const name = nameOf(list[1], 'opponent stat name');
    if (!resolvesAsStat(name, syms)) {
      throw new DslReferenceError(`Reference to undefined opponent stat "${name}"`);
    }
    return { kind: 'opponentRef', name };
  }

  // Arithmetic (binary).
  if (ARITH_SET.has(op)) {
    expectArity(op, list, 2);
    return { kind: 'arith', op: op as ArithOp, left: parseExpr(list[1], syms), right: parseExpr(list[2], syms) };
  }
  // Comparison (binary).
  if (COMPARE_SET.has(op)) {
    expectArity(op, list, 2);
    return { kind: 'compare', op: op as CompareOp, left: parseExpr(list[1], syms), right: parseExpr(list[2], syms) };
  }
  // Logic (binary).
  if (LOGIC_SET.has(op)) {
    expectArity(op, list, 2);
    return { kind: 'logic', op: op as LogicOp, left: parseExpr(list[1], syms), right: parseExpr(list[2], syms) };
  }
  // Conditional (ternary).
  if (op === 'if') {
    expectArity(op, list, 3);
    return {
      kind: 'if',
      test: parseExpr(list[1], syms),
      then: parseExpr(list[2], syms),
      else: parseExpr(list[3], syms),
    };
  }
  // Unary math functions.
  if (MATH_FN_SET.has(op)) {
    expectArity(op, list, 1);
    return { kind: 'call', fn: op as MathFn, arg: parseExpr(list[1], syms) };
  }

  throw new DslUnknownFormError(`Unknown expression operator "${op}"`);
}

// ── Config parsing ──────────────────────────────────────────────────────────────

function parseAgg(n: SNode | undefined): Agg {
  const agg = keyword(n, 'aggregation');
  if (!AGG_SET.has(agg)) {
    throw new DslInvalidTokenError(`Invalid aggregation "${agg}". Valid: ${AGGS.join(', ')}`);
  }
  return agg as Agg;
}

function parseOrder(n: SNode | undefined): Order {
  const order = keyword(n, 'order');
  if (!ORDER_SET.has(order)) {
    throw new DslInvalidTokenError(`Invalid order "${order}". Valid: ${ORDERS.join(', ')}`);
  }
  return order as Order;
}

function parseRankMethod(n: SNode | undefined): RankMethod {
  const method = keyword(n, 'rank method');
  if (!RANK_METHOD_SET.has(method)) {
    throw new DslInvalidTokenError(`Invalid rank method "${method}". Valid: ${RANK_METHODS.join(', ')}`);
  }
  return method as RankMethod;
}

/** First pass: collect declared stat/intermediate names and detect duplicates. */
function collectSymbols(entries: SNode[]): SymbolTable {
  const stats = new Set<string>();
  const intermediates = new Set<string>();

  const declareStat = (name: string) => {
    if (stats.has(name) || intermediates.has(name)) {
      throw new DslDuplicateError(`Duplicate definition "${name}"`);
    }
    stats.add(name);
  };
  const declareIntermediate = (name: string) => {
    if (stats.has(name) || intermediates.has(name)) {
      throw new DslDuplicateError(`Duplicate definition "${name}"`);
    }
    intermediates.add(name);
  };

  for (const form of entries) {
    if (!isList(form)) continue; // structure errors are reported in the main pass
    const kind = isAtom(form[0]) ? form[0] : undefined;
    switch (kind) {
      case 'stat':
      case 'trimmed':
      case 'team-stat':
        declareStat(nameOf(form[1], `${kind} name`));
        break;
      case 'intermediate':
        declareIntermediate(nameOf(form[1], 'intermediate name'));
        break;
      default:
        break;
    }
  }
  return { stats, intermediates };
}

// ── Tiebreaker rule parsing ──────────────────────────────────────────────────────
//
// Rules nest: a `when-tied` block contains its own list of rules (which may
// themselves be `when-tied` blocks), so this is recursive. `h2h` is unchanged.

/** Parse a non-negative integer group-size bound for `when-tied`. */
function parseGroupBound(n: SNode | undefined, what: string): number {
  const raw = keyword(n, what);
  const v = Number(raw);
  if (!Number.isInteger(v) || v < 0) {
    throw new DslNumberError(`${what} must be a non-negative integer, got "${raw}"`);
  }
  return v;
}

function parseTiebreakerRule(tb: SNode, syms: SymbolTable): TiebreakerRule {
  if (!isList(tb)) throw new DslStructureError('tiebreakers entries must be lists');
  const tbKind = head(tb, 'tiebreaker');

  switch (tbKind) {
    case 'by':
    case 'h2h': {
      // (by "Stat" ORDER) / (h2h "Stat" ORDER)
      const stat = nameOf(tb[1], 'tiebreaker stat');
      if (!resolvesAsStat(stat, syms) && !syms.intermediates.has(stat)) {
        throw new DslReferenceError(`Tiebreaker references undefined stat "${stat}"`);
      }
      const order = parseOrder(tb[2]);
      return tbKind === 'by'
        ? { type: 'stat', stat, order }
        : { type: 'h2h_conditional', stat, order };
    }
    case 'alpha': {
      // (alpha code|name ORDER)
      const field = keyword(tb[1], 'alpha field');
      if (!ALPHA_FIELD_SET.has(field)) {
        throw new DslInvalidTokenError(`Invalid alpha field "${field}". Valid: ${ALPHA_FIELDS.join(', ')}`);
      }
      const order = parseOrder(tb[2]);
      return { type: 'alpha', field: field as AlphaField, order };
    }
    case 'when-tied': {
      // (when-tied MIN MAX RULE...)
      const min = parseGroupBound(tb[1], 'when-tied min');
      const max = parseGroupBound(tb[2], 'when-tied max');
      if (max < min) {
        throw new DslNumberError(`when-tied max (${max}) must be >= min (${min})`);
      }
      const rules = tb.slice(3).map(r => parseTiebreakerRule(r, syms));
      if (rules.length === 0) {
        throw new DslStructureError('when-tied block must contain at least one rule');
      }
      return { type: 'when_tied', min, max, rules };
    }
    default:
      throw new DslUnknownFormError(`Unknown tiebreaker "${tbKind}"`);
  }
}

export function parseDsl(text: string): StandingsConfig {
  if (!text || !text.trim()) {
    return { statDefs: [], columns: [], tiebreakers: { method: 'first', rules: [] } };
  }

  const parsed = parseSexp(text);
  if (parsed instanceof Error) throw new DslSyntaxError(`DSL parse error: ${parsed.message}`);
  if (!isList(parsed)) throw new DslStructureError('DSL must be a (config ...) form');
  if (head(parsed, 'config') !== 'config') throw new DslStructureError('DSL must start with (config ...)');

  const entries = parsed.slice(1);
  const syms = collectSymbols(entries);

  const statDefs: StatDef[] = [];
  const columns: ColumnConfig[] = [];
  const tiebreakerRules: TiebreakerRule[] = [];
  let tiebreakerMethod: RankMethod = 'first';

  for (const form of entries) {
    if (!isList(form)) throw new DslStructureError('Each config entry must be a list');
    const kind = head(form, 'config entry');
    switch (kind) {
      case 'stat': {
        // (stat "Name" AGG EXPR)
        expectArity('stat', form, 3);
        const name = nameOf(form[1], 'stat name');
        const agg = parseAgg(form[2]);
        statDefs.push({ name, agg, expr: parseExpr(form[3], syms) });
        break;
      }
      case 'team-stat': {
        // (team-stat "Name" EXPR)
        expectArity('team-stat', form, 2);
        const name = nameOf(form[1], 'team-stat name');
        statDefs.push({ name, agg: 'sum', expr: parseExpr(form[2], syms), teamLevel: true });
        break;
      }
      case 'intermediate': {
        // (intermediate "Name" AGG EXPR)
        expectArity('intermediate', form, 3);
        const name = nameOf(form[1], 'intermediate name');
        const agg = parseAgg(form[2]);
        statDefs.push({ name, agg, expr: parseExpr(form[3], syms), intermediate: true });
        break;
      }
      case 'trimmed': {
        // (trimmed "Name" AGG TRIM EXPR)
        expectArity('trimmed', form, 4);
        const name = nameOf(form[1], 'trimmed stat name');
        const agg = parseAgg(form[2]);
        const trimRaw = keyword(form[3], 'trim count');
        const trim = Number(trimRaw);
        if (!Number.isInteger(trim) || trim < 0) {
          throw new DslNumberError(`trim count must be a non-negative integer, got "${trimRaw}"`);
        }
        statDefs.push({ name, agg, expr: parseExpr(form[4], syms), trim });
        break;
      }
      case 'columns': {
        for (const col of form.slice(1)) {
          if (!isList(col) || head(col, 'column') !== 'column') {
            throw new DslStructureError('columns entries must be (column "Stat" "Label")');
          }
          const stat = nameOf(col[1], 'column stat');
          if (!resolvesAsStat(stat, syms) && !syms.intermediates.has(stat)) {
            throw new DslReferenceError(`Column references undefined stat "${stat}"`);
          }
          const label = col[2] !== undefined ? nameOf(col[2], 'column label') : stat;
          columns.push({ stat, label: label || stat });
        }
        break;
      }
      case 'tiebreakers': {
        // (tiebreakers [METHOD] RULE...) — METHOD is an optional leading bare atom.
        let rest = form.slice(1);
        if (rest.length > 0 && isAtom(rest[0])) {
          tiebreakerMethod = parseRankMethod(rest[0]);
          rest = rest.slice(1);
        }
        for (const tb of rest) {
          tiebreakerRules.push(parseTiebreakerRule(tb, syms));
        }
        break;
      }
      default:
        throw new DslUnknownFormError(`Unknown config entry "${kind}"`);
    }
  }

  return {
    statDefs,
    columns,
    tiebreakers: { method: tiebreakerMethod, rules: tiebreakerRules },
  };
}

// ── Serialization: StandingsConfig (typed AST) -> DSL text ─────────────────────

function quote(name: string): string {
  return `"${name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Serialize an Expr AST node back to its DSL S-expression text. */
export function serializeExpr(e: Expr): string {
  switch (e.kind) {
    case 'number':
      return String(e.value);
    case 'pairingField':
      return `(pairing ${e.field})`;
    case 'teamField':
      return `(team ${e.field})`;
    case 'statRef':
      return `(stat ${quote(e.name)})`;
    case 'intermediateRef':
      return `(intermediate ${quote(e.name)})`;
    case 'opponentRef':
      return `(opponent ${quote(e.name)})`;
    case 'arith':
      return `(${e.op} ${serializeExpr(e.left)} ${serializeExpr(e.right)})`;
    case 'compare':
      return `(${e.op} ${serializeExpr(e.left)} ${serializeExpr(e.right)})`;
    case 'logic':
      return `(${e.op} ${serializeExpr(e.left)} ${serializeExpr(e.right)})`;
    case 'if':
      return `(if ${serializeExpr(e.test)} ${serializeExpr(e.then)} ${serializeExpr(e.else)})`;
    case 'call':
      return `(${e.fn} ${serializeExpr(e.arg)})`;
    default:
      return assertNever(e, 'expression kind');
  }
}

function serializeStat(def: StatDef): string {
  const body = serializeExpr(def.expr);
  if (def.teamLevel) return `  (team-stat ${quote(def.name)} ${body})`;
  if (def.intermediate) return `  (intermediate ${quote(def.name)} ${def.agg} ${body})`;
  if (def.trim !== undefined) return `  (trimmed ${quote(def.name)} ${def.agg} ${def.trim} ${body})`;
  return `  (stat ${quote(def.name)} ${def.agg} ${body})`;
}

function serializeTiebreakerRule(t: TiebreakerRule): string {
  switch (t.type) {
    case 'stat':
      return `(by ${quote(t.stat)} ${t.order})`;
    case 'h2h_conditional':
      return `(h2h ${quote(t.stat)} ${t.order})`;
    case 'alpha':
      return `(alpha ${t.field} ${t.order})`;
    case 'when_tied':
      return `(when-tied ${t.min} ${t.max} ${t.rules.map(serializeTiebreakerRule).join(' ')})`;
    default:
      return assertNever(t, 'tiebreaker rule');
  }
}

export function serializeConfig(config: StandingsConfig): string {
  const lines: string[] = ['(config'];
  for (const def of config.statDefs) lines.push(serializeStat(def));
  if (config.columns.length) {
    const cols = config.columns.map(c => `(column ${quote(c.stat)} ${quote(c.label)})`).join(' ');
    lines.push(`  (columns ${cols})`);
  } else {
    lines.push('  (columns)');
  }
  const { method, rules } = config.tiebreakers;
  if (rules.length) {
    const tbs = rules.map(serializeTiebreakerRule).join(' ');
    lines.push(`  (tiebreakers ${method} ${tbs})`);
  } else {
    lines.push(`  (tiebreakers ${method})`);
  }
  return lines.join('\n') + ')';
}
