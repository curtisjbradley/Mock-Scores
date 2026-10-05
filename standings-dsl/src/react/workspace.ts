// Bridge between live Blockly workspaces and the Blockly-free XML <-> config
// converter in the package core (`blockly-xml.ts`). Serializing a live
// workspace to XML is the one step that genuinely needs the Blockly runtime;
// everything else is handled by the (unit-tested) homomorphism.

import * as Blockly from 'blockly';
import { configToWorkspaceXml, workspaceXmlToConfig, type StandingsConfig } from '@mock-scores/standings-dsl';

/** Serialize a Blockly workspace to its XML string. */
function workspaceToXml(ws: Blockly.Workspace): string {
  return Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(ws));
}

/**
 * Extract the typed StandingsConfig from the stats + standings workspaces by
 * serializing each to XML and delegating to the core converter.
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

/** Produce `{ statsXml, standingsXml }` workspace XML for a StandingsConfig. */
export function configToXml(config: StandingsConfig): { statsXml: string; standingsXml: string } {
  return configToWorkspaceXml(config);
}
