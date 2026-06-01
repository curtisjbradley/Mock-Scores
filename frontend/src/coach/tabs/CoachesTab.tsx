import { useState } from 'react'
import type { ICoach } from '@mock-scores/shared'
import { ConfirmRemoveModal, AddOrganizerModal } from '../../organizer/components/modals'

interface Props {
    coaches: ICoach[]
    currentUserId: string | null
    isOrganizerView: boolean
    onAdd: (email: string) => void
    onRemove: (coachId: string) => void
    onMakeOwner: (coachId: string) => void
}

export default function CoachesTab({ coaches, currentUserId, isOrganizerView, onAdd, onRemove, onMakeOwner }: Props) {
    const [showAdd, setShowAdd] = useState(false)
    const [confirmRemove, setConfirmRemove] = useState<ICoach | null>(null)
    const [confirmOwner, setConfirmOwner] = useState<ICoach | null>(null)

    return (
        <>
            <div className="tab-actions">
                <button className="org-new-btn" onClick={() => setShowAdd(true)}>+ Add coach</button>
            </div>
            <div className="dash-table-scroll">
                <table className="dash-standings-table">
                    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
                    <tbody>{coaches.map(c => (
                        <tr key={c.coach_id}>
                            <td>{c.name}</td>
                            <td><span className="dash-judge-name">{c.email}</span></td>
                            <td><span className={`ss-chip ss-chip--${c.is_owner ? 'submitted' : 'pending'}`}>{c.is_owner ? 'Owner' : 'Coach'}</span></td>
                            <td><span className={`ss-chip ss-chip--${c.has_joined ? 'submitted' : 'pending'}`}>{c.has_joined ? 'Joined' : 'Invited'}</span></td>
                            <td>{!c.is_owner && c.coach_id !== currentUserId && (
                                <div className="dash-actions-cell">
                                    {isOrganizerView && c.has_joined && (
                                        <button className="dash-remove-btn" onClick={() => setConfirmOwner(c)}>Make Owner</button>
                                    )}
                                    <button className="dash-remove-btn" onClick={() => setConfirmRemove(c)}>Remove</button>
                                </div>
                            )}</td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
            {showAdd && (
                <AddOrganizerModal
                    onClose={() => setShowAdd(false)}
                    onAdd={(_, email) => { onAdd(email); setShowAdd(false) }}
                    title="Add coach"
                    description="They must already have an account. They will be added as a co-coach for this team."
                    submitLabel="Add coach"
                />
            )}
            {confirmRemove && (
                <ConfirmRemoveModal
                    message={`Remove ${confirmRemove.name} as a coach?`}
                    onCancel={() => setConfirmRemove(null)}
                    onConfirm={() => { onRemove(confirmRemove.coach_id); setConfirmRemove(null) }}
                />
            )}
            {confirmOwner && (
                <ConfirmRemoveModal
                    message={`Make ${confirmOwner.name} the new team owner? The current owner will become a regular coach.`}
                    onCancel={() => setConfirmOwner(null)}
                    onConfirm={() => { onMakeOwner(confirmOwner.coach_id); setConfirmOwner(null) }}
                />
            )}
        </>
    )
}
