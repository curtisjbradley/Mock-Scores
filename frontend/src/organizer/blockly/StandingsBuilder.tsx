import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as Blockly from 'blockly';
import { standingsBlockDefs, dynamicOptions } from './standingsBlocks';
import { extractStandingsConfig, type StandingsConfig } from './standingsGenerator';

function buildStatOptions(statDefs: { name: string }[]): [string, string][] {
  const custom: [string, string][] = statDefs.map(d => [d.name, d.name]);
  return custom.length ? custom : [['(none)', '__none__']];
}

function buildTiebreakerOptions(statDefs: { name: string }[]): [string, string][] {
  const custom: [string, string][] = statDefs.map(d => [d.name, d.name]);
  return custom.length ? custom : [['(none)', '__none__']];
}

function updateDropdowns(ws: Blockly.WorkspaceSvg, colOptions: [string, string][], tbOptions: [string, string][], intermediateOptions: [string, string][]) {
  for (const block of ws.getAllBlocks(false)) {
    const setField = (fieldName: string, options: [string, string][]) => {
      const field = block.getField(fieldName) as Blockly.FieldDropdown | null;
      if (!field) return;
      const currentValue = field.getValue() as string;
      (field as unknown as { menuGenerator_: [string, string][] }).menuGenerator_ = options;
      const validValues = options.map(o => o[1]);
      if (validValues.length && !validValues.includes(currentValue)) {
        (field as unknown as { value_: string }).value_ = validValues[0];
        field.forceRerender();
      }
    };
    if (block.type === 'standings_column')     setField('STAT', colOptions);
    if (block.type === 'standings_tiebreaker') setField('STAT', tbOptions);
    if (block.type === 'stat_ref' || block.type === 'opponent_stat')
      setField('NAME', colOptions);
    if (block.type === 'intermediate_ref')
      setField('NAME', intermediateOptions);
    if (block.type === 'standings_h2h_conditional')
      setField('STAT', intermediateOptions);
  }
}

const STATS_TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category', name: 'Stats', colour: 290,
      contents: [
        { kind: 'block', type: 'stat_hat' },
        { kind: 'block', type: 'team_stat_hat' },
        { kind: 'block', type: 'trimmed_stat' },
        { kind: 'block', type: 'intermediate_stat_hat' },
        { kind: 'block', type: 'stat_ref' },
        { kind: 'block', type: 'intermediate_ref' },
        { kind: 'block', type: 'opponent_stat' },
      ],
    },
    {
      kind: 'category', name: 'Visible Columns', colour: 160,
      contents: [
        { kind: 'block', type: 'define_visible_stats' },
        { kind: 'block', type: 'standings_column' },
      ],
    },
    {
      kind: 'category', name: 'Pairing Data', colour: 65,
      contents: [
        { kind: 'block', type: 'pairing_field' },
        { kind: 'block', type: 'ballot_field' },
      ],
    },
    {
      kind: 'category', name: 'Math', colour: 230,
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_ternary' },
      ],
    },
    { kind: 'category', name: 'Variables', colour: 330, custom: 'VARIABLE' },
  ],
};

const STANDINGS_TOOLBOX = {
  kind: 'flyoutToolbox',
  contents: [
    { kind: 'block', type: 'tiebreaker_order' },
    { kind: 'block', type: 'standings_tiebreaker' },
    { kind: 'block', type: 'standings_h2h_conditional' },
  ],
};

function wsToXml(ws: Blockly.WorkspaceSvg): string {
  return Blockly.Xml.domToPrettyText(Blockly.Xml.workspaceToDom(ws));
}

function loadXmlIntoWs(ws: Blockly.WorkspaceSvg, xml: string) {
  ws.clear();
  Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xml), ws);
}

interface Props {
  onChange?: (config: StandingsConfig, xml: { statsXml: string; standingsXml: string }) => void;
  initialXml?: { statsXml: string; standingsXml: string } | null;
}

export default function StandingsBuilder({ onChange, initialXml }: Props) {
  const statsDiv = useRef<HTMLDivElement>(null);
  const standingsDiv = useRef<HTMLDivElement>(null);
  const statsWs = useRef<Blockly.WorkspaceSvg | null>(null);
  const standingsWs = useRef<Blockly.WorkspaceSvg | null>(null);
  const [, setConfig] = useState<StandingsConfig>({ statDefs: [], columns: [], tiebreakers: [] });
  const [xmlSnapshot, setXmlSnapshot] = useState('');
  const [pasteValue, setPasteValue] = useState('');
  const [pasteError, setPasteError] = useState('');

  const [wsReady, setWsReady] = useState(0);
  const [fullscreen, setFullscreen] = useState<'stats' | 'standings' | null>(null);
  const fsStatsDiv = useRef<HTMLDivElement>(null);
  const fsStandingsDiv = useRef<HTMLDivElement>(null);

  const disposedRef = useRef(false);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!statsDiv.current || !standingsDiv.current) return;
    disposedRef.current = false;

    if (!Blockly.Blocks['define_visible_stats']) Blockly.common.defineBlocks(standingsBlockDefs);
    const sws = Blockly.inject(statsDiv.current, { toolbox: STATS_TOOLBOX, scrollbars: true, trashcan: true });
    const dws = Blockly.inject(standingsDiv.current, { toolbox: STANDINGS_TOOLBOX, scrollbars: true, trashcan: true });
    statsWs.current = sws;
    standingsWs.current = dws;

    // Always place default hat blocks on mount; initialXml is loaded separately
    const visHat = sws.newBlock('define_visible_stats');
    visHat.initSvg(); visHat.render(); visHat.moveBy(20, 20);
    visHat.setDeletable(false); visHat.setMovable(false);

    const tbHat = dws.newBlock('tiebreaker_order');
    tbHat.initSvg(); tbHat.render(); tbHat.moveBy(20, 20);
    tbHat.setDeletable(false); tbHat.setMovable(false);

    setXmlSnapshot(JSON.stringify({ statsXml: wsToXml(sws), standingsXml: wsToXml(dws) }, null, 2));

    // Enforce uniqueness
    sws.addChangeListener((e: Blockly.Events.Abstract) => {
      if (e.type !== Blockly.Events.BLOCK_CREATE && e.type !== Blockly.Events.BLOCK_CHANGE) return;
      const hats = sws.getBlocksByType('define_visible_stats', false);
      if (hats.length > 1) hats[hats.length - 1].dispose(false);

      // Prevent duplicate stat names — rename duplicate to "Name 2", "Name 3", etc.
      const statBlocks = [
        ...sws.getBlocksByType('stat_hat', false),
        ...sws.getBlocksByType('trimmed_stat', false),
        ...sws.getBlocksByType('team_stat_hat', false),
      ];
      const seen = new Set<string>();
      for (const b of statBlocks) {
        let name = b.getFieldValue('NAME') as string;
        if (seen.has(name)) {
          let n = 2;
          while (seen.has(`${name} ${n}`)) n++;
          b.setFieldValue(`${name} ${n}`, 'NAME');
          name = `${name} ${n}`;
        }
        seen.add(name);
      }
    });
    dws.addChangeListener((e: Blockly.Events.Abstract) => {
      if (e.type !== Blockly.Events.BLOCK_CREATE) return;
      const hats = dws.getBlocksByType('tiebreaker_order', false);
      if (hats.length > 1) hats[hats.length - 1].dispose(false);
    });

    const sync = (e: Blockly.Events.Abstract) => {
      if (e.isUiEvent || e.type === Blockly.Events.FINISHED_LOADING) return;
      if (loadingRef.current) return;
      const cfg = extractStandingsConfig(sws, dws);
      const colOptions = buildStatOptions(cfg.statDefs.filter(d => !d.intermediate));
      const tbOptions = buildTiebreakerOptions(cfg.statDefs.filter(d => !d.intermediate));
      const intermediateOptions = buildStatOptions(cfg.statDefs.filter(d => d.intermediate));
      dynamicOptions.col = colOptions;
      dynamicOptions.tb = tbOptions;
      dynamicOptions.intermediate = intermediateOptions;
      updateDropdowns(sws, colOptions, tbOptions, intermediateOptions);
      updateDropdowns(dws, colOptions, tbOptions, intermediateOptions);
      const xml = { statsXml: wsToXml(sws), standingsXml: wsToXml(dws) };
      setConfig(cfg);
      setXmlSnapshot(JSON.stringify(xml, null, 2));
      onChange?.(cfg, xml);
    };

    sws.addChangeListener(sync);
    dws.addChangeListener(sync);

    setWsReady(n => n + 1);
    return () => {
      disposedRef.current = true; statsWs.current = null; standingsWs.current = null; sws.dispose(); dws.dispose();
      dynamicOptions.col = [['(none)', '__none__']];
      dynamicOptions.tb = [['(none)', '__none__']];
      dynamicOptions.intermediate = [['(none)', '__none__']];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load saved config once it arrives from the server
  useEffect(() => {
    if (!initialXml || !statsWs.current || !standingsWs.current || disposedRef.current) return;
    loadingRef.current = true;
    loadXmlIntoWs(statsWs.current, initialXml.statsXml);
    // Extract stat defs from the now-loaded stats workspace and populate dynamicOptions
    // so that when standingsXml is parsed, dropdown validation passes
    const cfg = extractStandingsConfig(statsWs.current, standingsWs.current);
    dynamicOptions.col = buildStatOptions(cfg.statDefs.filter(d => !d.intermediate));
    dynamicOptions.tb = buildTiebreakerOptions(cfg.statDefs.filter(d => !d.intermediate));
    dynamicOptions.intermediate = buildStatOptions(cfg.statDefs.filter(d => d.intermediate));
    loadXmlIntoWs(standingsWs.current, initialXml.standingsXml);
    loadingRef.current = false;
    setXmlSnapshot(JSON.stringify({ statsXml: wsToXml(statsWs.current), standingsXml: wsToXml(standingsWs.current) }, null, 2));
  }, [initialXml, wsReady]);

  function handlePaste() {
    try {
      const parsed = JSON.parse(pasteValue);
      if (typeof parsed?.statsXml !== 'string' || !parsed.statsXml.trim())
        throw new Error('Missing or invalid statsXml');
      if (typeof parsed?.standingsXml !== 'string' || !parsed.standingsXml.trim())
        throw new Error('Missing or invalid standingsXml');
      // Validate XML is parseable before touching workspaces
      Blockly.utils.xml.textToDom(parsed.statsXml);
      Blockly.utils.xml.textToDom(parsed.standingsXml);
      loadXmlIntoWs(statsWs.current!, parsed.statsXml);
      loadXmlIntoWs(standingsWs.current!, parsed.standingsXml);
      setPasteError('');
      setPasteValue('');
    } catch (e) {
      setPasteError((e as Error).message);
    }
  }

  // When entering/leaving fullscreen, move the Blockly workspace into the overlay div
  useEffect(() => {
    if (fullscreen === 'stats' && fsStatsDiv.current && statsWs.current) {
      statsWs.current.getInjectionDiv().style.height = '100%';
      fsStatsDiv.current.appendChild(statsWs.current.getInjectionDiv());
      Blockly.svgResize(statsWs.current);
    } else if (fullscreen === 'standings' && fsStandingsDiv.current && standingsWs.current) {
      standingsWs.current.getInjectionDiv().style.height = '100%';
      fsStandingsDiv.current.appendChild(standingsWs.current.getInjectionDiv());
      Blockly.svgResize(standingsWs.current);
    } else {
      if (statsDiv.current && statsWs.current)
        statsDiv.current.appendChild(statsWs.current.getInjectionDiv());
      if (standingsDiv.current && standingsWs.current)
        standingsDiv.current.appendChild(standingsWs.current.getInjectionDiv());
      if (statsWs.current) Blockly.svgResize(statsWs.current);
      if (standingsWs.current) Blockly.svgResize(standingsWs.current);
    }
  }, [fullscreen]);

  return (
    <div>
      <div className="sb-workspaces">
        <div>
          <div className="sb-workspace-header">
            <p className="sb-workspace-label">1. Define Stats</p>
            <button className="sb-expand-btn" onClick={() => setFullscreen('stats')}>⛶ Expand</button>
          </div>
          <div ref={statsDiv} className="sb-workspace" />
        </div>
        <div>
          <div className="sb-workspace-header">
            <p className="sb-workspace-label">2. Columns &amp; Tiebreakers</p>
            <button className="sb-expand-btn" onClick={() => setFullscreen('standings')}>⛶ Expand</button>
          </div>
          <div ref={standingsDiv} className="sb-workspace" />
        </div>
      </div>
      <details className="sb-config-details">
        <summary className="sb-config-summary">Copy / Paste Config</summary>
        <div className="sb-config-body">
          <textarea readOnly rows={6} className="sb-config-textarea" value={xmlSnapshot} />
          <p className="sb-config-hint">Paste a config below to load it:</p>
          <textarea
            rows={4}
            placeholder='{"statsXml":"...","standingsXml":"..."}'
            className="sb-config-textarea"
            value={pasteValue}
            onChange={e => setPasteValue(e.target.value)}
          />
          {pasteError && <p className="sb-config-error">{pasteError}</p>}
          {pasteValue && <button onClick={handlePaste} className="org-new-btn">Update Config</button>}
        </div>
      </details>
      {fullscreen === 'stats' && createPortal(
        <div className="sb-fullscreen-overlay">
          <div className="sb-fullscreen-header">
            <span>1. Define Stats</span>
            <button className="sb-expand-btn" onClick={() => setFullscreen(null)}>✕ Close</button>
          </div>
          <div ref={fsStatsDiv} className="sb-fullscreen-ws" />
        </div>,
        document.body
      )}
      {fullscreen === 'standings' && createPortal(
        <div className="sb-fullscreen-overlay">
          <div className="sb-fullscreen-header">
            <span>2. Columns &amp; Tiebreakers</span>
            <button className="sb-expand-btn" onClick={() => setFullscreen(null)}>✕ Close</button>
          </div>
          <div ref={fsStandingsDiv} className="sb-fullscreen-ws" />
        </div>,
        document.body
      )}
    </div>
  );
}
