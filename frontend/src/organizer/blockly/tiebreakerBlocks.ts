import * as Blockly from 'blockly';

// "Sort by [stat] [asc/desc]" — a single tiebreaker rule, chainable
const tiebreakerRule = {
  type: 'tiebreaker_rule',
  message0: 'sort by %1 %2',
  args0: [
    {
      type: 'field_dropdown',
      name: 'STAT',
      options: [
      ],
    },
    {
      type: 'field_dropdown',
      name: 'ORDER',
      options: [
        ['highest first', 'desc'],
        ['lowest first', 'asc'],
      ],
    },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 230,
  tooltip: 'Add a tiebreaker criterion. Stack multiple to create a priority chain.',
};

// "If 2-way tie, use head-to-head" — special conditional block
const headToHeadConditional = {
  type: 'tiebreaker_h2h_conditional',
  message0: 'if 2-way tie: use head-to-head result',
  previousStatement: null,
  nextStatement: null,
  colour: 120,
  tooltip: 'If exactly two teams are tied, use their direct match result as the tiebreaker.',
};

export const tiebreakerBlockDefs = Blockly.common.createBlockDefinitionsFromJsonArray([
  tiebreakerRule,
  headToHeadConditional,
]);
