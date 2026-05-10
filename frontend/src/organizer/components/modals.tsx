import { useState } from 'react'
import '../../judges/styles/modal.css'

export function ConfirmRemoveModal({ message, onCancel, onConfirm }: {
    message: string
    onCancel: () => void
    onConfirm: () => void
}) {
    return (
        <div className="modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
            <div className="confirm-modal" role="dialog" aria-modal="true">
                <h2>Are you sure?</h2>
                <p>{message}</p>
                <div className="confirm-actions">
                    <button type="button" onClick={onCancel}>Cancel</button>
                    <button type="button" className="confirm-btn-danger" onClick={onConfirm}>Remove</button>
                </div>
            </div>
        </div>
    )
}

export function AddOrganizerModal({ onClose, onAdd }: {
    onClose: () => void
    onAdd: (name: string, email: string) => void
}) {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const valid = name.trim() && email.trim()
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!valid) return
        onAdd(name.trim(), email.trim())
        onClose()
    }
    const inputStyle = {
        height: '2.75rem', padding: '0 0.75rem',
        border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)',
        background: 'var(--surface)', color: 'var(--text)',
        fontSize: '1rem', fontFamily: 'inherit',
    } as const
    return (
        <div className="modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="add-org-title">
                <h2 id="add-org-title">Add organizer</h2>
                <p>They will be added as a co-organizer for this tournament.</p>
                <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                    <label htmlFor="org-name" style={{ fontSize: '0.875rem', fontWeight: 600 }}>Name</label>
                    <input id="org-name" type="text" required autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Full name" style={inputStyle} />
                    <label htmlFor="org-email" style={{ fontSize: '0.875rem', fontWeight: 600, marginTop: '0.25rem' }}>Email</label>
                    <input id="org-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="organizer@crf.org" style={inputStyle} />
                    <div className="confirm-actions">
                        <button type="button" onClick={onClose}>Cancel</button>
                        <button type="submit" disabled={!valid}>Add organizer</button>
                    </div>
                </form>
            </div>
        </div>
    )
}
