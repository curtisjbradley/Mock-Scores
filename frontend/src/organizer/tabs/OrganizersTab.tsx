import { useState, useEffect } from 'react'
import type { IOrganizer } from '@mock-scores/shared'
import { ConfirmRemoveModal, AddOrganizerModal } from '../components/modals'
import Section from './Section'
import { isValidEmail } from '../../utils/validation'
import { apiFetch, getSession } from '../../auth/auth'
import type { Session } from '../../auth/auth'

export default function OrganizersTab({ tournamentId }: { tournamentId: string }) {
    const [organizers, setOrganizers] = useState<IOrganizer[]>([])
    const [session, setSession] = useState<Session | null>(null)
    const [showModal, setShowModal] = useState(false)
    const [confirmRemove, setConfirmRemove] = useState<IOrganizer | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editEmail, setEditEmail] = useState('')

    useEffect(() => {
        apiFetch(`/api/organizer/tournament/${tournamentId}/organizers`)
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(setOrganizers).catch(console.error)
        getSession().then(setSession)
    }, [tournamentId])

    const saveEmail = (org: IOrganizer) => {
        if (!isValidEmail(editEmail)) return
        const updated = { ...org, email: editEmail }
        apiFetch(`/api/organizer/tournament/${tournamentId}/organizers`, {
            method: 'PUT', body: JSON.stringify({ organizer: updated }),
        }).catch(console.error)
        setOrganizers(prev => prev.map(o => o.id === org.id ? updated : o))
        setEditingId(null)
    }

    const removeOrganizer = (org: IOrganizer) => {
        apiFetch(`/api/organizer/tournament/${tournamentId}/organizers`, {
            method: 'DELETE', body: JSON.stringify({ organizer: org }),
        }).catch(console.error)
        setOrganizers(prev => prev.filter(o => o.id !== org.id))
        setConfirmRemove(null)
    }

    const isReadOnly = (org: IOrganizer) => org.email === session?.email || org.role === 'owner'

    return (
        <Section title="Organizers" description="Manage your organizers">
            <div className="tab-actions">
                <button className="org-new-btn" onClick={() => setShowModal(true)}>+ Add Organizer</button>
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
                                        <form className="dash-edit-form" onSubmit={e => { e.preventDefault(); saveEmail(org) }}>
                                            <input autoFocus type="email" value={editEmail}
                                                onChange={e => setEditEmail(e.target.value)}
                                                className={`dash-edit-input ${!editEmail || isValidEmail(editEmail) ? 'dash-edit-input--valid' : 'dash-edit-input--invalid'}`} />
                                            <button type="submit" disabled={!isValidEmail(editEmail)} className="dash-edit-save">Save</button>
                                            <button type="button" className="dash-edit-cancel" onClick={() => setEditingId(null)}>Cancel</button>
                                        </form>
                                    ) : (
                                        <span className="dash-judge-name">{org.email}</span>
                                    )}
                                </td>
                                <td><span className={`ss-chip ${org.role === 'owner' ? 'ss-chip--submitted' : 'ss-chip--pending'}`}>{org.role}</span></td>
                                <td>
                                    {!isReadOnly(org) && (
                                        <div className="dash-actions-cell">
                                            {!org.has_joined && editingId !== org.id && (
                                                <button className="dash-remove-btn" onClick={() => { setEditingId(org.id); setEditEmail(org.email) }}>Edit email</button>
                                            )}
                                            <button className="dash-remove-btn" onClick={() => setConfirmRemove(org)}>Remove</button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <AddOrganizerModal
                    onClose={() => setShowModal(false)}
                    onAdd={(name, email) => {
                        apiFetch(`/api/organizer/tournament/${tournamentId}/organizers`, {
                            method: 'POST', body: JSON.stringify({ organizer: { name, email, role: 'delegate' } }),
                        }).then(r => r.ok ? r.json() : Promise.reject())
                        .then((created: IOrganizer) => setOrganizers(prev => [...prev, created]))
                        .catch(console.error)
                        setShowModal(false)
                    }}
                />
            )}

            {confirmRemove && (
                <ConfirmRemoveModal
                    message={`Remove ${confirmRemove.name} as an organizer?`}
                    onCancel={() => setConfirmRemove(null)}
                    onConfirm={() => removeOrganizer(confirmRemove)}
                />
            )}
        </Section>
    )
}
