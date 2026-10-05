import { useMemo } from 'react';
import { dummyTeams } from './dummyTeams.js';
import { formatRank } from './formatRank.js';
import { computeStandings, type StandingsConfig } from '@mock-scores/standings-dsl';

export interface StandingsPreviewProps {
  config: StandingsConfig;
  /** Optional override for the sample data; defaults to the built-in dummy teams. */
  teams?: typeof dummyTeams;
}

export default function StandingsPreview({ config, teams = dummyTeams }: StandingsPreviewProps) {
  const rows = useMemo(() => computeStandings(teams, config), [config, teams]);
  const cols = config.columns;

  return (
    <div className="sb-preview">
      <h4 className="sb-preview-title">Live Preview (dummy data)</h4>
      {cols.length === 0 ? (
        <p className="sb-preview-empty">
          Add "show column" blocks under "Define Visible Stats" to see standings.
        </p>
      ) : (
        <div className="dash-table-scroll">
          <table className="dash-standings-table">
            <thead>
              <tr>
                <th>#</th><th>Code</th><th>Team</th>
                {cols.map((c, i) => <th key={i}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.code}>
                  <td>{formatRank(row.rank, i)}</td>
                  <td className="dash-team-code">{row.code}</td>
                  <td>{row.name}</td>
                  {cols.map((c, j) => {
                    const val = row[c.stat];
                    const num = typeof val === 'number' ? val : NaN;
                    const display = isNaN(num) ? '—' : Number.isInteger(num) ? num : num.toFixed(3);
                    return <td key={j}>{display}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
