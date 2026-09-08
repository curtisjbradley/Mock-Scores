import { useNavigate } from 'react-router-dom'
import { formatDate } from '../../utils/format'
import EmptyState from '../../shared/components/EmptyState'
import { useCoachContext } from '../CoachContext'
import RoundGroup from '../components/RoundGroup'
import '../styles/schedule.css'

/**
 * Schedule page. Reads the tournament and schedule from the shared
 * `CoachLayout` context, and links out to role-assignment and
 * witness-call-order flows.
 */
export default function SchedulePage() {
    const { tournamentId, teamId, tournament, schedule, isOrganizerView } = useCoachContext()
    const navigate = useNavigate()

    const onAssignRoles = (pairingId: string, side: 'p' | 'd') => navigate(
        isOrganizerView
            ? `/organizer/${tournamentId}/school/${teamId}/assign-roles/${pairingId}/${side}`
            : `/coach/${teamId}/assign-roles/${pairingId}/${side}`
    )

    const onWitnessOrder = (pairingId: string) => {
        const pairing = schedule.flatMap(r => r.pairings).find(p => p.pairing_id === pairingId)
        const side = pairing?.d_team_code === tournament.team_code ? 'd' : 'p'
        navigate(isOrganizerView
            ? `/organizer/${tournamentId}/school/${teamId}/witness-order/${pairingId}?side=${side}`
            : `/coach/${teamId}/witness-order/${pairingId}?side=${side}`)
    }

    if (schedule.length === 0) return <EmptyState message="No schedule published yet." />

    return (
        <>
            {schedule.map(round => (
                <RoundGroup
                    key={round.round_id}
                    heading={
                        <>
                            {round.name}{round.round_time ? ` - ${formatDate(round.round_time)}` : ' (Time TBD)'}
                            {round.locked && <span className="coach-round-locked" title="This round is locked; call order and roles can no longer be edited."> 🔒 Locked</span>}
                        </>
                    }
                >
                    <table className="dash-standings-table">
                        <thead>
                            <tr>
                                <th>Prosecution</th>
                                <th>Defense</th>
                                <th>Courtroom</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {round.pairings.map(p => {
                                const side: 'p' | 'd' = teamId && p.d_team_id === teamId ? 'd' : 'p'
                                return (
                                    <tr key={p.pairing_id}>
                                        <td>{p.p_team_code} - {p.p_team_name}</td>
                                        <td>{p.d_team_code} - {p.d_team_name}</td>
                                        <td>{p.courtroom_name ?? 'TBD'}</td>
                                        <td className="coach-schedule-actions">
                                            {round.locked ? (
                                                <>
                                                    <button className="org-new-btn coach-btn-submitted" disabled>
                                                        {p.has_assignments ? '✓ Roles assigned' : 'Roles not set'}
                                                    </button>
                                                    <button className="org-new-btn coach-btn-submitted" disabled>
                                                        {p.has_call_order ? '✓ Call order set' : 'Call order not set'}
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    {p.has_assignments
                                                        ? <button className="org-new-btn coach-btn-submitted" disabled>
                                                            ✓ Roles assigned
                                                          </button>
                                                        : <button className="org-new-btn" onClick={() => onAssignRoles(p.pairing_id, side)}>
                                                            Assign Roles
                                                          </button>}
                                                    {p.has_call_order
                                                        ? <button className="org-new-btn coach-btn-submitted" disabled>
                                                            ✓ Call order set
                                                          </button>
                                                        : <button className="org-new-btn" onClick={() => onWitnessOrder(p.pairing_id)}>
                                                            Witness Call Order
                                                          </button>}
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </RoundGroup>
            ))}
        </>
    )
}
