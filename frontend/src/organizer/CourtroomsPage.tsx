import { useState } from 'react'
import { useParams } from 'react-router-dom'
import '../components/layout.css'
import '../judges/styles/modal.css'
import { dummyCourtrooms, type ICourtroom } from './dummyData'

const CourtroomsPage = () => {
    const { id } = useParams<{ id: string }>()
    const [courtrooms, setCourtrooms] = useState<ICourtroom[]>(() => dummyCourtrooms.filter(c => c.tournamentId === id))
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [confirmRemove, setConfirmRemove] = useState<ICourtroom | null>(null)
    const [name, setName] = useState('')
    const [details, setDetails] = useState('')

    const openAddModal = () => {
        setEditingId(null)
        setName('')
        setDetails('')
        setShowModal(true)
    }

    const openEditModal = (courtroom: ICourtroom) => {
        setEditingId(courtroom.id)
        setName(courtroom.name)
        setDetails(courtroom.details ?? '')
        setShowModal(true)
    }

    const handleSave = () => {
        if (!name.trim()) return
        if (editingId) {
            setCourtrooms(prev => prev.map(c => c.id === editingId ? { ...c, name: name.trim(), details: details.trim() || undefined } : c))
        } else {
            const newCourtroom: ICourtroom = { id: `cr-${Date.now()}`, tournamentId: id!, name: name.trim(), details: details.trim() || undefined }
            setCourtrooms(prev => [...prev, newCourtroom])
        }
        setShowModal(false)
    }

    const handleRemove = () => {
        if (!confirmRemove) return
        setCourtrooms(prev => prev.filter(c => c.id !== confirmRemove.id))
        setConfirmRemove(null)
    }

    const inputStyle = { height: '2.75rem', padding: '0 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', fontSize: '1rem', fontFamily: 'inherit' } as const

    return (
        <>
                <div className="org-container">
                    <table className="dash-standings-table">
                        <thead><tr><th>Name</th><th>Details</th><th></th></tr></thead>
                        <tbody>
                            {courtrooms.map(courtroom => (
                                <tr key={courtroom.id}>
                                    <td className="dash-team-code">{courtroom.name}</td>
                                    <td className="dash-judge-name">{courtroom.details ?? '—'}</td>
                                    <td style={{ display: 'flex', gap: '0.4rem' }}>
                                        <button className="dash-remove-btn" onClick={() => openEditModal(courtroom)}>Edit</button>
                                        <button className="dash-remove-btn" onClick={() => setConfirmRemove(courtroom)}>Remove</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

            {showModal && (
                <div className="modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
                    <div className="confirm-modal" role="dialog" aria-modal="true">
                        <h2>{editingId ? 'Edit courtroom' : 'Add courtroom'}</h2>
                        <form onSubmit={e => { e.preventDefault(); handleSave() }} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                            <label htmlFor="name" style={{ fontSize: '0.875rem', fontWeight: 600 }}>Name</label>
                            <input id="name" type="text" required autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 1A" style={inputStyle} />
                            <label htmlFor="details" style={{ fontSize: '0.875rem', fontWeight: 600, marginTop: '0.25rem' }}>Details (optional)</label>
                            <input id="details" type="text" value={details} onChange={e => setDetails(e.target.value)} placeholder="e.g. 2nd Floor" style={inputStyle} />
                            <div className="confirm-actions">
                                <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" disabled={!name.trim()}>{editingId ? 'Save' : 'Add courtroom'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {confirmRemove && (
                <div className="modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) setConfirmRemove(null) }}>
                    <div className="confirm-modal" role="dialog" aria-modal="true">
                        <h2>Remove courtroom?</h2>
                        <p>Remove {confirmRemove.name} from the courtroom list?</p>
                        <div className="confirm-actions">
                            <button type="button" onClick={() => setConfirmRemove(null)}>Cancel</button>
                            <button type="button" className="confirm-btn-danger" onClick={handleRemove}>Remove</button>
                        </div>
                    </div>
                </div>
            )}
            <button className="org-new-btn" onClick={openAddModal}>+ Add courtroom</button>
        </>
    )
}

export default CourtroomsPage
