// @mock-scores/standings-dsl/react
//
// React + Blockly UI for the standings DSL. This entry point pulls in `react`,
// `react-dom`, and `blockly` (declared as peer dependencies). The core package
// (`@mock-scores/standings-dsl`) stays framework-free; only consumers that
// import this subpath take on the UI dependencies.

export { default as StandingsBuilder, type StandingsBuilderProps } from './StandingsBuilder.js';
export { default as StandingsPreview, type StandingsPreviewProps } from './StandingsPreview.js';
export { default as TiebreakerViewer, type TiebreakerViewerProps } from './TiebreakerViewer.js';
export { default as StandingsPlayground, type StandingsPlaygroundProps } from './StandingsPlayground.js';

export { dummyTeams } from './dummyTeams.js';
export { AMTA_DEMO_DSL } from './demoConfigs.js';
export { formatRank } from './formatRank.js';
export { standingsBlockDefs, dynamicOptions } from './blocks.js';
export { getTheme, watchTheme } from './theme.js';
export { extractStandingsConfig, configToXml } from './workspace.js';
