import { StandingsPlayground } from '@mock-scores/standings-dsl/react';
import '@mock-scores/standings-dsl/react/styles.css';

/**
 * Docs island: the interactive Blockly + DSL standings playground.
 *
 * Rendered client-only (Blockly needs the DOM and cannot be server-rendered).
 * The playground is fully self-contained — it computes standings on built-in
 * dummy data, so no tournament data or API is involved.
 */
export default function StandingsPlaygroundIsland() {
  return <StandingsPlayground />;
}
