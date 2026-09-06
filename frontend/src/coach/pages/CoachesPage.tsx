import { useState } from 'react'
import type { ICoach } from '@mock-scores/shared'
import { ConfirmRemoveModal, AddOrganizerModal } from '../../organizer/components/modals'
import { useConfirmRemove } from '../../shared/hooks/useConfirmRemove.ts'
import StatusChip from '../../shared/components/StatusChip'
import Icon from '../../shared/components/Icon'
import DangerButton from '../../shared/components/DangerButton'
import AddButton from '../../shared/components/AddButton'
import { useCoachContext } from '../CoachContext'

/**
 * Coaches page. Reads the team's coaches from the shared `CoachLayout` context
 * and delegates the add/remove/make-owner mutations to it. Keeps only its own
 * modal UI state locally.
 */
export default function CoachesPage() {
    const { coaches, isOrganizerView, addCoach, removeCoach, makeOwner, toggleNotifications } = useCoachContext()

    const [showAdd, setShowAdd] = useState(false)
    const confirmRemove = useConfirmRemove<ICoach>()
    const confirmOwner = useConfirmRemove<ICoach>()

    return (
        <>
            <div className="tab-actions">
                <AddButton onClick={() => setShowAdd(true)}>+ Add coach</AddButton>
            </div>
            <div className="dash-table-scroll">
                <table className="dash-standings-table">
                    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Notifications</th><th></th></tr></thead>
                    <tbody>{coaches.map(c => (
                        <tr key={c.coach_id}>
                            <td>{c.name}</td>
                            <td><span className="dash-judge-name">{c.email}</span></td>
                            <td><StatusChip label={c.is_owner ? 'Owner' : 'Coach'} variant={c.is_owner ? 'submitted' : 'pending'} /></td>
                            <td><StatusChip label={c.has_joined ? 'Joined' : 'Invited'} variant={c.has_joined ? 'submitted' : 'pending'} /></td>
                            <td className={"notif-cell"}>
                                {c.has_joined ? (
                                    <button
                                        type="button"
                                        className="coach-notif-toggle"
                                        onClick={() => toggleNotifications(c.coach_id)}
                                        aria-pressed={c.notifications_enabled}
                                        title={c.notifications_enabled ? 'Notifications enabled. Click to disable' : 'Notifications disabled. Click to enable'}
                                        aria-label={c.notifications_enabled ? 'Disable notifications' : 'Enable notifications'}
                                    >
                                        <Icon
                                            name={c.notifications_enabled ? 'Notifications-Enabled' : 'Notifications-Disabled'}
                                            size={1.1}
                                        />
                                    </button>
                                ) : (
                                    <span className="dash-judge-name">—</span>
                                )}
                            </td>
                            <td>{!c.is_owner && (
                                <div className="dash-actions-cell">
                                    {isOrganizerView && c.has_joined && (
                                        <button className="dash-remove-btn" onClick={() => confirmOwner.open(c)}>Make Owner</button>
                                    )}
                                    <DangerButton onClick={() => confirmRemove.open(c)}>Remove</DangerButton>
                                </div>
                            )}</td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
            {showAdd && (
                <AddOrganizerModal
                    onClose={() => setShowAdd(false)}
                    onAdd={(_, email) => { addCoach(email); setShowAdd(false) }}
                    title="Add coach"
                    description="They must already have an account. They will be added as a co-coach for this team."
                    submitLabel="Add coach"
                />
            )}
            {confirmRemove.pending && (
                <ConfirmRemoveModal
                    message={`Remove ${confirmRemove.pending.name} as a coach?`}
                    onCancel={confirmRemove.clear}
                    onConfirm={() => { removeCoach(confirmRemove.pending!.coach_id); confirmRemove.clear() }}
                />
            )}
            {confirmOwner.pending && (
                <ConfirmRemoveModal
                    message={`Make ${confirmOwner.pending.name} the new team owner? The current owner will become a regular coach.`}
                    onCancel={confirmOwner.clear}
                    onConfirm={() => { makeOwner(confirmOwner.pending!.coach_id); confirmOwner.clear() }}
                    confirmLabel="Confirm"
                />
            )}
        </>
    )
}
