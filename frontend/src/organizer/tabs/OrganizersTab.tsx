import { useState } from 'react'
import { type IOrganizer } from '../data/dummyData'
import { ConfirmRemoveModal, AddOrganizerModal } from '../components/modals'
import { isValidEmail } from '../../utils/validation'

interface Props {
    tournamentId: string
    organizers: IOrganizer[]
    onAddOrganizer: (org: IOrganizer) => void
    onRemoveOrganizer: (id: string) => void
    onUpdateOrgEmail: (id: string, email: string) => void
}

export default function OrganizersTab({ tournamentId, organizers, onAddOrganizer, onRemoveOrganizer, onUpdateOrgEmail }: Props) {
    const [showModal, setShowModal] = useState(false)
    const [confirmRemove, setConfirmRemove] = useState<IOrganizer | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editEmail, setEditEmail] = useState('')

    return (
        <div className="dash-section">
            <div className="dash-invites-header">
                <h2>{organizers.length} organizer{organizers.length !== 1 ? 's' : ''}</h2>
                <button className="org-new-btn" onClick={() => setShowModal(true)}>+ Add organizer</button>
            </div>
            <div className="dash-table-scroll">
                <table className="dash-standings-table">
                    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
                    <tbody>
                        {organizers.map(org => (
                            <tr key={org.id}>
                                <td>{org.name}</td>
                                <td>
                                    {editingId === org.id ? (
                                        <form className="dash-edit-form" onSubmit={e => {
                                            e.preventDefault()
                                            if (!isValidEmail(editEmail)) return
                                            // TODO: PATCH /api/tournaments/:id/organizers/:orgId { email: editEmail }
                                            onUpdateOrgEmail(org.id, editEmail)
                                            setEditingId(null)
                                        }}>
                                            <input autoFocus type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                                                className={`dash-edit-input ${isValidEmail(editEmail) || !editEmail ? 'dash-edit-input--valid' : 'dash-edit-input--invalid'}`} />
                                            <button type="submit" disabled={!isValidEmail(editEmail)} className="dash-edit-save">Save</button>
                                            <button type="button" className="dash-edit-cancel" onClick={() => setEditingId(null)}>Cancel</button>
                                        </form>
                                    ) : (
                                        <span className="dash-judge-name">{org.email}</span>
                                    )}
                                </td>
                                <td><span className={`ss-chip ${org.role === 'owner' ? 'ss-chip--submitted' : 'ss-chip--pending'}`}>{org.role}</span></td>
                                <td>
                                    <div className="dash-actions-cell">
                                        {editingId !== org.id && (
                                            <button className="dash-remove-btn" onClick={() => { setEditingId(org.id); setEditEmail(org.email) }}>Edit email</button>
                                        )}
                                        {org.role !== 'owner' && (
                                            <button className="dash-remove-btn" onClick={() => setConfirmRemove(org)}>Remove</button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <AddOrganizerModal
                    onClose={() => setShowModal(false)}
                    onAdd={(name, email) =>
                        // TODO: POST /api/tournaments/:id/organizers { name, email }
                        onAddOrganizer({ id: `o-${Date.now()}`, tournamentId, name, email, role: 'co-organizer' })}
                />
            )}

            {confirmRemove && (
                <ConfirmRemoveModal
                    message={`Remove ${confirmRemove.name} as an organizer?`}
                    onCancel={() => setConfirmRemove(null)}
                    onConfirm={() => {
                        // TODO: DELETE /api/tournaments/:id/organizers/:orgId
                        onRemoveOrganizer(confirmRemove.id); setConfirmRemove(null)
                    }}
                />
            )}
        </div>
    )
}
