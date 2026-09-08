import { parseDsl, serializeConfig } from './src/organizer/blockly/standingsDsl.ts';
import { computeStandings } from './src/organizer/blockly/standingsEngine.ts';
import { dummyTeams } from './src/organizer/blockly/dummyTeams.ts';

const SLO = `(config
  (intermediate "Win" sum (if (> (pairing points_for) (pairing points_against)) 1 (if (= (pairing points_for) (pairing points_against)) (pairing won_presider_tb) 0)))
  (stat "Wins" sum (intermediate "Win"))
  (team-stat "Pct" (/ (team points_for) (+ (team points_for) (team points_against))))
  (columns (column "Wins" "Wins") (column "Pct" "% Points"))
  (tiebreakers (by "Wins" desc) (h2h "Win" desc) (by "Pct" desc)))`;

function assert(c, m) { if (!c) { console.error('FAIL:', m); process.exit(1); } }

const cfg = parseDsl(SLO);
for (const d of cfg.statDefs) console.log(d.name, '=>', d.expr, d.intermediate?'[int]':'', d.teamLevel?'[team]':'');
console.log('cols', JSON.stringify(cfg.columns));
console.log('tbs', JSON.stringify(cfg.tiebreakers));

assert(cfg.statDefs.find(d => d.name === 'Win')?.intermediate === true, 'Win intermediate');
assert(cfg.statDefs.find(d => d.name === 'Pct')?.teamLevel === true, 'Pct team');
assert(cfg.tiebreakers[0].type === 'stat' && cfg.tiebreakers[0].stat === 'Wins', 'tb1 wins');
assert(cfg.tiebreakers[1].type === 'h2h_conditional' && cfg.tiebreakers[1].stat === 'Win', 'tb2 h2h Win');
assert(cfg.tiebreakers[2].type === 'stat' && cfg.tiebreakers[2].stat === 'Pct', 'tb3 pct');

// roundtrip
const cfg2 = parseDsl(serializeConfig(cfg));
assert(JSON.stringify(cfg) === JSON.stringify(cfg2), 'roundtrip\n' + serializeConfig(cfg));

// compute
const rows = computeStandings(dummyTeams, cfg);
console.log('\nStandings:');
for (const r of rows) console.log(' ', r.code, 'Wins=', r['Wins'], 'Pct=', typeof r['Pct'] === 'number' ? r['Pct'].toFixed(4) : r['Pct']);
for (const r of rows) {
  assert(typeof r['Wins'] === 'number' && !Number.isNaN(r['Wins']), `Wins numeric ${r.code}`);
  assert(typeof r['Pct'] === 'number' && !Number.isNaN(r['Pct']), `Pct numeric ${r.code}`);
}
console.log('\nSLO DSL OK');
console.log('\nSerialized:\n' + serializeConfig(cfg));
