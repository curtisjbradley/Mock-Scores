import type { ICoachScheduleRound } from '@mock-scores/shared'

const fmt = (d: string | Date) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

interface Props {
    schedule: ICoachScheduleRound[]
    teamId?: string
    onAssignRoles?: (pairingId: string, side: 'p' | 'd') => void
    onWitnessOrder?: (pairingId: string) => void
}

export default function ScheduleTab({ schedule, teamId, onAssignRoles, onWitnessOrder }: Props) {
    if (schedule.length === 0) return <p className="coach-empty">No schedule published yet.</p>
    return (
        <>
            {schedule.map(round => (
                <div key={round.round_id} style={{ marginBottom: 16 }}>
                    <h3 style={{ margin: '8px 0 6px' }}>{round.name} {round.round_time ? ` — ${fmt(round.round_time)}` : '(Time TBD)'}</h3>
                    <table className="dash-standings-table">
                        <thead><tr><th>Prosecution</th><th>Defense</th><th>Courtroom</th>{(onAssignRoles || onWitnessOrder) && <th></th>}</tr></thead>
                        <tbody>{round.pairings.map(p => {
                            const side: 'p' | 'd' = teamId && p.d_team_id === teamId ? 'd' : 'p'
                            return (
                                <tr key={p.pairing_id}>
                                    <td>{p.p_team_code} — {p.p_team_name}</td>
                                    <td>{p.d_team_code} — {p.d_team_name}</td>
                                    <td>{p.courtroom_name ?? 'TBD'}</td>
                                    {(onAssignRoles || onWitnessOrder) && (
                                        <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            {onAssignRoles && (
                                                <button className="org-new-btn" onClick={() => onAssignRoles(p.pairing_id, side)}>
                                                    Assign Roles
                                                </button>
                                            )}
                                            {onWitnessOrder && (
                                                <button className="org-new-btn" onClick={() => onWitnessOrder(p.pairing_id)}>
                                                    Witness Call Order
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            )
                        })}</tbody>
                    </table>
                </div>
            ))}
        </>
    )
}
