import { useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { tiebreakerBlockDefs } from './tiebreakerBlocks';
import { workspaceToTiebreakerRules, type TiebreakerRule } from './tiebreakerGenerator';
import { getTheme, watchTheme } from './blocklyTheme';

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
      <div ref={divRef} style={{ height: 400, width: '100%', border: '1px solid #ccc' }} />
      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, color: '#666' }}>
          Generated tiebreaker rules ({rules.length})
        </summary>
        <pre style={{ fontSize: 12, background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
          {JSON.stringify(rules, null, 2)}
        </pre>
      </details>
    </div>
  );
}
