import { useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { tiebreakerBlockDefs } from './tiebreakerBlocks';
import { workspaceToTiebreakerRules, type TiebreakerRule } from './tiebreakerGenerator';
import { getTheme, watchTheme } from './blocklyTheme';
import '../styles/standings.css';

Blockly.common.defineBlocks(tiebreakerBlockDefs);

const TOOLBOX = {
  kind: 'flyoutToolbox',
  contents: [
    { kind: 'block', type: 'tiebreaker_rule' },
    { kind: 'block', type: 'tiebreaker_h2h_conditional' },
  ],
};

interface Props {
  onChange?: (rules: TiebreakerRule[]) => void;
}

export default function TiebreakerBuilder({ onChange }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const [rules, setRules] = useState<TiebreakerRule[]>([]);

  useEffect(() => {
    if (!divRef.current || wsRef.current) return;

    const ws = Blockly.inject(divRef.current, {
      toolbox: TOOLBOX,
      scrollbars: true,
      trashcan: true,
      theme: getTheme(),
    });
    wsRef.current = ws;

    ws.addChangeListener((e: Blockly.Events.Abstract) => {
      if (e.isUiEvent || e.type === Blockly.Events.FINISHED_LOADING) return;
      const newRules = workspaceToTiebreakerRules(ws);
      setRules(newRules);
      onChange?.(newRules);
    });

    const unwatchTheme = watchTheme(() => wsRef.current ? [wsRef.current] : []);
    return () => {
      ws.dispose();
      wsRef.current = null;
      unwatchTheme();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div ref={divRef} className="sb-tb-canvas" />
      <details className="sb-tb-details">
        <summary className="sb-tb-summary">
          Generated tiebreaker rules ({rules.length})
        </summary>
        <pre className="sb-tb-pre">
          {JSON.stringify(rules, null, 2)}
        </pre>
      </details>
    </div>
  );
}
