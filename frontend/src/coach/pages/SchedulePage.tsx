import { useNavigate } from 'react-router-dom'
import { formatDate } from '../../utils/format'
import EmptyState from '../../shared/components/EmptyState'
import { useCoachContext } from '../CoachContext'
import RoundGroup from '../components/RoundGroup'
import '../styles/schedule.css'
import StatusChip from "../../shared/components/StatusChip.tsx";
import Tooltip from "../../shared/components/Tooltip.tsx"
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
                            {round.locked && <Tooltip content={"This round is locked. Role assignments and call orders can no longer be edited."}><StatusChip variant={"submitted"} label={"Locked"} /></Tooltip> }
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
                                                        {p.has_assignments ? 'Roles Assigned' : 'Copied Default Roles'}
                                                    </button>
                                                    <button className="org-new-btn coach-btn-submitted" disabled>
                                                        {p.has_call_order ? 'Call Order Set' : 'Copied Default Call Order'}
                                                    </button>
                                                </>
                                            ) : (
                                                // Until the round is locked, coaches can freely (re-)edit both
                                                // their role assignments and witness call order, so these stay
                                                // clickable even after an initial entry has been saved.
                                                <>
                                                    <button
                                                        className={`org-new-btn${p.has_assignments ? ' coach-btn-set' : ''}`}
                                                        onClick={() => onAssignRoles(p.pairing_id, side)}
                                                    >
                                                        {p.has_assignments ? 'Edit roles' : 'Assign Roles'}
                                                    </button>
                                                    <button
                                                        className={`org-new-btn${p.has_call_order ? ' coach-btn-set' : ''}`}
                                                        onClick={() => onWitnessOrder(p.pairing_id)}
                                                    >
                                                        {p.has_call_order ? 'Edit call order' : 'Assign Call Order'}
                                                    </button>
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
