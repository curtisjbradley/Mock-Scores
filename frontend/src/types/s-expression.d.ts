declare module 's-expression' {
  /**
   * A parsed S-expression node.
   * - Atoms (symbols) are plain `string`s.
   * - String literals (delimited by `"`) are `String` objects, distinguishable
   *   from atoms via `instanceof String`.
   * - Lists are arrays of nodes.
   */
  export type SNode = string | string | SNode[];

  /**
   * Parse a single complete S-expression. Returns the parsed value, or an
   * `Error` (with extra `line`/`col` properties) if the input is malformed.
   */
  export default function parse(input: string): SNode | Error;
}
