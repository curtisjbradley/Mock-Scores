import { useState, useEffect } from 'react'
import type { IOrganizer } from '@mock-scores/shared'
import { ConfirmRemoveModal, AddOrganizerModal } from '../components/modals'
import Section from './Section'
import { apiFetch } from '../../auth/auth'
import { useConfirmRemove } from '../../shared/hooks/useConfirmRemove'
import { useSession } from '../../shared/hooks/useSession'
import InlineEmailEdit from '../../shared/components/InlineEmailEdit'
import StatusChip from '../../shared/components/StatusChip'
import EmailStatusBadge from '../../shared/components/EmailStatusBadge'
import DangerButton from '../../shared/components/DangerButton'
import AddButton from '../../shared/components/AddButton'

export default function OrganizersTab({ tournamentId }: { tournamentId: string }) {
    const [organizers, setOrganizers] = useState<IOrganizer[]>([])
    const session = useSession()
    const [showModal, setShowModal] = useState(false)
    const confirmRemove = useConfirmRemove<IOrganizer>()
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editEmail, setEditEmail] = useState('')
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        apiFetch(`/organizer/tournament/${tournamentId}/organizers`)
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(setOrganizers).catch(console.error)
    }, [tournamentId])

    const saveEmail = async (org: IOrganizer) => {
        const updated = { ...org, email: editEmail }
        setError(null)
        try {
        const res = await apiFetch(`/organizer/tournament/${tournamentId}/organizers`, {
            method: 'PUT', body: JSON.stringify({ organizer: updated }),
        })
        if (!res.ok) throw new Error()
        setOrganizers(prev => prev.map(o => o.id === org.id ? updated : o))
        setEditingId(null)
        } catch { setError('Unable to update organizer email.') }
    }

    const removeOrganizer = async (org: IOrganizer) => {
        setError(null)
        try {
        const res = await apiFetch(`/organizer/tournament/${tournamentId}/organizers`, {
            method: 'DELETE', body: JSON.stringify({ organizer: org }),
        })
        if (!res.ok) throw new Error()
        setOrganizers(prev => prev.filter(o => o.id !== org.id))
        confirmRemove.clear()
        } catch { setError('Unable to remove organizer.') }
    }

    const addOrganizer = async (name: string, email: string) => {
        setError(null)
        try {
            const response = await apiFetch(`/organizer/tournament/${tournamentId}/organizers`, {
                method: 'POST', body: JSON.stringify({ organizer: { name, email, role: 'delegate' } }),
            })
            if (!response.ok) throw new Error()
            const created: IOrganizer = await response.json()
            setOrganizers(prev => [...prev, created])
            setShowModal(false)
        } catch { setError('Unable to add organizer.') }
    }

    const isReadOnly = (org: IOrganizer) => org.email === session?.email || org.role === 'owner'

    return (
        <Section title="Organizers" description="Manage your organizers">
            {error && <p className="org-error" role="alert">{error}</p>}
            <div className="tab-actions">
                <AddButton onClick={() => setShowModal(true)}>+ Add Organizer</AddButton>
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
                                            onSave={() => { void saveEmail(org) }}
                                            onCancel={() => setEditingId(null)}
                                          />
                                        : <span className="dash-judge-name">
                                            {org.email}
                                            <EmailStatusBadge status={org.email_status} />
                                          </span>
                                    }
                                </td>
                                <td><StatusChip label={org.role} variant={org.role === 'owner' ? 'submitted' : 'pending'} /></td>
                                <td>
                                    {!isReadOnly(org) && (
                                        <div className="dash-actions-cell">
                                            {!org.has_joined && editingId !== org.id && (
                                                <button className="dash-remove-btn" onClick={() => { setEditingId(org.id); setEditEmail(org.email) }}>Edit email</button>
                                            )}
                                            <DangerButton onClick={() => confirmRemove.open(org)}>Remove</DangerButton>
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
                    onAdd={(name, email) => { void addOrganizer(name, email) }}
                />
            )}

            {confirmRemove.pending && (
                <ConfirmRemoveModal
                    message={`Remove ${confirmRemove.pending.name} as an organizer?`}
                    onCancel={confirmRemove.clear}
                    onConfirm={() => { void removeOrganizer(confirmRemove.pending!) }}
                />
            )}
        </Section>
    )
}
