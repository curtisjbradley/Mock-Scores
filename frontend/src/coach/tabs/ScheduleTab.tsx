import type { ICoachScheduleRound } from '@mock-scores/shared'

const fmt = (d: string | Date) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

export default function ScheduleTab({ schedule }: { schedule: ICoachScheduleRound[] }) {
    if (schedule.length === 0) return <p className="coach-empty">No schedule published yet.</p>
    return (
        <>
            {schedule.map(round => (
                <div key={round.round_id} style={{ marginBottom: 16 }}>
                    <h3 style={{ margin: '8px 0 6px' }}>{round.name}{round.round_time ? ` — ${fmt(round.round_time)}` : ''}</h3>
                    <table className="dash-standings-table">
                        <thead><tr><th>Prosecution</th><th>Defense</th><th>Courtroom</th></tr></thead>
                        <tbody>{round.pairings.map(p => (
                            <tr key={p.pairing_id}>
                                <td>{p.p_team_code} — {p.p_team_name}</td>
                                <td>{p.d_team_code} — {p.d_team_name}</td>
                                <td>{p.courtroom_name ?? '—'}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            ))}
        </>
    )
}
