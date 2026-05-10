import { useState } from 'react'
import './styles/organizer.css'
import './styles/pairings.css'
import '../judges/styles/modal.css'
import { dummyScorers, type IScorer } from './dummyData'

const ScorersPage = () => {
    const [scorers, setScorers] = useState<IScorer[]>(dummyScorers)
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [confirmRemove, setConfirmRemove] = useState<IScorer | null>(null)
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [email, setEmail] = useState('')

    const openAddModal = () => {
        setEditingId(null)
        setFirstName('')
        setLastName('')
        setEmail('')
        setShowModal(true)
    }

    const openEditModal = (scorer: IScorer) => {
        const [first, ...rest] = scorer.name.split(' ')
        setEditingId(scorer.id)
        setFirstName(first ?? '')
        setLastName(rest.join(' '))
        setEmail(scorer.email ?? '')
        setShowModal(true)
    }

    const handleSave = () => {
        if (!firstName.trim() || !lastName.trim() || !email.trim()) return
        if (editingId) {
            setScorers(prev => prev.map(s => s.id === editingId ? { ...s, name: `${firstName.trim()} ${lastName.trim()}`, email: email.trim() } : s))
        } else {
            const newScorer: IScorer = { id: `sc-${Date.now()}`, name: `${firstName.trim()} ${lastName.trim()}`, email: email.trim() }
            setScorers(prev => [...prev, newScorer])
        }
        setShowModal(false)
    }

    const handleRemove = () => {
        if (!confirmRemove) return
        setScorers(prev => prev.filter(s => s.id !== confirmRemove.id))
        setConfirmRemove(null)
    }

    const inputStyle = { height: '2.75rem', padding: '0 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', fontSize: '1rem', fontFamily: 'inherit' } as const

    return (
        <>
                <div className="org-container">

                    <table className="dash-standings-table">
                        <thead><tr><th>Name</th><th>Email</th><th></th></tr></thead>
                        <tbody>
                            {scorers.map(scorer => (
                                <tr key={scorer.id}>
                                    <td>{scorer.name}</td>
                                    <td className="dash-judge-name">{scorer.email ?? '—'}</td>
                                    <td style={{ display: 'flex', gap: '0.4rem' }}>
                                        <button className="dash-remove-btn" onClick={() => openEditModal(scorer)}>Edit</button>
                                        <button className="dash-remove-btn" onClick={() => setConfirmRemove(scorer)}>Remove</button>
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
                            <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="scorer@example.com" style={inputStyle} />
                            <div className="confirm-actions">
                                <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" disabled={!firstName.trim() || !lastName.trim() || !email.trim()}>{editingId ? 'Save' : 'Add scorer'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {confirmRemove && (
                <div className="modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) setConfirmRemove(null) }}>
                    <div className="confirm-modal" role="dialog" aria-modal="true">
                        <h2>Remove scorer?</h2>
                        <p>Remove {confirmRemove.name} from the scorer list?</p>
                        <div className="confirm-actions">
                            <button type="button" onClick={() => setConfirmRemove(null)}>Cancel</button>
                            <button type="button" className="confirm-btn-danger" onClick={handleRemove}>Remove</button>
                        </div>
                    </div>
                </div>
            )}
            <button className="org-new-btn" onClick={openAddModal}>+ Add scorer</button>
        </>
    )
}

export default ScorersPage
