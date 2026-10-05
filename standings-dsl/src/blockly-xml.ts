// Blockly workspace-XML <-> StandingsConfig conversion.
//
// This module is **Blockly-free**: it builds and reads the Blockly workspace XML
// as plain strings/trees, with no dependency on the `blockly` runtime. The
// frontend editor delegates its DSL<->blocks round-trip to these functions and
// keeps only the thin live-workspace glue (toolbox, dynamic dropdowns).
//
// The conversion is a homomorphism with the DSL: for every config `C` that
// `parseDsl` accepts, `workspaceXmlToConfig(configToWorkspaceXml(C))` deep-equals
// `C`. The test suite enforces this across the entire DSL surface.
//
// Two workspaces are produced/consumed:
//   • statsXml      — the `define_visible_stats` hat (column chain) + stat hats
//   • standingsXml  — the `tiebreaker_order` hat (method field + rule chain)
//
// Block/field contract (must match frontend standingsBlocks.ts exactly):
//   Expr value blocks:
//     pairing_field(FIELD) ballot_field(FIELD) team_field(FIELD)
//     stat_ref(NAME) intermediate_ref(NAME) opponent_stat(NAME)
//     math_number(NUM)
//     math_arithmetic(OP; A,B) logic_compare(OP; A,B) logic_operation(OP; A,B)
//     logic_ternary(IF,THEN,ELSE) math_single(OP; NUM)
//   Stat hats:
//     stat_hat(NAME,AGG; VALUE) team_stat_hat(NAME; VALUE)
//     intermediate_stat_hat(NAME; VALUE) trimmed_stat(NAME,AGG,TRIM; VALUE)
//   Columns: define_visible_stats -> standings_column(STAT,LABEL) chain
//   Tiebreakers: tiebreaker_order(METHOD) -> rule chain of
//     standings_tiebreaker(STAT,ORDER) standings_h2h_conditional(STAT,ORDER)
//     standings_alpha(FIELD,ORDER) standings_when_tied(MIN,MAX; RULES statement)

import type {
  Expr, ArithOp, CompareOp, LogicOp, MathFn, PairingField, TeamField,
  Agg, Order, RankMethod, AlphaField,
  StatDef, ColumnConfig, TiebreakerRule, StandingsConfig,
} from './types.js';

// ── Op <-> Blockly field-value maps ────────────────────────────────────────────

const ARITH_TO_BLK: Record<ArithOp, string> = { '+': 'ADD', '-': 'MINUS', '*': 'MULTIPLY', '/': 'DIVIDE', '**': 'POWER' };
const BLK_TO_ARITH: Record<string, ArithOp> = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/', POWER: '**' };

const CMP_TO_BLK: Record<CompareOp, string> = { '=': 'EQ', '!=': 'NEQ', '<': 'LT', '<=': 'LTE', '>': 'GT', '>=': 'GTE' };
const BLK_TO_CMP: Record<string, CompareOp> = { EQ: '=', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };

const FN_TO_BLK: Record<MathFn, string> = { sqrt: 'ROOT', abs: 'ABS', neg: 'NEG', ln: 'LN', log10: 'LOG10', exp: 'EXP', pow10: 'POW10' };
const BLK_TO_FN: Record<string, MathFn> = { ROOT: 'sqrt', ABS: 'abs', NEG: 'neg', LN: 'ln', LOG10: 'log10', EXP: 'exp', POW10: 'pow10' };

// Pairing fields authored via the `ballot_field` block (the rest via `pairing_field`).
// Both map to the DSL `pairingField` kind; this only mirrors the two editor blocks.
const BALLOT_FIELDS = new Set<PairingField>(['ballot_pf', 'ballot_pa', 'ballot_pd', 'ballot_raw']);

// ─────────────────────────────────────────────────────────────────────────────
// Zero-dependency XML
// ─────────────────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function unesc(s: string): string {
  return s
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** A parsed XML element: tag name, attributes, children, and direct text. */
export interface XmlNode {
  tag: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}

/**
 * Minimal recursive-descent XML parser for the small, regular XML this module
 * emits (and the equivalent Blockly `workspaceToDom` output). Supports elements,
 * attributes, text, self-closing tags, and comments/declarations (skipped). It
 * is intentionally not a general XML parser — just enough for Blockly workspaces.
 */
export function parseXml(xml: string): XmlNode {
  let i = 0;
  const n = xml.length;

  const skipWs = () => { while (i < n && /\s/.test(xml[i])) i++; };

  const parseNode = (): XmlNode | null => {
    skipWs();
    if (i >= n || xml[i] !== '<') return null;

    // Skip comments and declarations: <!-- -->, <? ?>, <!...>
    if (xml.startsWith('<!--', i)) { i = xml.indexOf('-->', i) + 3; return parseNode(); }
    if (xml[i + 1] === '?' || xml[i + 1] === '!') { i = xml.indexOf('>', i) + 1; return parseNode(); }

    i++; // consume '<'
    const tagStart = i;
    while (i < n && !/[\s/>]/.test(xml[i])) i++;
    const tag = xml.slice(tagStart, i);

    const attrs: Record<string, string> = {};
    // Attributes.
    for (;;) {
      skipWs();
      if (i >= n || xml[i] === '>' || xml[i] === '/') break;
      const aStart = i;
      while (i < n && !/[\s=/>]/.test(xml[i])) i++;
      const aName = xml.slice(aStart, i);
      skipWs();
      let aVal = '';
      if (xml[i] === '=') {
        i++; skipWs();
        const quote = xml[i];
        if (quote === '"' || quote === "'") {
          i++;
          const vStart = i;
          while (i < n && xml[i] !== quote) i++;
          aVal = unesc(xml.slice(vStart, i));
          i++; // closing quote
        }
      }
      if (aName) attrs[aName] = aVal;
    }

    const node: XmlNode = { tag, attrs, children: [], text: '' };

    // Self-closing.
    if (xml[i] === '/') { i += 2; return node; } // consume '/>'
    i++; // consume '>'

    // Children / text until closing tag.
    for (;;) {
      // Text run.
      const textStart = i;
      while (i < n && xml[i] !== '<') i++;
      if (i > textStart) node.text += unesc(xml.slice(textStart, i));

      if (i >= n) break;
      if (xml.startsWith('</', i)) { i = xml.indexOf('>', i) + 1; break; } // closing tag
      const child = parseNode();
      if (child) node.children.push(child);
      else break;
    }
    return node;
  };

  const root = parseNode();
  if (!root) throw new Error('Empty or invalid XML');
  return root;
}

/** Find the first child element with the given tag. */
function child(node: XmlNode, tag: string): XmlNode | undefined {
  return node.children.find(c => c.tag === tag);
}

/** All direct child <block> elements (there is at most one per connection slot). */
function childBlocks(node: XmlNode): XmlNode[] {
  return node.children.filter(c => c.tag === 'block');
}

/** Read a <field name="X"> value from a block element. */
function field(block: XmlNode, name: string): string {
  const f = block.children.find(c => c.tag === 'field' && c.attrs.name === name);
  return f ? f.text : '';
}

/** The target <block> inside a named <value> or <statement> input. */
function inputBlock(block: XmlNode, name: string): XmlNode | undefined {
  const input = block.children.find(c => (c.tag === 'value' || c.tag === 'statement') && c.attrs.name === name);
  return input ? child(input, 'block') : undefined;
}

/** The next block in a statement chain (inside <next>). */
function nextBlock(block: XmlNode): XmlNode | undefined {
  const next = child(block, 'next');
  return next ? child(next, 'block') : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// config -> workspace XML
// ─────────────────────────────────────────────────────────────────────────────

function exprXml(e: Expr): string {
  switch (e.kind) {
    case 'pairingField':
      return BALLOT_FIELDS.has(e.field)
        ? `<block type="ballot_field"><field name="FIELD">${esc(e.field)}</field></block>`
        : `<block type="pairing_field"><field name="FIELD">${esc(e.field)}</field></block>`;
    case 'teamField':
      return `<block type="team_field"><field name="FIELD">${esc(e.field)}</field></block>`;
    case 'statRef':
      return `<block type="stat_ref"><field name="NAME">${esc(e.name)}</field></block>`;
    case 'intermediateRef':
      return `<block type="intermediate_ref"><field name="NAME">${esc(e.name)}</field></block>`;
    case 'opponentRef':
      return `<block type="opponent_stat"><field name="NAME">${esc(e.name)}</field></block>`;
    case 'number':
      return `<block type="math_number"><field name="NUM">${esc(String(e.value))}</field></block>`;
    case 'arith':
      return `<block type="math_arithmetic"><field name="OP">${ARITH_TO_BLK[e.op]}</field>` +
        `<value name="A">${exprXml(e.left)}</value><value name="B">${exprXml(e.right)}</value></block>`;
    case 'compare':
      return `<block type="logic_compare"><field name="OP">${CMP_TO_BLK[e.op]}</field>` +
        `<value name="A">${exprXml(e.left)}</value><value name="B">${exprXml(e.right)}</value></block>`;
    case 'logic':
      return `<block type="logic_operation"><field name="OP">${e.op === 'and' ? 'AND' : 'OR'}</field>` +
        `<value name="A">${exprXml(e.left)}</value><value name="B">${exprXml(e.right)}</value></block>`;
    case 'if':
      return `<block type="logic_ternary">` +
        `<value name="IF">${exprXml(e.test)}</value><value name="THEN">${exprXml(e.then)}</value><value name="ELSE">${exprXml(e.else)}</value></block>`;
    case 'call':
      return `<block type="math_single"><field name="OP">${FN_TO_BLK[e.fn]}</field><value name="NUM">${exprXml(e.arg)}</value></block>`;
  }
}

function statHatXml(def: StatDef): string {
  const value = `<value name="VALUE">${exprXml(def.expr)}</value>`;
  if (def.teamLevel)
    return `<block type="team_stat_hat"><field name="NAME">${esc(def.name)}</field>${value}</block>`;
  if (def.intermediate)
    return `<block type="intermediate_stat_hat"><field name="NAME">${esc(def.name)}</field>${value}</block>`;
  if (def.trim !== undefined)
    return `<block type="trimmed_stat"><field name="NAME">${esc(def.name)}</field><field name="AGG">${def.agg}</field>${value}<field name="TRIM">${def.trim}</field></block>`;
  return `<block type="stat_hat"><field name="NAME">${esc(def.name)}</field><field name="AGG">${def.agg}</field>${value}</block>`;
}

function columnsChainXml(columns: ColumnConfig[]): string {
  let inner = '';
  for (let i = columns.length - 1; i >= 0; i--) {
    const c = columns[i];
    const next = inner ? `<next>${inner}</next>` : '';
    inner = `<block type="standings_column"><field name="STAT">${esc(c.stat)}</field><field name="LABEL">${esc(c.label)}</field>${next}</block>`;
  }
  return inner ? `<next>${inner}</next>` : '';
}

function tiebreakerRuleXml(t: TiebreakerRule): string {
  switch (t.type) {
    case 'stat':
      return `<block type="standings_tiebreaker"><field name="STAT">${esc(t.stat)}</field><field name="ORDER">${t.order}</field>%NEXT%</block>`;
    case 'h2h_conditional':
      return `<block type="standings_h2h_conditional"><field name="STAT">${esc(t.stat)}</field><field name="ORDER">${t.order}</field>%NEXT%</block>`;
    case 'alpha':
      return `<block type="standings_alpha"><field name="FIELD">${t.field}</field><field name="ORDER">${t.order}</field>%NEXT%</block>`;
    case 'when_tied': {
      const nested = rulesChainXml(t.rules);
      const statement = nested ? `<statement name="RULES">${nested}</statement>` : '';
      return `<block type="standings_when_tied"><field name="MIN">${t.min}</field><field name="MAX">${t.max}</field>${statement}%NEXT%</block>`;
    }
  }
}

/** Inner (leading) block of a rule chain, with sibling <next> wiring resolved. */
function rulesChainXml(rules: TiebreakerRule[]): string {
  let inner = '';
  for (let i = rules.length - 1; i >= 0; i--) {
    const next = inner ? `<next>${inner}</next>` : '';
    inner = tiebreakerRuleXml(rules[i]).replace('%NEXT%', next);
  }
  return inner;
}

/**
 * Produce `{ statsXml, standingsXml }` workspace XML for a StandingsConfig.
 * Pure string building — no Blockly runtime.
 */
export function configToWorkspaceXml(config: StandingsConfig): { statsXml: string; standingsXml: string } {
  const ns = 'https://developers.google.com/blockly/xml';

  const visHat = `<block type="define_visible_stats" deletable="false" movable="false" x="20" y="20">${columnsChainXml(config.columns)}</block>`;
  let y = 200;
  const statBlocks = config.statDefs.map(def => {
    const block = statHatXml(def).replace('<block type=', `<block x="20" y="${y}" type=`);
    y += 120;
    return block;
  }).join('');
  const statsXml = `<xml xmlns="${ns}">${visHat}${statBlocks}</xml>`;

  const ruleChain = rulesChainXml(config.tiebreakers.rules);
  const tbChain = ruleChain ? `<next>${ruleChain}</next>` : '';
  const tbHat = `<block type="tiebreaker_order" deletable="false" movable="false" x="20" y="20"><field name="METHOD">${config.tiebreakers.method}</field>${tbChain}</block>`;
  const standingsXml = `<xml xmlns="${ns}">${tbHat}</xml>`;

  return { statsXml, standingsXml };
}

// ─────────────────────────────────────────────────────────────────────────────
// workspace XML -> config
// ─────────────────────────────────────────────────────────────────────────────

function blockToExpr(block: XmlNode | undefined): Expr {
  if (!block) return { kind: 'number', value: 0 };
  switch (block.attrs.type) {
    case 'pairing_field':
    case 'ballot_field':
      return { kind: 'pairingField', field: field(block, 'FIELD') as PairingField };
    case 'team_field':
      return { kind: 'teamField', field: field(block, 'FIELD') as TeamField };
    case 'stat_ref':
      return { kind: 'statRef', name: field(block, 'NAME') };
    case 'intermediate_ref':
      return { kind: 'intermediateRef', name: field(block, 'NAME') };
    case 'opponent_stat':
      return { kind: 'opponentRef', name: field(block, 'NAME') };
    case 'math_number':
      return { kind: 'number', value: Number(field(block, 'NUM')) };
    case 'math_arithmetic':
      return { kind: 'arith', op: BLK_TO_ARITH[field(block, 'OP')] ?? '+', left: blockToExpr(inputBlock(block, 'A')), right: blockToExpr(inputBlock(block, 'B')) };
    case 'logic_compare':
      return { kind: 'compare', op: BLK_TO_CMP[field(block, 'OP')] ?? '=', left: blockToExpr(inputBlock(block, 'A')), right: blockToExpr(inputBlock(block, 'B')) };
    case 'logic_operation':
      return { kind: 'logic', op: (field(block, 'OP') === 'OR' ? 'or' : 'and') as LogicOp, left: blockToExpr(inputBlock(block, 'A')), right: blockToExpr(inputBlock(block, 'B')) };
    case 'logic_ternary':
      return { kind: 'if', test: blockToExpr(inputBlock(block, 'IF')), then: blockToExpr(inputBlock(block, 'THEN')), else: blockToExpr(inputBlock(block, 'ELSE')) };
    case 'math_single':
      return { kind: 'call', fn: BLK_TO_FN[field(block, 'OP')] ?? 'abs', arg: blockToExpr(inputBlock(block, 'NUM')) };
    default:
      return { kind: 'number', value: 0 };
  }
}

/** Collect stat/intermediate reference names from an expr (for topological sort). */
function exprRefs(e: Expr): string[] {
  switch (e.kind) {
    case 'statRef':
    case 'intermediateRef':
      return [e.name];
    case 'arith':
    case 'compare':
    case 'logic':
      return [...exprRefs(e.left), ...exprRefs(e.right)];
    case 'if':
      return [...exprRefs(e.test), ...exprRefs(e.then), ...exprRefs(e.else)];
    case 'call':
      return exprRefs(e.arg);
    default:
      return [];
  }
}

function hatToStatDef(block: XmlNode): StatDef {
  const name = field(block, 'NAME');
  const expr = blockToExpr(inputBlock(block, 'VALUE'));
  switch (block.attrs.type) {
    case 'team_stat_hat':
      return { name, agg: 'sum', expr, teamLevel: true };
    case 'intermediate_stat_hat':
      return { name, agg: (field(block, 'AGG') as Agg) || 'sum', expr, intermediate: true };
    case 'trimmed_stat':
      return { name, agg: (field(block, 'AGG') as Agg) || 'sum', expr, trim: Number(field(block, 'TRIM')) };
    default: // stat_hat
      return { name, agg: (field(block, 'AGG') as Agg) || 'sum', expr };
  }
}

function blockToTiebreakerRule(block: XmlNode): TiebreakerRule | null {
  switch (block.attrs.type) {
    case 'standings_tiebreaker':
      return { type: 'stat', stat: field(block, 'STAT'), order: field(block, 'ORDER') as Order };
    case 'standings_h2h_conditional':
      return { type: 'h2h_conditional', stat: field(block, 'STAT'), order: field(block, 'ORDER') as Order };
    case 'standings_alpha':
      return { type: 'alpha', field: field(block, 'FIELD') as AlphaField, order: field(block, 'ORDER') as Order };
    case 'standings_when_tied': {
      const rules = chainToRules(inputBlock(block, 'RULES'));
      if (rules.length === 0) return null; // DSL requires >= 1 nested rule
      return { type: 'when_tied', min: Number(field(block, 'MIN')), max: Number(field(block, 'MAX')), rules };
    }
    default:
      return null;
  }
}

function chainToRules(first: XmlNode | undefined): TiebreakerRule[] {
  const rules: TiebreakerRule[] = [];
  let b = first;
  while (b) {
    const rule = blockToTiebreakerRule(b);
    if (rule) rules.push(rule);
    b = nextBlock(b);
  }
  return rules;
}

/** Find the top-level hat block of a given type within an <xml> root. */
function findHat(root: XmlNode, type: string): XmlNode | undefined {
  return childBlocks(root).find(b => b.attrs.type === type);
}

/**
 * Reconstruct a StandingsConfig from workspace XML. Inverse of
 * `configToWorkspaceXml`. Statless/empty workspaces yield an empty config.
 */
export function workspaceXmlToConfig(xml: { statsXml: string; standingsXml: string }): StandingsConfig {
  const statsRoot = parseXml(xml.statsXml);
  const standingsRoot = parseXml(xml.standingsXml);

  // Stat definitions: every top-level hat block that is not the visible-stats hat.
  const STAT_HAT_TYPES = new Set(['stat_hat', 'trimmed_stat', 'team_stat_hat', 'intermediate_stat_hat']);
  const rawDefs: StatDef[] = childBlocks(statsRoot)
    .filter(b => STAT_HAT_TYPES.has(b.attrs.type))
    .map(hatToStatDef);

  // Topological sort so dependencies precede dependents (mirrors the interpreter's
  // expectation and the previous frontend extractor).
  const defsByName = new Map(rawDefs.map(d => [d.name, d]));
  const statDefs: StatDef[] = [];
  const visited = new Set<string>();
  const visit = (name: string) => {
    if (visited.has(name)) return;
    visited.add(name);
    const def = defsByName.get(name);
    if (!def) return;
    for (const dep of exprRefs(def.expr)) visit(dep);
    statDefs.push(def);
  };
  for (const def of rawDefs) visit(def.name);

  // Columns: chain off the define_visible_stats hat.
  const columns: ColumnConfig[] = [];
  const visHat = findHat(statsRoot, 'define_visible_stats');
  if (visHat) {
    let b = nextBlock(visHat);
    while (b) {
      if (b.attrs.type === 'standings_column') {
        const stat = field(b, 'STAT');
        if (stat && stat !== '__none__') {
          columns.push({ stat, label: field(b, 'LABEL') || stat });
        }
      }
      b = nextBlock(b);
    }
  }

  // Tiebreakers: method on the hat + rule chain.
  const tbHat = findHat(standingsRoot, 'tiebreaker_order');
  const method = ((tbHat && field(tbHat, 'METHOD')) as RankMethod) || 'first';
  const rules = chainToRules(tbHat ? nextBlock(tbHat) : undefined);

  return { statDefs, columns, tiebreakers: { method, rules } };
}
