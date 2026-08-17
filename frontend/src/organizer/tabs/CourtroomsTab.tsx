import { useState, useEffect } from 'react'
import type { ICourtroom } from '@mock-scores/shared'
import { ConfirmRemoveModal } from '../components/modals'
import ModalBackdrop from '../../shared/components/ModalBackdrop'
import { useConfirmRemove } from '../../shared/hooks/useConfirmRemove'
import Section from './Section'
import { apiFetch } from '../../auth/auth'
import { v4 as randomUUID } from 'uuid'

export default function CourtroomsTab({ tournamentId }: { tournamentId: string }) {
    const [courtrooms, setCourtrooms] = useState<ICourtroom[]>([])
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const confirmRemove = useConfirmRemove<ICourtroom>()
    const [name, setName] = useState('')
    const [location, setLocation] = useState('')

    useEffect(() => {
        apiFetch(`/organizer/tournament/${tournamentId}/courtrooms`)
            .then(res => { if (!res.ok) throw new Error('Courtrooms not found.'); return res.json() })
            .then(setCourtrooms).catch(console.error)
    }, [tournamentId])

    const openAddModal = () => { setEditingId(null); setName(''); setLocation(''); setShowModal(true) }
    const openEditModal = (c: ICourtroom) => { setEditingId(c.id); setName(c.name); setLocation(c.location ?? ''); setShowModal(true) }

    const handleSave = () => {
        if (!name.trim()) return
        if (editingId) {
            const modified: ICourtroom = { id: editingId, name: name.trim(), location: location.trim() }
            apiFetch(`/organizer/tournament/${tournamentId}/courtrooms`, { method: 'PUT', body: JSON.stringify(modified) })
                .then(res => { if (!res.ok) throw new Error('Courtroom not found.') }).catch(console.error)
            setCourtrooms(prev => prev.map(c => c.id === editingId ? modified : c))
        } else {
            const created: ICourtroom = { id: randomUUID(), name: name.trim(), location: location.trim() }
            apiFetch(`/organizer/tournament/${tournamentId}/courtrooms`, { method: 'POST', body: JSON.stringify(created) })
                .then(res => { if (!res.ok) throw new Error('Courtroom not found.') }).catch(console.error)
            setCourtrooms(prev => [...prev, created])
        }
        setShowModal(false)
    }

    return (
        <Section title="Courtrooms" description="Manage available courtrooms">
            <div className="tab-actions">
                <button className="org-new-btn" onClick={openAddModal}>+ Add courtroom</button>
            </div>

            <div className="dash-table-scroll">
                <table className="dash-standings-table">
                    <thead><tr><th>Name</th><th>Details</th><th></th></tr></thead>
                    <tbody>
                        {courtrooms.map(c => (
                            <tr key={c.id}>
                                <td className="dash-team-code">{c.name}</td>
                                <td className="dash-judge-name">{c.location ?? '—'}</td>
                                <td>
                                    <div className="dash-actions-cell">
                                        <button className="dash-remove-btn" onClick={() => openEditModal(c)}>Edit</button>
                                        <button className="dash-remove-btn" onClick={() => confirmRemove.open(c)}>Remove</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <ModalBackdrop onClose={() => setShowModal(false)}>
                    <div className="confirm-modal" role="dialog" aria-modal="true">
                        <h2>{editingId ? 'Edit courtroom' : 'Add courtroom'}</h2>
                        <form className="tc-form" onSubmit={e => { e.preventDefault(); handleSave() }} noValidate>
                            <div className="tc-field">
                                <label className="tc-label" htmlFor="cr-name">Name</label>
                                <input id="cr-name" type="text" className="tc-input" required autoFocus
                                    value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 1A" />
                            </div>
                            <div className="tc-field">
                                <label className="tc-label" htmlFor="cr-details">Details (optional)</label>
                                <input id="cr-details" type="text" className="tc-input"
                                    value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. 2nd Floor" />
                            </div>
                            <div className="confirm-actions">
                                <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" disabled={!name.trim()}>{editingId ? 'Save' : 'Add courtroom'}</button>
                            </div>
                        </form>
                    </div>
                </ModalBackdrop>
            )}

            {confirmRemove.pending && (
                <ConfirmRemoveModal
                    message={`Remove ${confirmRemove.pending.name} from the courtroom list?`}
                    onCancel={confirmRemove.clear}
                    onConfirm={() => {
                        apiFetch(`/organizer/tournament/${tournamentId}/courtrooms`, { method: 'DELETE', body: JSON.stringify(confirmRemove.pending) })
                            .then(res => { if (!res.ok) throw new Error('Courtroom not found.') }).catch(console.error)
                        setCourtrooms(prev => prev.filter(c => c.id !== confirmRemove.pending!.id))
                        confirmRemove.clear()
                    }}
                />
            )}
        </Section>
    )
}
