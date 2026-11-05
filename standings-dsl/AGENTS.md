# Standings DSL guidance

## Invariants

- The serialized S-expression DSL in `standings_configs.standings_dsl` is the source of truth. Blockly is an optional visual editor and must round-trip DSL/configuration without changing meaning.
- `parseDsl(text)` must either throw a specific DSL error or return a configuration guaranteed to be interpretable.
- The interpreter evaluates the typed `Expr` AST directly. Never use `eval` or `new Function`.
- Preserve exhaustive handling of AST/operator/aggregation variants with `assertNever`; adding a variant must require all evaluators and serializers to be updated.

## Layout

- `src/types.ts` defines configuration types, the typed AST, and builtin registries.
- `src/errors.ts` defines the DSL error hierarchy and `assertNever`.
- `src/dsl.ts` parses and serializes DSL text.
- `src/interp.ts` parses/computes standings. `interp` is the public parse-and-compute entry point; `computeStandings` is lower level.
- `src/blockly-xml.ts` is Blockly-free conversion between config and workspace XML.
- `src/react/` is the optional-peer-dependency React/Blockly UI, exposed from `@mock-scores/standings-dsl/react`. Keep the core entry point framework-free.

## Tiebreakers and tests

- Tiebreakers use tie-group partitioning so each rule refines only teams still tied. Preserve `when-tied` behavior and rank-method semantics (`average`, `min`, `max`, `first`, `dense`).
- Maintain the configuration/XML homomorphism: `workspaceXmlToConfig(configToWorkspaceXml(C))` must deep-equal every DSL-valid configuration `C`.
- Tests are Jest + ts-jest in `src/__tests__/`. Run `npm test -w standings-dsl` for DSL changes.
