import type { ICoachResultRound } from '@mock-scores/shared'

export default function ResultsTab({ results }: { results: ICoachResultRound[] }) {
    if (results.length === 0) return <p className="coach-empty">No results published yet.</p>
    return (
        <>
            {results.map(round => (
                <div key={round.round_id} style={{ marginBottom: 16 }}>
                    <h3 style={{ margin: '8px 0 6px' }}>{round.name}</h3>
                    <table className="dash-standings-table">
                        <thead><tr><th>Prosecution</th><th>P Pts</th><th>Defense</th><th>D Pts</th></tr></thead>
                        <tbody>{round.pairings.map(p => (
                            <tr key={p.pairing_id}>
                                <td>{p.p_team_code} — {p.p_team_name}</td><td><strong>{p.p_points}</strong></td>
                                <td>{p.d_team_code} — {p.d_team_name}</td><td><strong>{p.d_points}</strong></td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            ))}
        </>
    )
}
