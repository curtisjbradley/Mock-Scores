import * as Blockly from 'blockly';

export type TiebreakerRule =
  | { type: 'stat'; stat: string; order: 'asc' | 'desc' }
  | { type: 'head_to_head_conditional' };

/**
 * Walks the top-level statement stack in the workspace and produces
 * an ordered array of tiebreaker rules.
 */
export function workspaceToTiebreakerRules(ws: Blockly.Workspace): TiebreakerRule[] {
  const rules: TiebreakerRule[] = [];

  // Find the first top-level block (no previous connection)
  const topBlocks = ws.getTopBlocks(true);
  if (topBlocks.length === 0) return rules;

  let block: Blockly.Block | null = topBlocks[0];
  while (block) {
    if (block.type === 'tiebreaker_rule') {
      rules.push({
        type: 'stat',
        stat: block.getFieldValue('STAT') as string,
        order: block.getFieldValue('ORDER') as 'asc' | 'desc',
      });
    } else if (block.type === 'tiebreaker_h2h_conditional') {
      rules.push({ type: 'head_to_head_conditional' });
    }
    block = block.getNextBlock();
  }

  return rules;
}
