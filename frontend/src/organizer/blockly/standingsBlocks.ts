import * as Blockly from 'blockly';

// Per-pairing fields available in the per-pairing expression
export const PAIRING_FIELDS: [string, string][] = [
  ['Ballots Won',              'ballots_won'],
  ['Ballots Lost',             'ballots_lost'],
  ['Ballots Tied',             'ballots_tied'],
  ['Points For (sum)',         'points_for'],
  ['Points Against (sum)',     'points_against'],
  ['Won Presider Tiebreaker',  'won_presider_tb'],  // 1 or 0
];

// Per-ballot fields (aggregated within a pairing via sum)
export const BALLOT_FIELDS: [string, string][] = [
  ['Points For',          'ballot_pf'],
  ['Points Against',      'ballot_pa'],
  ['Point Differential',  'ballot_pd'],   // pf - pa per ballot
  ['Raw Total (PF)',      'ballot_raw'],  // pf per ballot (for raw points tiebreaker)
];

export const AGGREGATES: [string, string][] = [
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
    { type: 'field_input',    name: 'NAME',  text: 'Trimmed PD' },
    { type: 'field_dropdown', name: 'AGG',   options: AGGREGATES },
    { type: 'input_value',    name: 'VALUE', check: 'Number' },
    { type: 'field_number',   name: 'TRIM',  value: 1, min: 1, max: 10, precision: 1 },
  ],
  colour: 260,
  tooltip: 'Aggregate after dropping the N highest and N lowest per-ballot values. Used for AMTA trimmed PD/raw points tiebreakers.',
};

// Shared mutable options — updated by StandingsBuilder after loading XML
export const dynamicOptions = {
  col: [['(none)', '__none__']] as [string, string][],
  tb: [['(none)', '__none__']] as [string, string][],
  intermediate: [['(none)', '__none__']] as [string, string][],
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
    { type: 'field_dropdown', name: 'STAT',  options: () => dynamicOptions.col },
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
    { type: 'field_dropdown', name: 'STAT',  options: () => dynamicOptions.tb },
    { type: 'field_dropdown', name: 'ORDER', options: [['highest first', 'desc'], ['lowest first', 'asc']] },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 230,
  tooltip: 'Stack tiebreaker blocks in priority order.',
};

const standingsH2h = {
  type: 'standings_h2h_conditional',
  message0: 'if 2-way tie: head-to-head %1 %2',
  args0: [
    { type: 'field_dropdown', name: 'STAT',  options: () => dynamicOptions.intermediate },
    { type: 'field_dropdown', name: 'ORDER', options: [['higher wins', 'desc'], ['lower wins', 'asc']] },
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 120,
  tooltip: 'If exactly two teams are tied, compare their head-to-head value for the chosen intermediate stat.',
};

const tiebreakerOrder = {
  type: 'tiebreaker_order',
  message0: 'Define Tiebreaker Order',
  nextStatement: null,
  colour: 20,
  tooltip: 'Root block for tiebreaker priority. Only one may exist.',
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
    { type: 'field_input', name: 'NAME', text: 'Win' },
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

export const standingsBlockDefs = Blockly.common.createBlockDefinitionsFromJsonArray([
  pairingField,
  ballotField,
  statHat,
  teamStatHat,
  trimmedStat,
  statRef,
  opponentStat,
  intermediateStatHat,
  intermediateRef,
  standingsColumn,
  standingsTiebreaker,
  standingsH2h,
  tiebreakerOrder,
  defineVisibleStats,
]);
