import * as Blockly from 'blockly';

// Per-pairing fields available in the per-pairing expression
const PAIRING_FIELDS: [string, string][] = [
  ['Ballots Won',              'ballots_won'],
  ['Ballots Lost',             'ballots_lost'],
  ['Ballots Tied',             'ballots_tied'],
  ['Points For (sum)',         'points_for'],
  ['Points Against (sum)',     'points_against'],
  ['Number of Ballots', 'num_ballots'],
  ['Number of Scorers', 'num_scorers'],
  ['Won Presider Tiebreaker',  'won_presider_tb'],  // 1 or 0
];

// Team-level fields — evaluated once per team (not per pairing). Mirrors the
// DSL `TEAM_FIELDS` registry so every `(team ...)` reference is representable.
const TEAM_FIELDS: [string, string][] = [
  ['Ballots Won',             'ballots_won'],
  ['Ballots Lost',            'ballots_lost'],
  ['Ballots Tied',            'ballots_tied'],
  ['Points For',              'points_for'],
  ['Points Against',          'points_against'],
  ['Won Presider Tiebreaker', 'won_presider_tb'],
  ['Ballot Points For',       'ballot_pf'],
  ['Ballot Points Against',   'ballot_pa'],
  ['Ballot Point Diff',       'ballot_pd'],
  ['Ballot Raw Total',        'ballot_raw'],
  ['Number of Scorers',       'num_scorers'],
  ['Number of Pairings',      'num_pairings'],
];

// Per-ballot fields (aggregated within a pairing via sum)
const BALLOT_FIELDS: [string, string][] = [
  ['Points For',          'ballot_pf'],
  ['Points Against',      'ballot_pa'],
  ['Point Differential',  'ballot_pd'],   // pf - pa per ballot
  ['Raw Total (PF)',      'ballot_raw'],  // pf per ballot (for raw points tiebreaker)
];

const AGGREGATES: [string, string][] = [
  ['sum',   'sum'],
  ['avg',   'avg'],
  ['max',   'max'],
  ['min',   'min'],
  ['count', 'count'],
];

// Raw per-pairing value — returns Number
const pairingField = {
  type: 'pairing_field',
  message0: 'pairing: %1',
  args0: [{ type: 'field_dropdown', name: 'FIELD', options: PAIRING_FIELDS }],
  output: 'Number',
  colour: 65,
  tooltip: 'A raw value from each pairing (evaluated once per pairing).',
};

// Raw team-level value — returns Number (evaluated once per team)
const teamField = {
  type: 'team_field',
  message0: 'team: %1',
  args0: [{ type: 'field_dropdown', name: 'FIELD', options: TEAM_FIELDS }],
  output: 'Number',
  colour: 65,
  tooltip: 'A team-level value (evaluated once per team, e.g. number of pairings played).',
};

// Raw per-ballot value — returns Number (sum across ballots in the pairing)
const ballotField = {
  type: 'ballot_field',
  message0: 'ballot: %1',
  args0: [{ type: 'field_dropdown', name: 'FIELD', options: BALLOT_FIELDS }],
  output: 'Number',
  colour: 45,
  tooltip: 'A per-ballot value, summed across all ballots in the pairing.',
};

// "Define Stat [name] [agg] of [expr]" — standalone hat block, multiple allowed
const statHat = {
  type: 'stat_hat',
  message0: 'Define Stat %1 = %2 of %3',
  args0: [
    { type: 'field_input',    name: 'NAME', text: 'My Stat' },
    { type: 'field_dropdown', name: 'AGG',  options: AGGREGATES },
    { type: 'input_value',    name: 'VALUE', check: 'Number' },
  ],
  colour: 290,
  tooltip: 'Define a stat by aggregating a per-pairing expression.',
};

// Team-level derived stat — expression uses already-computed stats, no aggregation
const teamStatHat = {
  type: 'team_stat_hat',
  message0: 'Define Stat %1 as %2',
  args0: [
    { type: 'field_input',  name: 'NAME',  text: 'My Stat' },
    { type: 'input_value',  name: 'VALUE', check: 'Number' },
  ],
  colour: 290,
  tooltip: 'Define a team-level stat as a formula over other stats (e.g. Wins + 1).',
};

// Trimmed stat — drop N best and N worst ballot values before aggregating
const trimmedStat = {
  type: 'trimmed_stat',
  message0: 'Define Stat %1 = %2 of %3 dropping %4 best and worst',
  args0: [
    { type: 'field_input',    name: 'NAME',  text: 'Trimmed Stat' },
    { type: 'field_dropdown', name: 'AGG',   options: AGGREGATES },
    { type: 'input_value',    name: 'VALUE', check: 'Number' },
    { type: 'field_number',   name: 'TRIM',  value: 1, min: 0, max: 10, precision: 1 },
  ],
  colour: 260,
  tooltip: 'Aggregate after dropping the N highest and N lowest per-ballot values. Used for AMTA trimmed PD/raw points tiebreakers.',
};

/** Shared mutable options — updated by StandingsBuilder after loading XML */
export const dynamicOptions = {
  /** Declared stats only — for stat_ref / opponent (DSL `resolvesAsStat`). */
  col: [['(none)', '__none__']] as [string, string][],
  /** Declared stats OR intermediates — for column / h2h selectors. */
  statOrInter: [['(none)', '__none__']] as [string, string][],
  intermediate: [['(none)', '__none__']] as [string, string][],
};

// Unary math function — maps 1:1 to the DSL `call` node (MATH_FNS). We define
// our own block (rather than Blockly's built-in math_single) so the dropdown
// values match the DSL function set exactly, guaranteeing a lossless round-trip.
const mathSingle = {
  type: 'math_single',
  message0: '%1 of %2',
  args0: [
    {
      type: 'field_dropdown',
      name: 'OP',
      options: [
        ['square root', 'ROOT'],
        ['absolute value', 'ABS'],
        ['negate', 'NEG'],
        ['natural log (ln)', 'LN'],
        ['log base 10', 'LOG10'],
        ['e^x (exp)', 'EXP'],
        ['10^x', 'POW10'],
      ],
    },
    { type: 'input_value', name: 'NUM', check: 'Number' },
  ],
  output: 'Number',
  colour: 230,
  tooltip: 'Apply a unary math function (sqrt, abs, negate, ln, log10, exp, 10^x).',
};

// Reference a user-defined stat by name — returns Number
const statRef = {
  type: 'stat_ref',
  message0: 'stat %1',
  args0: [{ type: 'field_dropdown', name: 'NAME', options: () => dynamicOptions.col }],
  output: 'Number',
  colour: 290,
  tooltip: 'Reference a previously defined stat.',
};

// Opponent's stat value for this pairing — enables Combined Strength
const opponentStat = {
  type: 'opponent_stat',
  message0: "opponent's %1",
  args0: [{ type: 'field_dropdown', name: 'NAME', options: () => dynamicOptions.col }],
  output: 'Number',
  colour: 180,
  tooltip: "The opponent's value for a defined stat in this pairing. Use with sum to compute Combined Strength.",
};

const standingsColumn = {
  type: 'standings_column',
  message0: 'show column %1 labeled %2',
  args0: [
    { type: 'field_dropdown', name: 'STAT',  options: () => dynamicOptions.statOrInter },
    { type: 'field_input',    name: 'LABEL', text: '' },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 160,
  tooltip: 'Add a column to the standings table.',
};

const standingsTiebreaker = {
  type: 'standings_tiebreaker',
  message0: 'break ties by %1 %2',
  args0: [
    { type: 'field_dropdown', name: 'STAT',  options: () => dynamicOptions.col },
    { type: 'field_dropdown', name: 'ORDER', options: [['highest first', 'desc'], ['lowest first', 'asc']] },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 230,
  tooltip: 'Stack tiebreaker blocks in priority order. Tiebreakers may only use defined stats, not intermediates.',
};

const standingsH2h = {
  type: 'standings_h2h_conditional',
  message0: 'break ties head-to-head by %1 %2',
  args0: [
    { type: 'field_dropdown', name: 'STAT',  options: () => dynamicOptions.statOrInter },
    { type: 'field_dropdown', name: 'ORDER', options: [['higher wins', 'desc'], ['lower wins', 'asc']] },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 120,
  tooltip: 'Break ties by the head-to-head result on the chosen stat or intermediate (each pair of tied teams is compared by how they did against each other). Applies to a tie group of any size; wrap in an "if N to M teams are tied" block to limit it to two-way ties.',
};

const standingsAlpha = {
  type: 'standings_alpha',
  message0: 'break ties alphabetically by team %1 %2',
  args0: [
    { type: 'field_dropdown', name: 'FIELD', options: [['code', 'code'], ['name', 'name']] },
    { type: 'field_dropdown', name: 'ORDER', options: [['A \u2192 Z', 'asc'], ['Z \u2192 A', 'desc']] },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 290,
  tooltip: 'Break remaining ties alphabetically by team code or name.',
};

const standingsWhenTied = {
  type: 'standings_when_tied',
  message0: 'if %1 to %2 teams are tied, then %3',
  args0: [
    { type: 'field_number', name: 'MIN', value: 2, min: 0, precision: 1 },
    { type: 'field_number', name: 'MAX', value: 999, min: 0, precision: 1 },
    { type: 'input_statement', name: 'RULES' },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 50,
  tooltip: 'Apply the nested tiebreaker rules only when the number of tied teams is within the given range.',
};

const tiebreakerOrder = {
  type: 'tiebreaker_order',
  message0: 'Define Tiebreaker Order %1 final ranking %2',
  args0: [
    { type: 'input_dummy' },
    {
      type: 'field_dropdown',
      name: 'METHOD',
      options: [
        ['sequential (no ties)', 'first'],
        ['min rank for ties', 'min'],
        ['max rank for ties', 'max'],
        ['average rank for ties', 'average'],
        ['dense (no gaps)', 'dense'],
      ],
    },
  ],
  nextStatement: null,
  colour: 20,
  tooltip: 'Root block for tiebreaker priority. Only one may exist. The "final ranking" method decides how still-tied teams are numbered (like pandas rank).',
};

const defineVisibleStats = {
  type: 'define_visible_stats',
  message0: 'Define Visible Stats',
  nextStatement: null,
  colour: 160,
  tooltip: 'Chain "show column" blocks below this to set which stats appear in standings and in what order.',
};

// Intermediate pairing-level stat — computed per-pairing, referenceable in other per-pairing expressions
const intermediateStatHat = {
  type: 'intermediate_stat_hat',
  message0: 'Define Intermediate Stat %1 = %2',
  args0: [
    { type: 'field_input', name: 'NAME', text: 'My Intermediate Stat' },
    { type: 'input_value', name: 'VALUE', check: 'Number' },
  ],
  colour: 210,
  tooltip: 'Define a variable computed at the pairing level. Reference it with "intermediate" blocks inside other per-pairing expressions, or aggregate it with a Define Stat block.',
};

// Reference an intermediate pairing-level stat — only valid inside per-pairing expressions
const intermediateRef = {
  type: 'intermediate_ref',
  message0: 'intermediate %1',
  args0: [{ type: 'field_dropdown', name: 'NAME', options: () => dynamicOptions.intermediate }],
  output: 'Number',
  colour: 210,
  tooltip: 'Reference an intermediate pairing-level stat defined by a "Define Intermediate Stat" block.',
};

/**
 * All standings Blockly block definitions. Register these with
 * `Blockly.common.defineBlocks(standingsBlockDefs)` before using any
 * standings workspace.
 */
export const standingsBlockDefs = Blockly.common.createBlockDefinitionsFromJsonArray([
  pairingField,
  teamField,
  ballotField,
  statHat,
  teamStatHat,
  trimmedStat,
  statRef,
  opponentStat,
  intermediateStatHat,
  intermediateRef,
  mathSingle,
  standingsColumn,
  standingsTiebreaker,
  standingsH2h,
  standingsAlpha,
  standingsWhenTied,
  tiebreakerOrder,
  defineVisibleStats,
]);
