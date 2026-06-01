import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { computeStandings } from '../../organizer/blockly/standingsEngine'
import TiebreakerViewer from '../../organizer/blockly/TiebreakerViewer'

interface Props {
    rows: ReturnType<typeof computeStandings>
    cols: { stat: string; label: string }[]
    standingsXml: string | null
}

export default function StandingsTab({ rows, cols, standingsXml }: Props) {
    const [showTiebreakers, setShowTiebreakers] = useState(false)

    if (rows.length === 0) return <p className="coach-empty">No standings available yet.</p>
    return (
        <>
            {standingsXml && (
                <div className="tab-actions">
                    <button className="sb-expand-btn" onClick={() => setShowTiebreakers(true)}>⚖ See Tiebreakers</button>
                </div>
            )}
            <table className="dash-standings-table">
                <thead><tr>
                    <th>#</th><th>Code</th><th>Team</th>
                    {cols.map(c => <th key={c.stat}>{c.label}</th>)}
                </tr></thead>
                <tbody>{rows.map((row, i) => (
                    <tr key={row.code}>
                        <td>{i + 1}</td>
                        <td className="dash-team-code">{row.code}</td>
                        <td>{row.name}</td>
                        {cols.map(c => {
                            const val = row[c.stat]
                            const num = typeof val === 'number' ? val : NaN
                            return <td key={c.stat}>{isNaN(num) ? '—' : Number.isInteger(num) ? num : num.toFixed(3)}</td>
                        })}
                    </tr>
                ))}</tbody>
            </table>
            {showTiebreakers && standingsXml && createPortal(
                <TiebreakerViewer standingsXml={standingsXml} onClose={() => setShowTiebreakers(false)} />,
                document.body
            )}
        </>
    )
}
