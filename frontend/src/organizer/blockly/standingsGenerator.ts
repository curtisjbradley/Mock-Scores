// Editor-only shim: extract a StandingsConfig from the two live Blockly
// workspaces.
//
// The actual XML -> config conversion lives in `@mock-scores/standings-dsl` as
// the Blockly-free `workspaceXmlToConfig` (the other half of the config <->
// workspace-XML homomorphism, tested there). Here we only serialize the live
// Blockly workspaces to XML (the one step that genuinely needs the Blockly
// runtime) and hand the strings to the package.

import * as Blockly from 'blockly';
import {
  workspaceXmlToConfig,
  type StatDef, type ColumnConfig, type TiebreakerRule, type StandingsConfig,
} from '@mock-scores/standings-dsl';

// Re-export the DSL config types so existing frontend imports from this module
// keep working. The canonical definitions live in @mock-scores/standings-dsl.
export type { StatDef, ColumnConfig, TiebreakerRule, StandingsConfig };

/** Serialize a Blockly workspace to its XML string. */
function workspaceToXml(ws: Blockly.Workspace): string {
  return Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(ws));
}

/**
 * Extract the typed StandingsConfig from the stats + standings workspaces by
 * serializing each to XML and delegating to the package's (tested) converter.
 */
export function extractStandingsConfig(
  statsWs: Blockly.Workspace,
  standingsWs: Blockly.Workspace,
): StandingsConfig {
  return workspaceXmlToConfig({
    statsXml: workspaceToXml(statsWs),
    standingsXml: workspaceToXml(standingsWs),
  });
}
