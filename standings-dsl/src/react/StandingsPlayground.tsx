import { useState } from 'react';
import StandingsBuilder from './StandingsBuilder.js';
import StandingsPreview from './StandingsPreview.js';
import TiebreakerViewer from './TiebreakerViewer.js';
import { AMTA_DEMO_DSL } from './demoConfigs.js';
import type { StandingsConfig } from '@mock-scores/standings-dsl';
import './styles.css';

const EMPTY: StandingsConfig = { statDefs: [], columns: [], tiebreakers: { method: 'first', rules: [] } };

export interface StandingsPlaygroundProps {
  /** Initial DSL to load into the editor. Defaults to the AMTA demo config. */
  initialDsl?: string;
}

/**
 * Self-contained Blockly + DSL standings playground for the docs.
 *
 * Combines the block editor, a live preview computed on built-in dummy data,
 * and a human-readable tiebreaker summary. Everything runs in the browser — no
 * tournament data or backend required — so readers can experiment with stats
 * and tiebreakers and watch the standings re-rank in real time.
 */
export default function StandingsPlayground({ initialDsl = AMTA_DEMO_DSL }: StandingsPlaygroundProps) {
  const [config, setConfig] = useState<StandingsConfig>(EMPTY);
  const [dsl, setDsl] = useState(initialDsl);

  return (
    <div className="sb-playground not-content">
      <StandingsPreview config={config} />
      <StandingsBuilder
        initialDsl={initialDsl}
        onChange={(cfg, nextDsl) => { setConfig(cfg); setDsl(nextDsl); }}
      />
      <TiebreakerViewer dsl={dsl} />
    </div>
  );
}
