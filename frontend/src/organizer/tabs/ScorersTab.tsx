import {useEffect, useState} from 'react'
import '../styles/organizer.css'
import '../styles/pairings.css'
import '../../judges/styles/modal.css'
import { type IScorer } from '@mock-scores/shared'
import { apiFetch } from '../../auth/auth'
import { isValidEmail } from '../../utils/validation'
import Section from "./Section.tsx";
import { v4 as randomUUID } from "uuid";

interface ITabProps {
    tournamentId : string
}

const ScorersTab = ({ tournamentId }: ITabProps) => {
    const [scorers, setScorers] = useState<IScorer[]>([])
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [confirmRemove, setConfirmRemove] = useState<IScorer | null>(null)
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [email, setEmail] = useState('')


    useEffect(() => {
        apiFetch(`/api/tournament/${tournamentId}/scorers`)
            .then(r => r.ok ? r.json() : [])
            .then((data: IScorer[]) => setScorers(Array.isArray(data) ? data : []))
            .catch(() => setScorers([]))
    }, [tournamentId])

    const openAddModal = () => {
        setEditingId(null)
        setFirstName('')
        setLastName('')
        setEmail('')
        setShowModal(true)
    }

    const openEditModal = (scorer: IScorer) => {
        setEditingId(scorer.scorer_id)
        setFirstName(scorer.first_name)
        setLastName(scorer.last_name)
        setEmail(scorer.email ?? '')
        setShowModal(true)
    }

    const handleSave = () => {
        if (!firstName.trim() || !lastName.trim() || !isValidEmail(email)) return
        if (editingId) {

            setScorers(prev => prev.map(s => s.scorer_id === editingId ? { ...s, name: `${firstName.trim()} ${lastName.trim()}`, email: email.trim() } : s))
            scorers.filter(s => s.scorer_id === editingId).find(async scorer => {
                await apiFetch(`/api/tournament/${tournamentId}/scorers`, {method: "PUT", body: JSON.stringify({ ...scorer, name: `${firstName.trim()} ${lastName.trim()}`, email: email.trim() })})
            })
        } else {
            const newScorer: IScorer = {scorer_id : randomUUID() , tournament_id: tournamentId, first_name: firstName, last_name : lastName,  email: email.trim() }
            setScorers(prev => [...prev, newScorer])
            //todo: display errors
            apiFetch(`/api/tournament/${tournamentId}/scorers`, {method: "POST", body: JSON.stringify(newScorer)}).then(res => console.log(res))
        }
        setShowModal(false)
    }

    const handleRemove = () => {
        if (!confirmRemove) return

        scorers.filter(s => s.scorer_id === confirmRemove.scorer_id).find(async scorer => {
            apiFetch(`/api/tournament/${tournamentId}/scorers`,{method: "DELETE", body: JSON.stringify({scorer_id: scorer.scorer_id})}).then(res => console.log(res))
        })

        setScorers(prev => prev.filter(s => s.scorer_id !== confirmRemove.scorer_id))
        setConfirmRemove(null)
    }

    const inputStyle = { height: '2.75rem', padding: '0 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', fontSize: '1rem', fontFamily: 'inherit' } as const

    return (
        <Section title={"Scorers"} description={"Manage available scorers"}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                <button className="org-new-btn" onClick={openAddModal}>+ Add scorer</button>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table className="dash-standings-table">
                    <thead><tr><th>Name</th><th>Email</th><th></th></tr></thead>
                    <tbody>
                        {scorers.map(scorer => (
                            <tr key={scorer.scorer_id}>
                                <td>{scorer.first_name} {scorer.last_name}</td>
                                <td className="dash-judge-name">{scorer.email ?? '—'}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
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
                        <form onSubmit={e => { e.preventDefault(); handleSave() }} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                            <label htmlFor="first-name" style={{ fontSize: '0.875rem', fontWeight: 600 }}>First name</label>
                            <input id="first-name" type="text" required autoFocus value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" style={inputStyle} />
                            <label htmlFor="last-name" style={{ fontSize: '0.875rem', fontWeight: 600, marginTop: '0.25rem' }}>Last name</label>
                            <input id="last-name" type="text" required value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" style={inputStyle} />
                            <label htmlFor="email" style={{ fontSize: '0.875rem', fontWeight: 600, marginTop: '0.25rem' }}>Email</label>
                            <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="scorer@example.com"
                                style={{ ...inputStyle, borderColor: email && !isValidEmail(email) ? 'var(--danger)' : 'var(--border-strong)' }} />
                            {email && !isValidEmail(email) && <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>Invalid email address</span>}
                            <div className="confirm-actions">
                                <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" disabled={!firstName.trim() || !lastName.trim() || !isValidEmail(email)}>{editingId ? 'Save' : 'Add scorer'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {confirmRemove && (
                <div className="modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) setConfirmRemove(null) }}>
                    <div className="confirm-modal" role="dialog" aria-modal="true">
                        <h2>Remove scorer?</h2>
                        <p>Remove {confirmRemove.first_name} {confirmRemove.last_name} from the scorer list?</p>
                        <div className="confirm-actions">
                            <button type="button" onClick={() => setConfirmRemove(null)}>Cancel</button>
                            <button type="button" className="confirm-btn-danger" onClick={handleRemove}>Remove</button>
                        </div>
                    </div>
                </div>
            )}
        </Section>
    )
}

export default ScorersTab
