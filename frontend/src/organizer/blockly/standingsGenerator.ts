import * as Blockly from 'blockly';

export interface StatDef {
  name: string;
  agg: 'sum' | 'avg' | 'max' | 'min' | 'count';
  expr: string;
  trim?: number;
  teamLevel?: boolean;    // if true, expr is evaluated once at team level using stats[]
  intermediate?: boolean; // if true, computed per-pairing and stored in intermediate dict
}

export interface ColumnConfig {
  stat: string;
  label: string;
}

export type TiebreakerRule =
  | { type: 'stat'; stat: string; order: 'asc' | 'desc' }
  | { type: 'h2h_conditional'; stat: string; order: 'asc' | 'desc' };

export interface StandingsConfig {
  statDefs: StatDef[];
  columns: ColumnConfig[];
  tiebreakers: TiebreakerRule[];
}

function blockToExpr(block: Blockly.Block | null): string {
  if (!block) return '0';
  switch (block.type) {
    case 'pairing_field':
      return `p.${block.getFieldValue('FIELD')}`;
    case 'ballot_field':
      return `p.${block.getFieldValue('FIELD')}`;
    case 'stat_ref':
      return `stats['${block.getFieldValue('NAME')}']`;
    case 'intermediate_ref':
      return `intermediate['${block.getFieldValue('NAME')}']`;
    case 'opponent_stat':
      return `opponent['${block.getFieldValue('NAME')}']`;
    case 'math_number':
      return String(block.getFieldValue('NUM'));
    case 'math_arithmetic': {
      const opMap: Record<string, string> = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/', POWER: '**' };
      const op = opMap[block.getFieldValue('OP')] ?? '+';
      const a = blockToExpr(block.getInputTargetBlock('A'));
      const b = blockToExpr(block.getInputTargetBlock('B'));
      return `(${a} ${op} ${b})`;
    }
    case 'logic_compare': {
      const opMap: Record<string, string> = { EQ: '===', NEQ: '!==', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
      const op = opMap[block.getFieldValue('OP')] ?? '===';
      const a = blockToExpr(block.getInputTargetBlock('A'));
      const b = blockToExpr(block.getInputTargetBlock('B'));
      return `(${a} ${op} ${b} ? 1 : 0)`;
    }
    case 'logic_operation': {
      const op = block.getFieldValue('OP') === 'AND' ? '&&' : '||';
      const a = blockToExpr(block.getInputTargetBlock('A'));
      const b = blockToExpr(block.getInputTargetBlock('B'));
      return `((${a} && ${b}) ? 1 : 0)`.replace('&&', op);
    }
    case 'logic_ternary': {
      const test = blockToExpr(block.getInputTargetBlock('IF'));
      const then = blockToExpr(block.getInputTargetBlock('THEN'));
      const els  = blockToExpr(block.getInputTargetBlock('ELSE'));
      return `(${test} ? ${then} : ${els})`;
    }
    case 'math_single': {
      const fnMap: Record<string, string> = { ROOT: 'Math.sqrt', ABS: 'Math.abs', NEG: '-', LN: 'Math.log', LOG10: 'Math.log10', EXP: 'Math.exp', POW10: '(x=>Math.pow(10,x))' };
      const fn = fnMap[block.getFieldValue('OP')] ?? 'Math.abs';
      const num = blockToExpr(block.getInputTargetBlock('NUM'));
      return `${fn}(${num})`;
    }
    default:
      return '0';
  }
}

function walkFromHat(ws: Blockly.Workspace, hatType: string): Blockly.Block[] {
  const hat = ws.getTopBlocks(false).find(b => b.type === hatType);
  if (!hat) return [];
  const blocks: Blockly.Block[] = [];
  let b: Blockly.Block | null = hat.getNextBlock();
  while (b) { blocks.push(b); b = b.getNextBlock(); }
  return blocks;
}

export function extractStandingsConfig(
  statsWs: Blockly.Workspace,
  standingsWs: Blockly.Workspace,
): StandingsConfig {
  const rawDefs: StatDef[] = [];
  for (const b of statsWs.getTopBlocks(false).filter(b => ['stat_hat', 'trimmed_stat', 'team_stat_hat', 'intermediate_stat_hat'].includes(b.type))) {
    rawDefs.push({
      name: b.getFieldValue('NAME') as string,
      agg: (b.getFieldValue('AGG') as StatDef['agg']) || 'sum',
      expr: blockToExpr(b.getInputTargetBlock('VALUE')),
      ...(b.type === 'trimmed_stat'        ? { trim: Number(b.getFieldValue('TRIM')) } : {}),
      ...(b.type === 'team_stat_hat'        ? { teamLevel: true }                       : {}),
      ...(b.type === 'intermediate_stat_hat' ? { intermediate: true }                   : {}),
    });
  }

  // Topological sort so stats that reference other stats are computed after their dependencies
  const defsByName = new Map(rawDefs.map(d => [d.name, d]));
  const statDefs: StatDef[] = [];
  const visited = new Set<string>();
  function visit(name: string) {
    if (visited.has(name)) return;
    visited.add(name);
    const def = defsByName.get(name);
    if (!def) return;
    // Find all stat_ref and intermediate_ref names used in this expression
    const deps = [...def.expr.matchAll(/(?:stats|intermediate)\['([^']+)'\]/g)].map(m => m[1]);
    for (const dep of deps) visit(dep);
    statDefs.push(def);
  }
  for (const def of rawDefs) visit(def.name);

  const columns: ColumnConfig[] = [];
  for (const b of walkFromHat(statsWs, 'define_visible_stats')) {
    if (b.type === 'standings_column') {
      columns.push({
        stat: b.getFieldValue('STAT') as string,
        label: (b.getFieldValue('LABEL') as string) || b.getFieldValue('STAT'),
      });
    }
  }

  const tiebreakers: TiebreakerRule[] = [];
  for (const b of walkFromHat(standingsWs, 'tiebreaker_order')) {
    if (b.type === 'standings_tiebreaker') {
      tiebreakers.push({
        type: 'stat',
        stat: b.getFieldValue('STAT') as string,
        order: b.getFieldValue('ORDER') as 'asc' | 'desc',
      });
    } else if (b.type === 'standings_h2h_conditional') {
      tiebreakers.push({ type: 'h2h_conditional', stat: b.getFieldValue('STAT') as string, order: b.getFieldValue('ORDER') as 'asc' | 'desc' });
    }
  }

  return { statDefs, columns, tiebreakers };
}
