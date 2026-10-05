import { parseDsl, serializeConfig, serializeExpr } from '../dsl';
import {
  DslError,
  DslSyntaxError,
  DslStructureError,
  DslArityError,
  DslUnknownFormError,
  DslInvalidTokenError,
  DslReferenceError,
  DslDuplicateError,
  DslNumberError,
} from '../errors';
import type { StandingsConfig } from '../types';

describe('parseDsl — AST shape', () => {
  it('returns an empty config for empty/blank input', () => {
    expect(parseDsl('')).toEqual({ statDefs: [], columns: [], tiebreakers: { method: 'first', rules: [] } });
    expect(parseDsl('   \n ')).toEqual({ statDefs: [], columns: [], tiebreakers: { method: 'first', rules: [] } });
  });

  it('parses a pairing-field stat into a typed AST', () => {
    const cfg = parseDsl('(config (stat "Wins" sum (pairing ballots_won)))');
    expect(cfg.statDefs).toEqual([
      { name: 'Wins', agg: 'sum', expr: { kind: 'pairingField', field: 'ballots_won' } },
    ]);
  });

  it('parses nested arithmetic/compare/if/call into the AST', () => {
    const cfg = parseDsl(
      '(config (stat "X" sum (if (> (pairing points_for) 180) (sqrt (pairing points_for)) 0)))',
    );
    expect(cfg.statDefs[0].expr).toEqual({
      kind: 'if',
      test: { kind: 'compare', op: '>', left: { kind: 'pairingField', field: 'points_for' }, right: { kind: 'number', value: 180 } },
      then: { kind: 'call', fn: 'sqrt', arg: { kind: 'pairingField', field: 'points_for' } },
      else: { kind: 'number', value: 0 },
    });
  });

  it('parses team-stat, intermediate, trimmed, columns, tiebreakers', () => {
    const cfg = parseDsl(`(config
      (intermediate "PD" sum (- (pairing points_for) (pairing points_against)))
      (stat "SumPD" sum (intermediate "PD"))
      (team-stat "Games" (team num_pairings))
      (trimmed "TrimPF" avg 1 (pairing points_for))
      (columns (column "SumPD" "Diff"))
      (tiebreakers (by "SumPD" desc) (h2h "SumPD" desc)))`);
    expect(cfg.statDefs.map(d => d.name)).toEqual(['PD', 'SumPD', 'Games', 'TrimPF']);
    expect(cfg.statDefs[2]).toMatchObject({ teamLevel: true });
    expect(cfg.statDefs[3]).toMatchObject({ trim: 1, agg: 'avg' });
    expect(cfg.columns).toEqual([{ stat: 'SumPD', label: 'Diff' }]);
    expect(cfg.tiebreakers).toEqual({
      method: 'first',
      rules: [
        { type: 'stat', stat: 'SumPD', order: 'desc' },
        { type: 'h2h_conditional', stat: 'SumPD', order: 'desc' },
      ],
    });
  });

  it('resolves forward references across definitions', () => {
    // "A" references "B" which is declared later — collectSymbols makes this valid.
    const cfg = parseDsl('(config (stat "A" sum (stat "B")) (stat "B" sum (pairing ballots_won)))');
    expect(cfg.statDefs[0].expr).toEqual({ kind: 'statRef', name: 'B' });
  });

  it('allows a stat reference to a team builtin field name', () => {
    const cfg = parseDsl('(config (stat "W" sum (stat "ballots_won")))');
    expect(cfg.statDefs[0].expr).toEqual({ kind: 'statRef', name: 'ballots_won' });
  });

  it('defaults a column label to the stat name when the label is omitted', () => {
    const cfg = parseDsl('(config (stat "Wins" sum (pairing ballots_won)) (columns (column "Wins")))');
    expect(cfg.columns).toEqual([{ stat: 'Wins', label: 'Wins' }]);
  });

  it('accepts a bare-atom stat name (unquoted) and reads it back', () => {
    // Exercises the isAtom branch of nameOf for a definition name.
    const cfg = parseDsl('(config (stat Wins sum (pairing ballots_won)) (columns (column Wins)))');
    expect(cfg.statDefs[0].name).toBe('Wins');
    expect(cfg.columns).toEqual([{ stat: 'Wins', label: 'Wins' }]);
  });

  it('falls back to the stat name when the column label is an empty string', () => {
    // Exercises the `label || stat` fallback branch.
    const cfg = parseDsl('(config (stat "Wins" sum (pairing ballots_won)) (columns (column "Wins" "")))');
    expect(cfg.columns).toEqual([{ stat: 'Wins', label: 'Wins' }]);
  });
});

describe('parseDsl — tiebreaker methods, alpha, when-tied', () => {
  const base = (tb: string) =>
    `(config (stat "W" sum (pairing ballots_won)) (columns) ${tb})`;

  it('defaults the rank method to "first" when none is given', () => {
    const cfg = parseDsl(base('(tiebreakers (by "W" desc))'));
    expect(cfg.tiebreakers.method).toBe('first');
    expect(cfg.tiebreakers.rules).toEqual([{ type: 'stat', stat: 'W', order: 'desc' }]);
  });

  it('parses a leading rank method token', () => {
    for (const m of ['average', 'min', 'max', 'first', 'dense'] as const) {
      const cfg = parseDsl(base(`(tiebreakers ${m} (by "W" desc))`));
      expect(cfg.tiebreakers.method).toBe(m);
    }
  });

  it('allows a method with no rules', () => {
    const cfg = parseDsl(base('(tiebreakers dense)'));
    expect(cfg.tiebreakers).toEqual({ method: 'dense', rules: [] });
  });

  it('parses an (alpha code|name ORDER) rule', () => {
    const cfg = parseDsl(base('(tiebreakers (alpha code asc) (alpha name desc))'));
    expect(cfg.tiebreakers.rules).toEqual([
      { type: 'alpha', field: 'code', order: 'asc' },
      { type: 'alpha', field: 'name', order: 'desc' },
    ]);
  });

  it('parses a nested (when-tied MIN MAX RULE...) block', () => {
    const cfg = parseDsl(base('(tiebreakers first (by "W" desc) (when-tied 2 3 (h2h "W" desc) (alpha code asc)))'));
    expect(cfg.tiebreakers.rules[1]).toEqual({
      type: 'when_tied',
      min: 2,
      max: 3,
      rules: [
        { type: 'h2h_conditional', stat: 'W', order: 'desc' },
        { type: 'alpha', field: 'code', order: 'asc' },
      ],
    });
  });

  it('supports deeply nested when-tied blocks', () => {
    const cfg = parseDsl(base('(tiebreakers (when-tied 3 999 (when-tied 2 2 (by "W" desc))))'));
    const outer = cfg.tiebreakers.rules[0];
    expect(outer.type).toBe('when_tied');
    if (outer.type === 'when_tied') {
      expect(outer.rules[0]).toMatchObject({ type: 'when_tied', min: 2, max: 2 });
    }
  });

  it('rejects an invalid rank method', () => {
    expect(() => parseDsl(base('(tiebreakers bogus (by "W" desc))'))).toThrow(DslInvalidTokenError);
  });

  it('rejects an invalid alpha field', () => {
    expect(() => parseDsl(base('(tiebreakers (alpha email asc))'))).toThrow(DslInvalidTokenError);
  });

  it('rejects a when-tied block with no nested rules', () => {
    expect(() => parseDsl(base('(tiebreakers (when-tied 2 3))'))).toThrow(DslStructureError);
  });

  it('rejects when-tied with max < min', () => {
    expect(() => parseDsl(base('(tiebreakers (when-tied 5 2 (by "W" desc)))'))).toThrow(DslNumberError);
  });

  it('rejects non-integer / negative when-tied bounds', () => {
    expect(() => parseDsl(base('(tiebreakers (when-tied -1 3 (by "W" desc)))'))).toThrow(DslNumberError);
    expect(() => parseDsl(base('(tiebreakers (when-tied 2 x (by "W" desc)))'))).toThrow(DslNumberError);
  });

  it('reference-checks stats inside a when-tied block', () => {
    expect(() => parseDsl(base('(tiebreakers (when-tied 2 3 (by "Nope" desc)))'))).toThrow(DslReferenceError);
  });

  it('still rejects an unknown tiebreaker rule keyword', () => {
    expect(() => parseDsl(base('(tiebreakers (sideways "W" desc))'))).toThrow(DslUnknownFormError);
  });
});

describe('parseDsl — specific exceptions', () => {
  it('all parser errors are DslError instances', () => {
    expect(() => parseDsl('(notconfig)')).toThrow(DslError);
  });

  it('throws DslStructureError when not a (config ...) form', () => {
    expect(() => parseDsl('(notconfig)')).toThrow(DslStructureError);
    expect(() => parseDsl('"just a string"')).toThrow(DslStructureError);
  });

  it('throws DslSyntaxError on malformed s-expressions', () => {
    expect(() => parseDsl('(config (stat "X"')).toThrow(DslSyntaxError);
  });

  it('throws DslUnknownFormError on unknown config entry or operator', () => {
    expect(() => parseDsl('(config (bogus "X"))')).toThrow(DslUnknownFormError);
    expect(() => parseDsl('(config (stat "X" sum (frobnicate 1 2)))')).toThrow(DslUnknownFormError);
  });

  it('throws DslInvalidTokenError on bad aggregation / order / bare symbol', () => {
    expect(() => parseDsl('(config (stat "X" nope (pairing points_for)))')).toThrow(DslInvalidTokenError);
    expect(() => parseDsl('(config (stat "X" sum (pairing points_for)) (tiebreakers (by "X" sideways)))')).toThrow(DslInvalidTokenError);
    expect(() => parseDsl('(config (stat "X" sum points_for))')).toThrow(DslInvalidTokenError);
  });

  it('throws DslArityError on wrong operand counts', () => {
    expect(() => parseDsl('(config (stat "X" sum (+ 1)))')).toThrow(DslArityError);
    expect(() => parseDsl('(config (stat "X" sum (sqrt 1 2)))')).toThrow(DslArityError);
    expect(() => parseDsl('(config (stat "X" sum (if 1 2)))')).toThrow(DslArityError);
  });

  it('throws DslReferenceError on unknown fields and undefined references', () => {
    expect(() => parseDsl('(config (stat "X" sum (pairing not_a_field)))')).toThrow(DslReferenceError);
    expect(() => parseDsl('(config (stat "X" sum (team not_a_field)))')).toThrow(DslReferenceError);
    expect(() => parseDsl('(config (stat "X" sum (stat "Ghost")))')).toThrow(DslReferenceError);
    expect(() => parseDsl('(config (stat "X" sum (intermediate "Ghost")))')).toThrow(DslReferenceError);
    expect(() => parseDsl('(config (stat "X" sum (opponent "Ghost")))')).toThrow(DslReferenceError);
    expect(() => parseDsl('(config (stat "X" sum (pairing points_for)) (columns (column "Ghost" "G")))')).toThrow(DslReferenceError);
    expect(() => parseDsl('(config (stat "X" sum (pairing points_for)) (tiebreakers (by "Ghost" desc)))')).toThrow(DslReferenceError);
  });

  it('rejects (by ...) on an intermediate but allows (h2h ...) on one', () => {
    const base = (tb: string) =>
      `(config (intermediate "I" sum (pairing points_for)) (stat "W" sum (pairing ballots_won)) (columns) ${tb})`;
    // `by` reads the team-level row; intermediates never land there -> reject.
    expect(() => parseDsl(base('(tiebreakers (by "I" desc))'))).toThrow(DslReferenceError);
    // `h2h` recomputes intermediates for the head-to-head pairing -> allowed.
    const cfg = parseDsl(base('(tiebreakers (h2h "I" desc))'));
    expect(cfg.tiebreakers.rules[0]).toEqual({ type: 'h2h_conditional', stat: 'I', order: 'desc' });
  });

  it('throws DslDuplicateError on repeated definition names', () => {
    expect(() => parseDsl('(config (stat "X" sum (pairing points_for)) (stat "X" sum (pairing points_against)))')).toThrow(DslDuplicateError);
  });

  it('throws DslNumberError on invalid trim count', () => {
    expect(() => parseDsl('(config (trimmed "T" avg xx (pairing points_for)))')).toThrow(DslNumberError);
    expect(() => parseDsl('(config (trimmed "T" avg -1 (pairing points_for)))')).toThrow(DslNumberError);
  });

  it('throws DslStructureError when a name token is a list', () => {
    expect(() => parseDsl('(config (stat (nested) sum (pairing points_for)))')).toThrow(DslStructureError);
  });

  it('throws DslStructureError when a keyword token is not a bare atom', () => {
    // AGG position holds a quoted literal instead of a bare keyword.
    expect(() => parseDsl('(config (stat "X" "sum" (pairing points_for)))')).toThrow(DslStructureError);
  });

  it('throws DslStructureError on a string literal in expression position', () => {
    expect(() => parseDsl('(config (stat "X" sum "literal"))')).toThrow(DslStructureError);
  });

  it('throws DslStructureError on an empty expression ()', () => {
    expect(() => parseDsl('(config (stat "X" sum ()))')).toThrow(DslStructureError);
  });

  it('throws DslDuplicateError when an intermediate reuses a stat name', () => {
    expect(() => parseDsl('(config (stat "X" sum (pairing points_for)) (intermediate "X" sum (pairing points_against)))')).toThrow(DslDuplicateError);
  });

  it('throws DslStructureError when a columns entry is not (column ...)', () => {
    expect(() => parseDsl('(config (stat "X" sum (pairing points_for)) (columns (notcolumn "X" "L")))')).toThrow(DslStructureError);
  });

  it('throws DslUnknownFormError on an unknown tiebreaker kind', () => {
    expect(() => parseDsl('(config (stat "X" sum (pairing points_for)) (tiebreakers (wat "X" desc)))')).toThrow(DslUnknownFormError);
  });

  it('throws DslStructureError when a config entry does not start with a keyword', () => {
    // The entry's head is a nested list, not an atom keyword -> head() throws.
    expect(() => parseDsl('(config ((nested) "X"))')).toThrow(DslStructureError);
  });

  it('throws DslStructureError when a config entry is not a list', () => {
    expect(() => parseDsl('(config bareatom)')).toThrow(DslStructureError);
  });

  it('throws DslInvalidTokenError when the leading tiebreakers atom is not a valid method', () => {
    // A bare atom right after `tiebreakers` is parsed as the rank METHOD now.
    expect(() => parseDsl('(config (stat "X" sum (pairing points_for)) (tiebreakers bareatom))')).toThrow(DslInvalidTokenError);
  });

  it('throws DslStructureError when a tiebreakers rule is a bare atom (not a list)', () => {
    // After the (valid) method token, remaining entries must be rule lists.
    expect(() => parseDsl('(config (stat "X" sum (pairing points_for)) (tiebreakers average bareatom))')).toThrow(DslStructureError);
  });
});

describe('serializeConfig / serializeExpr round-trip', () => {
  const samples: string[] = [
    '(config (stat "Wins" sum (pairing ballots_won)) (columns (column "Wins" "W")) (tiebreakers (by "Wins" desc)))',
    '(config (stat "PD" sum (- (pairing points_for) (pairing points_against))) (columns) (tiebreakers))',
    '(config (intermediate "X" sum (pairing points_for)) (stat "SumX" sum (intermediate "X")) (columns) (tiebreakers))',
    '(config (team-stat "Games" (team num_pairings)) (columns) (tiebreakers))',
    '(config (trimmed "T" avg 1 (pairing points_for)) (columns) (tiebreakers))',
    '(config (stat "Cmp" sum (> (pairing points_for) (pairing points_against))) (columns) (tiebreakers))',
    '(config (stat "Cond" sum (if (> (pairing points_for) 180) 1 0)) (columns) (tiebreakers))',
    '(config (stat "Fn" sum (sqrt (pairing points_for))) (columns) (tiebreakers))',
    '(config (stat "W" sum (pairing ballots_won)) (stat "Opp" sum (opponent "W")) (columns) (tiebreakers (h2h "Opp" asc)))',
    '(config (stat "Logic" sum (and (> (pairing points_for) 170) (< (pairing points_against) 180))) (columns) (tiebreakers))',
    // New tiebreaker forms: rank method, alpha ordering, when-tied nesting.
    '(config (stat "W" sum (pairing ballots_won)) (columns) (tiebreakers average (by "W" desc) (alpha code asc)))',
    '(config (stat "W" sum (pairing ballots_won)) (columns) (tiebreakers dense (by "W" desc) (when-tied 2 3 (h2h "W" desc) (alpha name asc))))',
    '(config (stat "W" sum (pairing ballots_won)) (columns) (tiebreakers min (when-tied 2 999 (by "W" desc))))',
  ];

  it.each(samples)('is value-stable: parse -> serialize -> parse equals parse (%s)', (src) => {
    const first: StandingsConfig = parseDsl(src);
    const roundTripped: StandingsConfig = parseDsl(serializeConfig(first));
    // The typed AST serializer is a clean bijection — no normalization — so the
    // first parse already equals the round-tripped parse.
    expect(roundTripped).toEqual(first);
  });

  it.each(samples)('is text-idempotent after the first serialize (%s)', (src) => {
    const once = serializeConfig(parseDsl(src));
    const twice = serializeConfig(parseDsl(once));
    expect(twice).toBe(once);
  });

  it('serializeExpr produces re-parseable text for each AST node kind', () => {
    const cfg = parseDsl(
      '(config (stat "W" sum (pairing ballots_won)) (stat "E" sum (+ (* (stat "W") 2) (neg (pow10 (team num_pairings))))))',
    );
    const expr = cfg.statDefs[1].expr;
    const text = serializeExpr(expr);
    // Wrap in a trivial stat so it parses in context, and compare the AST back.
    const reparsed = parseDsl(`(config (stat "W" sum (pairing ballots_won)) (stat "E" sum ${text}))`);
    expect(reparsed.statDefs[1].expr).toEqual(expr);
  });
});
