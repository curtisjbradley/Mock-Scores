// @mock-scores/standings-dsl
//
// Blockly-free standings/tiebreaker DSL: typed AST, parser/serializer, specific
// error hierarchy, and the interpreter. The frontend Blockly editor converts
// to/from the `StandingsConfig` shape re-exported here, but the parse/compute
// paths carry no editor dependency.
//
// `parseDsl` validates fields, references, arity, and enum tokens, producing a
// typed `Expr` AST. A string that passes `parseDsl` is guaranteed interpretable.

export type {
  // Config shape
  StatDef,
  ColumnConfig,
  TiebreakerRule,
  TiebreakerConfig,
  StandingsConfig,
  // Expression AST
  Expr,
  NumberExpr,
  PairingFieldExpr,
  TeamFieldExpr,
  StatRefExpr,
  IntermediateRefExpr,
  OpponentRefExpr,
  ArithExpr,
  CompareExpr,
  LogicExpr,
  IfExpr,
  CallExpr,
  // Enums / unions
  Agg,
  Order,
  RankMethod,
  AlphaField,
  ArithOp,
  CompareOp,
  LogicOp,
  MathFn,
  PairingField,
  TeamField,
} from './types.js';

export {
  // Builtin registries (authoritative valid-field lists)
  PAIRING_FIELDS,
  TEAM_FIELDS,
  AGGS,
  ORDERS,
  RANK_METHODS,
  ALPHA_FIELDS,
  ARITH_OPS,
  COMPARE_OPS,
  LOGIC_OPS,
  MATH_FNS,
} from './types.js';

export { parseDsl, serializeConfig, serializeExpr } from './dsl.js';

export {
  configToWorkspaceXml,
  workspaceXmlToConfig,
  parseXml,
  type XmlNode,
} from './blockly-xml.js';

export {
  DslError,
  DslSyntaxError,
  DslStructureError,
  DslArityError,
  DslUnknownFormError,
  DslInvalidTokenError,
  DslReferenceError,
  DslDuplicateError,
  DslNumberError,
  DslInternalError,
  assertNever,
} from './errors.js';

export { interp, computeStandings, type TeamStats } from './interp.js';
