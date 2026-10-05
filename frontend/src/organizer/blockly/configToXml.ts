// Editor-only shim: build Blockly workspace XML from a StandingsConfig.
//
// The actual conversion lives in `@mock-scores/standings-dsl` as the Blockly-free
// `configToWorkspaceXml` (one half of the config <-> workspace-XML homomorphism,
// tested there). This file exists only to preserve the `configToXml` import name
// used by StandingsBuilder.

import { configToWorkspaceXml, type StandingsConfig } from '@mock-scores/standings-dsl';

/** Produce `{ statsXml, standingsXml }` workspace XML for a StandingsConfig. */
export function configToXml(config: StandingsConfig): { statsXml: string; standingsXml: string } {
  return configToWorkspaceXml(config);
}
