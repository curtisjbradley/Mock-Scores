// Lisp-like DSL for standings/tiebreaker configuration.
//
// The DSL is the single serialized source of truth (stored in the DB). It maps
// 1:1 to `StandingsConfig`. Blockly is only a visual editor that round-trips
// DSL <-> blocks; the compute/display paths interpret the DSL directly with no
// Blockly dependency.
//
// Grammar (whitespace-insensitive S-expressions):
//
//   (config
//     (stat        "Name" AGG EXPR)        ; regular per-pairing stat, aggregated by AGG
//     (team-stat   "Name" EXPR)            ; team-level stat (evaluated once against stats[])
//     (intermediate "Name" AGG EXPR)       ; per-pairing intermediate value
//     (trimmed     "Name" AGG TRIM EXPR)   ; trimmed-mean style stat (drops TRIM from each end)
//     (columns (column "Stat" "Label") ...)
//     (tiebreakers (by "Stat" ORDER) (h2h "Stat" ORDER) ...))
//
//   AGG   := sum | avg | max | min | count
//   ORDER := asc | desc
//   TRIM  := <number>
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
import type { StandingsConfig, StatDef, ColumnConfig, TiebreakerRule } from './standingsGenerator';

export class DslError extends Error {}

const AGGS = new Set(['sum', 'avg', 'max', 'min', 'count']);
const ORDERS = new Set(['asc', 'desc']);

// ── Reader helpers ────────────────────────────────────────────────────────────

function isList(n: SNode): n is SNode[] {
  return Array.isArray(n);
}

/** A quoted string literal ("...") parses to a `String` object, distinct from atoms. */
function isStringLiteral(n: SNode): n is string {
  return n instanceof String;
}

/** A bare atom (symbol) parses to a primitive string. */
function isAtom(n: SNode): n is string {
  return typeof n === 'string';
}

/** Value of a name token: accepts both quoted literals and bare atoms. */
function nameOf(n: SNode | undefined, what: string): string {
  if (n === undefined) throw new DslError(`Expected ${what}`);
  if (isStringLiteral(n)) return n.toString();
  if (isAtom(n)) return n;
  throw new DslError(`Expected ${what} to be a name, got a list`);
}

/** Keyword/atom value (must be a bare atom, not a quoted literal or list). */
function keyword(n: SNode | undefined, what: string): string {
  if (n !== undefined && isAtom(n)) return n;
  throw new DslError(`Expected keyword for ${what}`);
}

function head(list: SNode[], what: string): string {
  const h = list[0];
  if (!isAtom(h)) throw new DslError(`Expected ${what} to start with a keyword`);
  return h;
}

// ── EXPR: DSL node -> JS expression string (matches blockToExpr output) ────────
//
// We emit the same JS expression strings that the Blockly generator produces so
// that `standingsEngine` (which evaluates them) keeps working unchanged, and so
// the topo-sort dependency regex /(?:stats|intermediate)\['([^']+)'\]/g still
// resolves references.

const ARITH: Record<string, string> = { '+': '+', '-': '-', '*': '*', '/': '/', '**': '**' };
const COMPARE: Record<string, string> = { '=': '===', '!=': '!==', '<': '<', '<=': '<=', '>': '>', '>=': '>=' };
const MATH_FN: Record<string, string> = {
  sqrt: 'Math.sqrt', abs: 'Math.abs', neg: '-', ln: 'Math.log',
  log10: 'Math.log10', exp: 'Math.exp', pow10: '(x=>Math.pow(10,x))',
};

function exprToJs(node: SNode): string {
  // Bare atom in expression position: a number literal, otherwise invalid.
  if (isAtom(node)) {
    if (node !== '' && !Number.isNaN(Number(node))) return String(Number(node));
    throw new DslError(`Unexpected symbol "${node}" in expression; did you mean a (pairing ${node}) / (stat "${node}") form?`);
  }
  if (isStringLiteral(node)) {
    throw new DslError(`Unexpected string literal "${node}" in expression`);
  }
  const list = node;
  if (list.length === 0) throw new DslError('Empty expression');
  const op = head(list, 'expression');

  switch (op) {
    case 'pairing':
    case 'ballot':
      return `p.${keyword(list[1], `${op} field`)}`;
    case 'team':
      return `stats['${keyword(list[1], 'team field')}']`;
    case 'stat':
      return `stats['${nameOf(list[1], 'stat name')}']`;
    case 'intermediate':
      return `intermediate['${nameOf(list[1], 'intermediate name')}']`;
    case 'opponent':
      return `opponent['${nameOf(list[1], 'opponent stat name')}']`;
    case '+': case '-': case '*': case '/': case '**':
      return `(${exprToJs(list[1])} ${ARITH[op]} ${exprToJs(list[2])})`;
    case '=': case '!=': case '<': case '<=': case '>': case '>=':
      return `(${exprToJs(list[1])} ${COMPARE[op]} ${exprToJs(list[2])} ? 1 : 0)`;
    case 'and':
      return `((${exprToJs(list[1])} && ${exprToJs(list[2])}) ? 1 : 0)`;
    case 'or':
      return `((${exprToJs(list[1])} || ${exprToJs(list[2])}) ? 1 : 0)`;
    case 'if':
      return `(${exprToJs(list[1])} ? ${exprToJs(list[2])} : ${exprToJs(list[3])})`;
    case 'sqrt': case 'abs': case 'neg': case 'ln': case 'log10': case 'exp': case 'pow10':
      return `${MATH_FN[op]}(${exprToJs(list[1])})`;
    default:
      throw new DslError(`Unknown expression operator "${op}"`);
  }
}

// ── JS expression string -> DSL node string (for serialization) ────────────────
//
// Rather than re-derive from the AST, we serialize the same StatDef.expr JS
// strings back to DSL by parsing them with a tiny recursive descent parser over
// the constrained grammar exprToJs emits. This keeps a single source of truth.

interface Tok { t: string; v: string; }

function lexJs(s: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') { i++; continue; }
    // pow10 is emitted as the lambda literal `(x=>Math.pow(10,x))(<arg>)`. Consume
    // the whole lambda `(x=>Math.pow(10,x))` so only `(<arg>)` remains for the fn.
    if (s.startsWith('(x=>Math.pow(10,x))', i)) {
      toks.push({ t: 'fn', v: 'pow10' });
      i += '(x=>Math.pow(10,x))'.length; continue;
    }
    if (c === '(' || c === ')') { toks.push({ t: c, v: c }); i++; continue; }
    if (c === '?' || c === ':') { toks.push({ t: c, v: c }); i++; continue; }
    // multi-char operators
    if (s.startsWith('===', i)) { toks.push({ t: 'op', v: '===' }); i += 3; continue; }
    if (s.startsWith('!==', i)) { toks.push({ t: 'op', v: '!==' }); i += 3; continue; }
    if (s.startsWith('**', i)) { toks.push({ t: 'op', v: '**' }); i += 2; continue; }
    if (s.startsWith('<=', i)) { toks.push({ t: 'op', v: '<=' }); i += 2; continue; }
    if (s.startsWith('>=', i)) { toks.push({ t: 'op', v: '>=' }); i += 2; continue; }
    if (s.startsWith('&&', i)) { toks.push({ t: 'op', v: '&&' }); i += 2; continue; }
    if (s.startsWith('||', i)) { toks.push({ t: 'op', v: '||' }); i += 2; continue; }
    // Unary negation from the `neg` math fn is emitted as `-(...)`.
    if (c === '-' && s[i + 1] === '(') { toks.push({ t: 'fn', v: 'neg' }); i++; continue; }
    if ('+-*/<>'.includes(c)) { toks.push({ t: 'op', v: c }); i++; continue; }
    // p.field
    if (s.startsWith('p.', i)) {
      let j = i + 2;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
      toks.push({ t: 'pfield', v: s.slice(i + 2, j) });
      i = j; continue;
    }
    // stats['X'] / intermediate['X'] / opponent['X']
    const dictMatch = /^(stats|intermediate|opponent)\['([^']*)'\]/.exec(s.slice(i));
    if (dictMatch) {
      toks.push({ t: 'dict', v: `${dictMatch[1]}:${dictMatch[2]}` });
      i += dictMatch[0].length; continue;
    }
    // Math.* functions
    const fnMatch = /^Math\.(sqrt|abs|log10|log|exp)/.exec(s.slice(i));
    if (fnMatch) {
      const map: Record<string, string> = { sqrt: 'sqrt', abs: 'abs', log10: 'log10', log: 'ln', exp: 'exp' };
      toks.push({ t: 'fn', v: map[fnMatch[1]] });
      i += fnMatch[0].length; continue;
    }
    // number
    const numMatch = /^-?\d+(\.\d+)?/.exec(s.slice(i));
    if (numMatch) { toks.push({ t: 'num', v: numMatch[0] }); i += numMatch[0].length; continue; }
    throw new DslError(`Cannot serialize expression near "${s.slice(i, i + 12)}"`);
  }
  return toks;
}

// Recursive descent over the JS expr grammar our generator emits.
class JsExprReader {
  private i = 0;
  private toks: Tok[];
  constructor(toks: Tok[]) { this.toks = toks; }

  private peek(): Tok | undefined { return this.toks[this.i]; }
  private next(): Tok { return this.toks[this.i++]; }
  private expect(t: string): Tok {
    const tok = this.next();
    if (!tok || tok.t !== t) throw new DslError(`Expected "${t}" while reading expression`);
    return tok;
  }

  read(): string {
    const node = this.readNode();
    if (this.i !== this.toks.length) throw new DslError('Trailing tokens in expression');
    return node;
  }

  private readNode(): string {
    const tok = this.peek();
    if (!tok) throw new DslError('Unexpected end of expression');
    switch (tok.t) {
      case 'num':   this.next(); return tok.v;
      case 'pfield': this.next(); return `(pairing ${tok.v})`;
      case 'dict': {
        this.next();
        const [dict, name] = tok.v.split(/:(.*)/s);
        if (dict === 'stats') {
          // Could be a stat ref or a team-field builtin. Team builtins are lowercase
          // snake_case identifiers; user stat names are arbitrary. We cannot always
          // tell them apart, so we emit (team ...) for bare snake_case and (stat ...)
          // otherwise. Both resolve to stats[...] in the engine, so round-trip is
          // value-preserving even if the surface form differs for edge cases.
          return /^[a-z][a-z0-9_]*$/.test(name) ? `(team ${name})` : `(stat "${name}")`;
        }
        if (dict === 'intermediate') return `(intermediate "${name}")`;
        return `(opponent "${name}")`;
      }
      case 'fn': {
        this.next();
        this.expect('(');
        const arg = this.readNode();
        this.expect(')');
        return `(${tok.v} ${arg})`;
      }
      case '(': {
        this.next();
        const first = this.readNode();
        const opTok = this.peek();
        // ternary: ( cond ? then : else )  OR comparison/logic wrapped as ( a op b ? 1 : 0 )
        if (opTok && opTok.t === '?') {
          this.next();
          const then = this.readNode();
          this.expect(':');
          const els = this.readNode();
          this.expect(')');
          return this.reconstructConditional(first, then, els);
        }
        if (opTok && opTok.t === 'op') {
          this.next();
          const right = this.readNode();
          // Could be ` a op b )` OR ` a op b ? 1 : 0 )`
          const after = this.peek();
          if (after && after.t === '?') {
            this.next();
            this.readNode(); // then (1)
            this.expect(':');
            this.readNode(); // else (0)
            this.expect(')');
            return this.wrapCompareOrLogic(opTok.v, first, right);
          }
          this.expect(')');
          if (opTok.v === '&&' || opTok.v === '||') return this.wrapCompareOrLogic(opTok.v, first, right);
          return `(${this.arithSym(opTok.v)} ${first} ${right})`;
        }
        // Parenthesized single node
        this.expect(')');
        return first;
      }
      default:
        throw new DslError(`Unexpected token "${tok.v}" in expression`);
    }
  }

  private arithSym(op: string): string {
    const map: Record<string, string> = { '+': '+', '-': '-', '*': '*', '/': '/', '**': '**' };
    if (!map[op]) throw new DslError(`Unexpected arithmetic operator "${op}"`);
    return map[op];
  }

  private wrapCompareOrLogic(op: string, a: string, b: string): string {
    const cmp: Record<string, string> = { '===': '=', '!==': '!=', '<': '<', '<=': '<=', '>': '>', '>=': '>=' };
    if (cmp[op]) return `(${cmp[op]} ${a} ${b})`;
    if (op === '&&') return `(and ${a} ${b})`;
    if (op === '||') return `(or ${a} ${b})`;
    throw new DslError(`Unexpected operator "${op}"`);
  }

  private reconstructConditional(cond: string, then: string, els: string): string {
    // Our generator wraps compare/logic forms as `(<bool> ? 1 : 0)`. When we see
    // that exact idiom and the condition is already a boolean DSL form, collapse
    // it back rather than emitting a redundant (if ...) — this keeps round-trips
    // value- and shape-stable.
    if (then === '1' && els === '0' && /^\((=|!=|<|<=|>|>=|and|or) /.test(cond)) return cond;
    return `(if ${cond} ${then} ${els})`;
  }
}

function jsExprToDsl(expr: string): string {
  return new JsExprReader(lexJs(expr)).read();
}

// ── Public API: parse DSL text -> StandingsConfig ──────────────────────────────

export function parseDsl(text: string): StandingsConfig {
  if (!text || !text.trim()) return { statDefs: [], columns: [], tiebreakers: [] };
  const parsed = parseSexp(text);
  if (parsed instanceof Error) throw new DslError(`DSL parse error: ${parsed.message}`);
  if (!isList(parsed)) throw new DslError('DSL must be a (config ...) form');
  if (head(parsed, 'config') !== 'config') throw new DslError('DSL must start with (config ...)');

  const statDefs: StatDef[] = [];
  const columns: ColumnConfig[] = [];
  const tiebreakers: TiebreakerRule[] = [];

  for (const form of parsed.slice(1)) {
    if (!isList(form)) throw new DslError('Each config entry must be a list');
    const kind = head(form, 'config entry');
    switch (kind) {
      case 'stat': {
        // (stat "Name" AGG EXPR)
        const name = nameOf(form[1], 'stat name');
        const agg = keyword(form[2], 'aggregation') as StatDef['agg'];
        if (!AGGS.has(agg)) throw new DslError(`Invalid aggregation "${agg}"`);
        statDefs.push({ name, agg, expr: exprToJs(form[3]) });
        break;
      }
      case 'team-stat': {
        // (team-stat "Name" EXPR)
        const name = nameOf(form[1], 'team-stat name');
        statDefs.push({ name, agg: 'sum', expr: exprToJs(form[2]), teamLevel: true });
        break;
      }
      case 'intermediate': {
        // (intermediate "Name" AGG EXPR)
        const name = nameOf(form[1], 'intermediate name');
        const agg = keyword(form[2], 'aggregation') as StatDef['agg'];
        if (!AGGS.has(agg)) throw new DslError(`Invalid aggregation "${agg}"`);
        statDefs.push({ name, agg, expr: exprToJs(form[3]), intermediate: true });
        break;
      }
      case 'trimmed': {
        // (trimmed "Name" AGG TRIM EXPR)
        const name = nameOf(form[1], 'trimmed stat name');
        const agg = keyword(form[2], 'aggregation') as StatDef['agg'];
        if (!AGGS.has(agg)) throw new DslError(`Invalid aggregation "${agg}"`);
        const trim = Number(keyword(form[3], 'trim count'));
        if (Number.isNaN(trim)) throw new DslError('trim count must be a number');
        statDefs.push({ name, agg, expr: exprToJs(form[4]), trim });
        break;
      }
      case 'columns': {
        for (const col of form.slice(1)) {
          if (!isList(col) || head(col, 'column') !== 'column')
            throw new DslError('columns entries must be (column "Stat" "Label")');
          const stat = nameOf(col[1], 'column stat');
          const label = col[2] !== undefined ? nameOf(col[2], 'column label') : stat;
          columns.push({ stat, label: label || stat });
        }
        break;
      }
      case 'tiebreakers': {
        for (const tb of form.slice(1)) {
          if (!isList(tb)) throw new DslError('tiebreakers entries must be lists');
          const tbKind = head(tb, 'tiebreaker');
          const stat = nameOf(tb[1], 'tiebreaker stat');
          const order = keyword(tb[2], 'order') as 'asc' | 'desc';
          if (!ORDERS.has(order)) throw new DslError(`Invalid order "${order}"`);
          if (tbKind === 'by') tiebreakers.push({ type: 'stat', stat, order });
          else if (tbKind === 'h2h') tiebreakers.push({ type: 'h2h_conditional', stat, order });
          else throw new DslError(`Unknown tiebreaker "${tbKind}"`);
        }
        break;
      }
      default:
        throw new DslError(`Unknown config entry "${kind}"`);
    }
  }

  return { statDefs, columns, tiebreakers };
}

// ── Public API: StandingsConfig -> DSL text ────────────────────────────────────

function quote(name: string): string {
  return `"${name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function serializeStat(def: StatDef): string {
  const body = jsExprToDsl(def.expr);
  if (def.teamLevel) return `  (team-stat ${quote(def.name)} ${body})`;
  if (def.intermediate) return `  (intermediate ${quote(def.name)} ${def.agg} ${body})`;
  if (def.trim !== undefined) return `  (trimmed ${quote(def.name)} ${def.agg} ${def.trim} ${body})`;
  return `  (stat ${quote(def.name)} ${def.agg} ${body})`;
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
  if (config.tiebreakers.length) {
    const tbs = config.tiebreakers
      .map(t => t.type === 'h2h_conditional' ? `(h2h ${quote(t.stat)} ${t.order})` : `(by ${quote(t.stat)} ${t.order})`)
      .join(' ');
    lines.push(`  (tiebreakers ${tbs})`);
  } else {
    lines.push('  (tiebreakers)');
  }
  return lines.join('\n') + ')';
}
