import { useMemo } from 'react';
import { dummyTeams } from './dummyTeams';
import { computeStandings } from './standingsEngine';
import type { StandingsConfig } from './standingsGenerator';

interface Props {
  config: StandingsConfig;
}

export default function StandingsPreview({ config }: Props) {
  const rows = useMemo(() => computeStandings(dummyTeams, config), [config]);
  const cols = config.columns;

  return (
    <div style={{ marginBottom: 24 }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Live Preview (dummy data)</h4>
      {cols.length === 0 ? (
        <p style={{ fontSize: 13, color: '#888' }}>
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
                  <td>{i + 1}</td>
                  <td className="dash-team-code">{row.code}</td>
                  <td>{row.name}</td>
                  {cols.map((c, i) => {
                    const val = row[c.stat];
                    const num = typeof val === 'number' ? val : NaN;
                    const display = isNaN(num) ? '—' : Number.isInteger(num) ? num : num.toFixed(3);
                    return <td key={i}>{display}</td>;
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
