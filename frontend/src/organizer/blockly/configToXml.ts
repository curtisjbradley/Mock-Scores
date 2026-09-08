// Editor-only helper: build Blockly workspace XML from a StandingsConfig.
//
// The DSL is the persisted source of truth, but the visual editor still runs on
// Blockly workspaces. On load we parse DSL -> StandingsConfig -> XML and feed it
// to `domToWorkspace`. This keeps the compute/display paths Blockly-free while
// letting the editor round-trip. This module is imported only by StandingsBuilder.

import type { StandingsConfig, StatDef } from './standingsGenerator';

// ── JS expression string -> block XML ─────────────────────────────────────────
//
// StatDef.expr holds the same JS expression strings the Blockly generator emits.
// We parse them back into block XML so the editor can display the formula.

type Expr =
  | { k: 'pfield'; field: string }
  | { k: 'stat'; name: string }
  | { k: 'intermediate'; name: string }
  | { k: 'opponent'; name: string }
  | { k: 'team'; name: string }
  | { k: 'num'; value: string }
  | { k: 'arith'; op: string; a: Expr; b: Expr }
  | { k: 'compare'; op: string; a: Expr; b: Expr }
  | { k: 'logic'; op: string; a: Expr; b: Expr }
  | { k: 'ternary'; test: Expr; then: Expr; els: Expr }
  | { k: 'fn'; fn: string; arg: Expr };

interface Tok { t: string; v: string; }

function lex(s: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') { i++; continue; }
    if (s.startsWith('(x=>Math.pow(10,x))', i)) { toks.push({ t: 'fn', v: 'pow10' }); i += '(x=>Math.pow(10,x))'.length; continue; }
    if (c === '(' || c === ')') { toks.push({ t: c, v: c }); i++; continue; }
    if (c === '?' || c === ':') { toks.push({ t: c, v: c }); i++; continue; }
    if (s.startsWith('===', i)) { toks.push({ t: 'op', v: '===' }); i += 3; continue; }
    if (s.startsWith('!==', i)) { toks.push({ t: 'op', v: '!==' }); i += 3; continue; }
    if (s.startsWith('**', i)) { toks.push({ t: 'op', v: '**' }); i += 2; continue; }
    if (s.startsWith('<=', i)) { toks.push({ t: 'op', v: '<=' }); i += 2; continue; }
    if (s.startsWith('>=', i)) { toks.push({ t: 'op', v: '>=' }); i += 2; continue; }
    if (s.startsWith('&&', i)) { toks.push({ t: 'op', v: '&&' }); i += 2; continue; }
    if (s.startsWith('||', i)) { toks.push({ t: 'op', v: '||' }); i += 2; continue; }
    if (c === '-' && s[i + 1] === '(') { toks.push({ t: 'fn', v: 'neg' }); i++; continue; }
    if ('+-*/<>'.includes(c)) { toks.push({ t: 'op', v: c }); i++; continue; }
    if (s.startsWith('p.', i)) {
      let j = i + 2;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
      toks.push({ t: 'pfield', v: s.slice(i + 2, j) }); i = j; continue;
    }
    const dict = /^(stats|intermediate|opponent)\['([^']*)'\]/.exec(s.slice(i));
    if (dict) { toks.push({ t: 'dict', v: `${dict[1]}:${dict[2]}` }); i += dict[0].length; continue; }
    const fn = /^Math\.(sqrt|abs|log10|log|exp)/.exec(s.slice(i));
    if (fn) {
      const map: Record<string, string> = { sqrt: 'sqrt', abs: 'abs', log10: 'log10', log: 'ln', exp: 'exp' };
      toks.push({ t: 'fn', v: map[fn[1]] }); i += fn[0].length; continue;
    }
    const num = /^-?\d+(\.\d+)?/.exec(s.slice(i));
    if (num) { toks.push({ t: 'num', v: num[0] }); i += num[0].length; continue; }
    throw new Error(`configToXml: cannot parse expr near "${s.slice(i, i + 12)}"`);
  }
  return toks;
}

class Reader {
  private i = 0;
  private toks: Tok[];
  constructor(toks: Tok[]) { this.toks = toks; }
  private peek(): Tok | undefined { return this.toks[this.i]; }
  private next(): Tok { return this.toks[this.i++]; }
  private expect(t: string): void { const tok = this.next(); if (!tok || tok.t !== t) throw new Error(`configToXml: expected ${t}`); }

  read(): Expr { return this.node(); }

  private node(): Expr {
    const tok = this.peek();
    if (!tok) throw new Error('configToXml: unexpected end');
    switch (tok.t) {
      case 'num': this.next(); return { k: 'num', value: tok.v };
      case 'pfield': this.next(); return { k: 'pfield', field: tok.v };
      case 'dict': {
        this.next();
        const [d, name] = tok.v.split(/:(.*)/s);
        if (d === 'stats') return /^[a-z][a-z0-9_]*$/.test(name) ? { k: 'team', name } : { k: 'stat', name };
        if (d === 'intermediate') return { k: 'intermediate', name };
        return { k: 'opponent', name };
      }
      case 'fn': { this.next(); this.expect('('); const arg = this.node(); this.expect(')'); return { k: 'fn', fn: tok.v, arg }; }
      case '(': {
        this.next();
        const first = this.node();
        const op = this.peek();
        if (op && op.t === '?') {
          this.next(); const then = this.node(); this.expect(':'); const els = this.node(); this.expect(')');
          return { k: 'ternary', test: first, then, els };
        }
        if (op && op.t === 'op') {
          this.next(); const right = this.node();
          const after = this.peek();
          if (after && after.t === '?') { this.next(); this.node(); this.expect(':'); this.node(); this.expect(')'); return this.boolNode(op.v, first, right); }
          this.expect(')');
          if (op.v === '&&' || op.v === '||') return this.boolNode(op.v, first, right);
          return { k: 'arith', op: op.v, a: first, b: right };
        }
        this.expect(')');
        return first;
      }
      default: throw new Error(`configToXml: unexpected token ${tok.v}`);
    }
  }

  private boolNode(op: string, a: Expr, b: Expr): Expr {
    if (op === '&&' || op === '||') return { k: 'logic', op, a, b };
    return { k: 'compare', op, a, b };
  }
}

// ── AST -> block XML ───────────────────────────────────────────────────────────

const ARITH_OP: Record<string, string> = { '+': 'ADD', '-': 'MINUS', '*': 'MULTIPLY', '/': 'DIVIDE', '**': 'POWER' };
const CMP_OP: Record<string, string> = { '===': 'EQ', '!==': 'NEQ', '<': 'LT', '<=': 'LTE', '>': 'GT', '>=': 'GTE' };
const FN_OP: Record<string, string> = { sqrt: 'ROOT', abs: 'ABS', neg: 'NEG', ln: 'LN', log10: 'LOG10', exp: 'EXP', pow10: 'POW10' };

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function exprXml(e: Expr): string {
  switch (e.k) {
    case 'pfield': return `<block type="pairing_field"><field name="FIELD">${esc(e.field)}</field></block>`;
    case 'team': return `<block type="team_field"><field name="FIELD">${esc(e.name)}</field></block>`;
    case 'stat': return `<block type="stat_ref"><field name="NAME">${esc(e.name)}</field></block>`;
    case 'intermediate': return `<block type="intermediate_ref"><field name="NAME">${esc(e.name)}</field></block>`;
    case 'opponent': return `<block type="opponent_stat"><field name="NAME">${esc(e.name)}</field></block>`;
    case 'num': return `<block type="math_number"><field name="NUM">${esc(e.value)}</field></block>`;
    case 'arith':
      return `<block type="math_arithmetic"><field name="OP">${ARITH_OP[e.op]}</field>` +
        `<value name="A">${exprXml(e.a)}</value><value name="B">${exprXml(e.b)}</value></block>`;
    case 'compare':
      return `<block type="logic_compare"><field name="OP">${CMP_OP[e.op]}</field>` +
        `<value name="A">${exprXml(e.a)}</value><value name="B">${exprXml(e.b)}</value></block>`;
    case 'logic':
      return `<block type="logic_operation"><field name="OP">${e.op === '&&' ? 'AND' : 'OR'}</field>` +
        `<value name="A">${exprXml(e.a)}</value><value name="B">${exprXml(e.b)}</value></block>`;
    case 'ternary':
      return `<block type="logic_ternary">` +
        `<value name="IF">${exprXml(e.test)}</value><value name="THEN">${exprXml(e.then)}</value><value name="ELSE">${exprXml(e.els)}</value></block>`;
    case 'fn':
      return `<block type="math_single"><field name="OP">${FN_OP[e.fn]}</field><value name="NUM">${exprXml(e.arg)}</value></block>`;
  }
}

function exprToBlockXml(expr: string): string {
  return exprXml(new Reader(lex(expr)).read());
}

function statHatXml(def: StatDef): string {
  const value = `<value name="VALUE">${exprToBlockXml(def.expr)}</value>`;
  if (def.teamLevel)
    return `<block type="team_stat_hat"><field name="NAME">${esc(def.name)}</field>${value}</block>`;
  if (def.intermediate)
    return `<block type="intermediate_stat_hat"><field name="NAME">${esc(def.name)}</field>${value}</block>`;
  if (def.trim !== undefined)
    return `<block type="trimmed_stat"><field name="NAME">${esc(def.name)}</field><field name="AGG">${def.agg}</field>${value}<field name="TRIM">${def.trim}</field></block>`;
  return `<block type="stat_hat"><field name="NAME">${esc(def.name)}</field><field name="AGG">${def.agg}</field>${value}</block>`;
}

/** Build a linked chain of `standings_column` blocks under the visible-stats hat. */
function columnsChainXml(config: StandingsConfig): string {
  let inner = '';
  for (let i = config.columns.length - 1; i >= 0; i--) {
    const c = config.columns[i];
    const next = inner ? `<next>${inner}</next>` : '';
    inner = `<block type="standings_column"><field name="STAT">${esc(c.stat)}</field><field name="LABEL">${esc(c.label)}</field>${next}</block>`;
  }
  return inner ? `<next>${inner}</next>` : '';
}

/** Build a linked chain of tiebreaker blocks under the tiebreaker-order hat. */
function tiebreakerChainXml(config: StandingsConfig): string {
  let inner = '';
  for (let i = config.tiebreakers.length - 1; i >= 0; i--) {
    const t = config.tiebreakers[i];
    const next = inner ? `<next>${inner}</next>` : '';
    const type = t.type === 'h2h_conditional' ? 'standings_h2h_conditional' : 'standings_tiebreaker';
    inner = `<block type="${type}"><field name="STAT">${esc(t.stat)}</field><field name="ORDER">${t.order}</field>${next}</block>`;
  }
  return inner ? `<next>${inner}</next>` : '';
}

/**
 * Produce `{ statsXml, standingsXml }` for the two editor workspaces from a
 * StandingsConfig. Stat-definition hats are laid out vertically; the visible
 * columns hang off the (fixed) `define_visible_stats` hat, and the tiebreakers
 * off the (fixed) `tiebreaker_order` hat.
 */
export function configToXml(config: StandingsConfig): { statsXml: string; standingsXml: string } {
  const ns = 'https://developers.google.com/blockly/xml';

  // Visible-stats hat with the column chain, followed by free-floating stat hats.
  const visHat = `<block type="define_visible_stats" deletable="false" movable="false" x="20" y="20">${columnsChainXml(config)}</block>`;
  let y = 200;
  const statBlocks = config.statDefs.map(def => {
    const block = statHatXml(def).replace('<block type=', `<block x="20" y="${y}" type=`);
    y += 120;
    return block;
  }).join('');
  const statsXml = `<xml xmlns="${ns}">${visHat}${statBlocks}</xml>`;

  const tbHat = `<block type="tiebreaker_order" deletable="false" movable="false" x="20" y="20">${tiebreakerChainXml(config)}</block>`;
  const standingsXml = `<xml xmlns="${ns}">${tbHat}</xml>`;

  return { statsXml, standingsXml };
}
