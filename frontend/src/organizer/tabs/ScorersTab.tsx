import { useEffect, useState } from 'react'
import type { IScorer } from '@mock-scores/shared'
import { apiFetch } from '../../auth/auth'
import { isValidEmail } from '../../utils/validation'
import { ConfirmRemoveModal } from '../components/modals'
import Section from './Section'
import { v4 as randomUUID } from 'uuid'

export default function ScorersTab({ tournamentId }: { tournamentId: string }) {
    const [scorers, setScorers] = useState<IScorer[]>([])
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [confirmRemove, setConfirmRemove] = useState<IScorer | null>(null)
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [email, setEmail] = useState('')

    useEffect(() => {
        apiFetch(`/api/organizer/tournament/${tournamentId}/scorers`)
            .then(r => r.ok ? r.json() : [])
            .then((data: IScorer[]) => setScorers(Array.isArray(data) ? data : []))
            .catch(() => setScorers([]))
    }, [tournamentId])

    const openAddModal = () => {
        setEditingId(null); setFirstName(''); setLastName(''); setEmail('')
        setShowModal(true)
    }

    const openEditModal = (scorer: IScorer) => {
        setEditingId(scorer.scorer_id)
        setFirstName(scorer.first_name); setLastName(scorer.last_name); setEmail(scorer.email ?? '')
        setShowModal(true)
    }

    const handleSave = () => {
        if (!firstName.trim() || !lastName.trim() || !isValidEmail(email)) return
        if (editingId) {
            const updated = scorers.find(s => s.scorer_id === editingId)
            if (!updated) return
            const payload = { ...updated, first_name: firstName.trim(), last_name: lastName.trim(), email: email.trim() }
            setScorers(prev => prev.map(s => s.scorer_id === editingId ? payload : s))
            apiFetch(`/api/organizer/tournament/${tournamentId}/scorers`, { method: 'PUT', body: JSON.stringify(payload) }).catch(console.error) //todo: better error reporting
        } else {
            const newScorer: IScorer = { scorer_id: randomUUID(), first_name: firstName.trim(), last_name: lastName.trim(), email: email.trim() }
            setScorers(prev => [...prev, newScorer])
            apiFetch(`/api/organizer/tournament/${tournamentId}/scorers`, { method: 'POST', body: JSON.stringify(newScorer) }).catch(console.error) //todo: better error reporting
        }
        setShowModal(false)
    }

    const handleRemove = () => {
        if (!confirmRemove) return
        apiFetch(`/api/organizer/tournament/${tournamentId}/scorers`, { method: 'DELETE', body: JSON.stringify({ scorer_id: confirmRemove.scorer_id }) }).catch(console.error) //todo: better error reporting
        setScorers(prev => prev.filter(s => s.scorer_id !== confirmRemove.scorer_id))
        setConfirmRemove(null)
    }

    return (
        <Section title="Scorers" description="Manage available scorers">
            <div className="tab-actions">
                <button className="org-new-btn" onClick={openAddModal}>+ Add scorer</button>
            </div>

            <div className="dash-table-scroll">
                <table className="dash-standings-table">
                    <thead><tr><th>Name</th><th>Email</th><th></th></tr></thead>
                    <tbody>
                        {scorers.map(scorer => (
                            <tr key={scorer.scorer_id}>
                                <td>{scorer.first_name} {scorer.last_name}</td>
                                <td className="dash-judge-name">{scorer.email ?? '—'}</td>
                                <td>
                                    <div className="dash-actions-cell">
                                        <button className="dash-remove-btn" onClick={() => openEditModal(scorer)}>Edit</button>
                                        <button className="dash-remove-btn" onClick={() => setConfirmRemove(scorer)}>Remove</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
                    <div className="confirm-modal" role="dialog" aria-modal="true">
                        <h2>{editingId ? 'Edit scorer' : 'Add scorer'}</h2>
                        <form className="tc-form" onSubmit={e => { e.preventDefault(); handleSave() }} noValidate>
                            <div className="tc-field">
                                <label className="tc-label" htmlFor="first-name">First name</label>
                                <input id="first-name" type="text" className="tc-input" required autoFocus
                                    value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" />
                            </div>
                            <div className="tc-field">
                                <label className="tc-label" htmlFor="last-name">Last name</label>
                                <input id="last-name" type="text" className="tc-input" required
                                    value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" />
                            </div>
                            <div className="tc-field">
                                <label className="tc-label" htmlFor="scorer-email">Email</label>
                                <input id="scorer-email" type="email" required
                                    className={`tc-input${email && !isValidEmail(email) ? ' tc-input--invalid' : ''}`}
                                    value={email} onChange={e => setEmail(e.target.value)} placeholder="scorer@example.com" />
                                {email && !isValidEmail(email) && <span className="tc-field-error">Invalid email address</span>}
                            </div>
                            <div className="confirm-actions">
                                <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" disabled={!firstName.trim() || !lastName.trim() || !isValidEmail(email)}>
                                    {editingId ? 'Save' : 'Add scorer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {confirmRemove && (
                <ConfirmRemoveModal
                    message={`Remove ${confirmRemove.first_name} ${confirmRemove.last_name} from the scorer list?`}
                    onCancel={() => setConfirmRemove(null)}
                    onConfirm={handleRemove}
                />
            )}
        </Section>
    )
}
