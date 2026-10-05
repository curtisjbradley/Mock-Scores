// Specific exception hierarchy for the standings DSL parser.
//
// Every error thrown by `parseDsl` is a `DslError` (or a subclass), so callers
// can `catch (e) { if (e instanceof DslError) ... }` broadly, or narrow to a
// specific subclass to react to a particular failure. A string that passes
// `parseDsl` without throwing is guaranteed to be interpretable: every field,
// stat/intermediate/opponent reference, operator arity, aggregation, order and
// trim value has already been validated.

/** Base class for all DSL errors. */
export class DslError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    // Restore prototype chain for `instanceof` under older/CJS transpile targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** The S-expression itself is not well-formed (unbalanced parens, etc.). */
export class DslSyntaxError extends DslError {}

/**
 * A form has the wrong structure/shape — e.g. the top level is not `(config ...)`,
 * a config entry is not a list, or a sub-form is malformed.
 */
export class DslStructureError extends DslError {}

/** An operator/form received the wrong number of operands. */
export class DslArityError extends DslError {
  constructor(op: string, expected: number, got: number) {
    super(`"${op}" expects ${expected} operand${expected === 1 ? '' : 's'}, got ${got}`);
  }
}

/** An unknown operator, config entry, or keyword was used. */
export class DslUnknownFormError extends DslError {}

/** An enum-like token (aggregation, order, field, function) was not recognized. */
export class DslInvalidTokenError extends DslError {}

/**
 * A reference does not resolve: a `(pairing X)` / `(team X)` field that does not
 * exist, or a `(stat/intermediate/opponent "X")` that no definition declares.
 */
export class DslReferenceError extends DslError {}

/** A stat/intermediate name is declared more than once. */
export class DslDuplicateError extends DslError {}

/** A numeric token (trim count, number literal) was expected but not valid. */
export class DslNumberError extends DslError {}

/**
 * Signals an unexpected/unhandled variant reached at runtime — e.g. an AST node
 * kind or operator that the type system says is impossible. Throwing here keeps
 * the `switch` statements provably exhaustive (TypeScript narrows the argument
 * to `never`) instead of relying on a silent fallback. In normal operation,
 * because `parseDsl` validates everything, this is never thrown.
 */
export class DslInternalError extends DslError {}

/**
 * Exhaustiveness guard. Call in the `default`/fall-through of a `switch` over a
 * finite union; TypeScript will error at compile time if a case is missing, and
 * at runtime it throws a `DslInternalError` describing the unexpected value.
 */
export function assertNever(value: never, context = 'value'): never {
  throw new DslInternalError(`Unexpected ${context}: ${JSON.stringify(value)}`);
}
