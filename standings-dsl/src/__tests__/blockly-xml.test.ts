// Homomorphism tests for the Blockly workspace-XML <-> StandingsConfig mapping.
//
// The core property: for every DSL-valid config C, round-tripping through the
// Blockly workspace XML is the identity —
//     workspaceXmlToConfig(configToWorkspaceXml(C)) deep-equals C
// We assert this across the entire DSL surface (every field, operator, stat
// variant, aggregation, order, rank method, alpha field, and nested when-tied),
// so adding a DSL feature without updating the Blockly mapping fails CI here.

import {
  parseDsl, serializeConfig, configToWorkspaceXml, workspaceXmlToConfig, parseXml,
  PAIRING_FIELDS, TEAM_FIELDS, MATH_FNS, ARITH_OPS, COMPARE_OPS, LOGIC_OPS,
  AGGS, ORDERS, RANK_METHODS, ALPHA_FIELDS,
} from '../index';
import type { StandingsConfig, StatDef, TiebreakerRule } from '../index';

/** Round-trip a config through workspace XML. */
function roundTrip(config: StandingsConfig): StandingsConfig {
  return workspaceXmlToConfig(configToWorkspaceXml(config));
}

describe('workspace XML round-trip — DSL source battery', () => {
  // These sources declare dependencies before dependents, so declaration order
  // already matches the topological order the XML round-trip produces.
  const sources: string[] = [
    '(config (columns) (tiebreakers))',
    '(config (stat "Wins" sum (pairing ballots_won)) (columns (column "Wins" "W")) (tiebreakers (by "Wins" desc)))',
    '(config (stat "PD" sum (- (pairing points_for) (pairing points_against))) (columns) (tiebreakers (by "PD" desc)))',
    '(config (stat "BPF" sum (ballot ballot_pf)) (stat "BPA" sum (ballot ballot_pa)) (stat "BPD" sum (ballot ballot_pd)) (stat "BRaw" sum (ballot ballot_raw)) (columns) (tiebreakers))',
    '(config (team-stat "Games" (team num_pairings)) (columns) (tiebreakers))',
    '(config (team-stat "T" (+ (team ballots_won) (team points_for))) (columns) (tiebreakers))',
    '(config (trimmed "T0" avg 0 (pairing points_for)) (trimmed "T2" avg 2 (pairing points_for)) (columns) (tiebreakers))',
    '(config (intermediate "X" sum (pairing points_for)) (stat "SumX" sum (intermediate "X")) (columns) (tiebreakers))',
    '(config (stat "W" sum (pairing ballots_won)) (stat "Opp" sum (opponent "W")) (columns) (tiebreakers (h2h "Opp" asc)))',
    '(config (stat "Cmp" sum (> (pairing points_for) (pairing points_against))) (columns) (tiebreakers))',
    '(config (stat "Cond" sum (if (and (> (pairing points_for) 180) (< (pairing points_against) 170)) 1 0)) (columns) (tiebreakers))',
    '(config (stat "Fn" sum (+ (sqrt (pairing points_for)) (abs (neg (pairing points_against))))) (columns) (tiebreakers))',
    '(config (stat "Fn2" sum (+ (ln (pairing points_for)) (+ (log10 (pairing points_for)) (+ (exp 0) (pow10 0))))) (columns) (tiebreakers))',
    '(config (stat "W" sum (pairing ballots_won)) (columns) (tiebreakers average (by "W" desc) (alpha code asc) (alpha name desc)))',
    '(config (stat "W" sum (pairing ballots_won)) (columns) (tiebreakers dense (by "W" desc) (when-tied 2 3 (h2h "W" desc) (alpha code asc))))',
    '(config (stat "W" sum (pairing ballots_won)) (columns) (tiebreakers min (when-tied 3 999 (when-tied 2 2 (by "W" desc)))))',
    // A realistic AMTA-style config.
    `(config
      (stat "Ballots" sum (+ (pairing ballots_won) (* (pairing ballots_tied) 0.5)))
      (stat "CS" sum (opponent "Ballots"))
      (stat "PD" sum (- (pairing ballot_pf) (pairing ballot_pa)))
      (stat "OCS" sum (opponent "CS"))
      (columns (column "Ballots" "Ballots") (column "CS" "CS") (column "PD" "PD") (column "OCS" "OCS"))
      (tiebreakers first (by "Ballots" desc) (by "CS" desc) (by "PD" desc) (by "OCS" desc)))`,
  ];

  it.each(sources)('config -> XML -> config is identity (%#)', (src) => {
    const config = parseDsl(src);
    expect(roundTrip(config)).toEqual(config);
  });

  it.each(sources)('the round-tripped config re-serializes to the same DSL (%#)', (src) => {
    const config = parseDsl(src);
    const back = roundTrip(config);
    // Serializing both must agree (DSL text is a function of the config).
    expect(serializeConfig(back)).toBe(serializeConfig(config));
  });
});

describe('workspace XML round-trip — full-surface sweeps', () => {
  const base = (expr: string, agg = 'sum') =>
    parseDsl(`(config (stat "R" ${agg} ${expr}) (columns (column "R" "R")) (tiebreakers (by "R" desc)))`);

  it('covers every PAIRING_FIELD (pairing + ballot routing)', () => {
    for (const f of PAIRING_FIELDS) {
      const config = base(`(pairing ${f})`);
      expect(roundTrip(config)).toEqual(config);
    }
  });

  it('covers every TEAM_FIELD', () => {
    for (const f of TEAM_FIELDS) {
      const config = parseDsl(`(config (team-stat "R" (team ${f})) (columns (column "R" "R")) (tiebreakers (by "R" desc)))`);
      expect(roundTrip(config)).toEqual(config);
    }
  });

  it('covers every arithmetic operator', () => {
    for (const op of ARITH_OPS) {
      const config = base(`(${op} (pairing points_for) (pairing points_against))`);
      expect(roundTrip(config)).toEqual(config);
    }
  });

  it('covers every comparison operator', () => {
    for (const op of COMPARE_OPS) {
      const config = base(`(${op} (pairing points_for) (pairing points_against))`);
      expect(roundTrip(config)).toEqual(config);
    }
  });

  it('covers every logic operator', () => {
    for (const op of LOGIC_OPS) {
      const config = base(`(${op} (> (pairing points_for) 1) (< (pairing points_against) 1))`);
      expect(roundTrip(config)).toEqual(config);
    }
  });

  it('covers every unary math function', () => {
    for (const fn of MATH_FNS) {
      const config = base(`(${fn} (pairing points_for))`);
      expect(roundTrip(config)).toEqual(config);
    }
  });

  it('covers every aggregation', () => {
    for (const agg of AGGS) {
      const config = base('(pairing points_for)', agg);
      expect(roundTrip(config)).toEqual(config);
    }
  });

  it('covers both orders on every tiebreaker rule kind', () => {
    for (const order of ORDERS) {
      const config = parseDsl(`(config
        (stat "W" sum (pairing ballots_won))
        (columns)
        (tiebreakers (by "W" ${order}) (h2h "W" ${order}) (alpha code ${order}) (alpha name ${order})))`);
      expect(roundTrip(config)).toEqual(config);
    }
  });

  it('covers every rank method', () => {
    for (const method of RANK_METHODS) {
      const config = parseDsl(`(config (stat "W" sum (pairing ballots_won)) (columns) (tiebreakers ${method} (by "W" desc)))`);
      expect(roundTrip(config)).toEqual(config);
    }
  });

  it('covers every alpha field', () => {
    for (const f of ALPHA_FIELDS) {
      const config = parseDsl(`(config (stat "W" sum (pairing ballots_won)) (columns) (tiebreakers (alpha ${f} asc)))`);
      expect(roundTrip(config)).toEqual(config);
    }
  });

  it('covers deeply nested when-tied blocks', () => {
    const config = parseDsl(`(config
      (stat "W" sum (pairing ballots_won))
      (columns)
      (tiebreakers dense
        (by "W" desc)
        (when-tied 2 5
          (h2h "W" desc)
          (when-tied 2 2 (alpha code asc) (alpha name desc)))))`);
    expect(roundTrip(config)).toEqual(config);
  });
});

describe('workspace XML round-trip — edge cases', () => {
  it('topologically sorts stat defs declared out of dependency order', () => {
    // "A" references "B" declared later. parseDsl keeps declaration order; the
    // XML round-trip emits hats and re-reads them with a topo sort, so B precedes A.
    const config = parseDsl('(config (stat "A" sum (stat "B")) (stat "B" sum (pairing ballots_won)) (columns) (tiebreakers))');
    const back = roundTrip(config);
    const names = back.statDefs.map(d => d.name);
    expect(names).toEqual(['B', 'A']);
    // Same set of defs, just reordered — compare as sets of definitions.
    const sortByName = (a: StatDef, b: StatDef) => a.name.localeCompare(b.name);
    expect([...back.statDefs].sort(sortByName)).toEqual([...config.statDefs].sort(sortByName));
  });

  it('preserves quoted names needing XML escaping', () => {
    const config = parseDsl('(config (stat "A & <B>" sum (pairing ballots_won)) (columns (column "A & <B>" "L & <M>")) (tiebreakers (by "A & <B>" desc)))');
    expect(roundTrip(config)).toEqual(config);
  });

  it('drops an empty when-tied block (DSL requires >= 1 nested rule)', () => {
    // Hand-build XML with an empty when-tied statement to confirm it is dropped.
    const configWithEmpty: StandingsConfig = {
      statDefs: [{ name: 'W', agg: 'sum', expr: { kind: 'pairingField', field: 'ballots_won' } }],
      columns: [],
      tiebreakers: {
        method: 'first',
        rules: [
          { type: 'stat', stat: 'W', order: 'desc' },
          { type: 'when_tied', min: 2, max: 2, rules: [] } as TiebreakerRule,
        ],
      },
    };
    const back = roundTrip(configWithEmpty);
    expect(back.tiebreakers.rules).toEqual([{ type: 'stat', stat: 'W', order: 'desc' }]);
  });

  it('reads an empty workspace into an empty config', () => {
    const ns = 'https://developers.google.com/blockly/xml';
    const statsXml = `<xml xmlns="${ns}"><block type="define_visible_stats"></block></xml>`;
    const standingsXml = `<xml xmlns="${ns}"><block type="tiebreaker_order"><field name="METHOD">first</field></block></xml>`;
    expect(workspaceXmlToConfig({ statsXml, standingsXml })).toEqual({
      statDefs: [], columns: [], tiebreakers: { method: 'first', rules: [] },
    });
  });
});

describe('parseXml (zero-dep reader)', () => {
  it('parses nested elements, attributes, and text', () => {
    const node = parseXml('<xml a="1"><block type="t"><field name="F">hi</field></block></xml>');
    expect(node.tag).toBe('xml');
    expect(node.attrs.a).toBe('1');
    expect(node.children[0].attrs.type).toBe('t');
    expect(node.children[0].children[0].text).toBe('hi');
  });

  it('handles self-closing tags and skips declarations/comments', () => {
    const node = parseXml('<?xml version="1.0"?><!-- c --><root><empty/></root>');
    expect(node.tag).toBe('root');
    expect(node.children[0].tag).toBe('empty');
    expect(node.children[0].children).toHaveLength(0);
  });

  it('unescapes XML entities in text and attributes', () => {
    const node = parseXml('<x v="a &amp; b"><f>&lt;tag&gt; &quot;q&quot;</f></x>');
    expect(node.attrs.v).toBe('a & b');
    expect(node.children[0].text).toBe('<tag> "q"');
  });
});
