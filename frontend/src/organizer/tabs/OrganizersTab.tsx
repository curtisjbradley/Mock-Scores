import { useState, useEffect } from 'react'
import type { IOrganizer } from '@mock-scores/shared'
import { ConfirmRemoveModal, AddOrganizerModal } from '../components/modals'
import Section from './Section'
import { apiFetch } from '../../auth/auth'
import { useConfirmRemove } from '../../shared/hooks/useConfirmRemove'
import { useSession } from '../../shared/hooks/useSession'
import InlineEmailEdit from '../../shared/components/InlineEmailEdit'
import StatusChip from '../../shared/components/StatusChip'

export default function OrganizersTab({ tournamentId }: { tournamentId: string }) {
    const [organizers, setOrganizers] = useState<IOrganizer[]>([])
    const session = useSession()
    const [showModal, setShowModal] = useState(false)
    const confirmRemove = useConfirmRemove<IOrganizer>()
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editEmail, setEditEmail] = useState('')

    useEffect(() => {
        apiFetch(`/api/organizer/tournament/${tournamentId}/organizers`)
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(setOrganizers).catch(console.error)
    }, [tournamentId])

    const saveEmail = (org: IOrganizer) => {
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
        confirmRemove.clear()
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
                                    {editingId === org.id
                                        ? <InlineEmailEdit
                                            value={editEmail}
                                            onChange={setEditEmail}
                                            onSave={() => saveEmail(org)}
                                            onCancel={() => setEditingId(null)}
                                          />
                                        : <span className="dash-judge-name">{org.email}</span>
                                    }
                                </td>
                                <td><StatusChip label={org.role} variant={org.role === 'owner' ? 'submitted' : 'pending'} /></td>
                                <td>
                                    {!isReadOnly(org) && (
                                        <div className="dash-actions-cell">
                                            {!org.has_joined && editingId !== org.id && (
                                                <button className="dash-remove-btn" onClick={() => { setEditingId(org.id); setEditEmail(org.email) }}>Edit email</button>
                                            )}
                                            <button className="dash-remove-btn" onClick={() => confirmRemove.open(org)}>Remove</button>
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

            {confirmRemove.pending && (
                <ConfirmRemoveModal
                    message={`Remove ${confirmRemove.pending.name} as an organizer?`}
                    onCancel={confirmRemove.clear}
                    onConfirm={() => removeOrganizer(confirmRemove.pending!)}
                />
            )}
        </Section>
    )
}
