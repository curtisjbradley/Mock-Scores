import { useState } from 'react'
import '../../judges/styles/modal.css'
import { isValidEmail } from '../../utils/validation'
import type { ITeam } from '@mock-scores/shared'

export function ConfirmRemoveModal({ message, onCancel, onConfirm, confirmLabel = 'Remove' }: {
    message: string
    onCancel: () => void
    onConfirm: () => void
    confirmLabel?: string
}) {
    return (
        <div className="modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
            <div className="confirm-modal" role="dialog" aria-modal="true">
                <h2>Are you sure?</h2>
                <p>{message}</p>
                <div className="confirm-actions">
                    <button type="button" className="btn-cancel" onClick={onCancel}>Cancel</button>
                    <button type="button" className="confirm-btn-danger" onClick={onConfirm}>{confirmLabel}</button>
                </div>
            </div>
        </div>
    )
}

export function AddOrganizerModal({ onClose, onAdd, title = 'Add organizer', description = 'They will be added as a co-organizer for this tournament.', submitLabel = 'Add organizer' }: {
    onClose: () => void
    onAdd: (name: string, email: string) => void
    title?: string
    description?: string
    submitLabel?: string
}) {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const valid = name.trim() && isValidEmail(email)
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!valid) return
        onAdd(name.trim(), email.trim())
        onClose()
    }
    return (
        <div className="modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="add-org-title">
                <h2 id="add-org-title">{title}</h2>
                <p>{description}</p>
                <form onSubmit={handleSubmit} noValidate className="modal-form">
                    <label htmlFor="org-name" className="modal-label">Name</label>
                    <input id="org-name" type="text" required autoFocus className="modal-input" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
                    <label htmlFor="org-email" className="modal-label">Email</label>
                    <input id="org-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="organizer@crf.org"
                        className={`modal-input${email && !isValidEmail(email) ? ' modal-input--invalid' : ''}`} />
                    <div className="confirm-actions">
                        <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn-confirm" disabled={!valid}>{submitLabel}</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export function EditTeamModal({ team, existingNames, onClose, onSave }: {
    team: ITeam
    existingNames: string[]
    onClose: () => void
    onSave: (name: string, code: string) => void
}) {
    const [name, setName] = useState(team.name)
    const [code, setCode] = useState(team.code)

    const isDuplicate = name.trim().toLowerCase() !== team.name.toLowerCase() &&
        existingNames.some(n => n.toLowerCase() === name.trim().toLowerCase())
    const valid = name.trim() && !isDuplicate

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!valid) return
        onSave(name.trim(), code.trim() || name.trim())
        onClose()
    }

    return (
        <div className="modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="edit-team-title">
                <h2 id="edit-team-title">Edit team</h2>
                <form onSubmit={handleSubmit} noValidate className="modal-form">
                    <label htmlFor="edit-team-name" className="modal-label">Team name</label>
                    <input id="edit-team-name" type="text" required autoFocus
                        className={`modal-input${isDuplicate ? ' modal-input--invalid' : ''}`}
                        value={name} onChange={e => setName(e.target.value)} />
                    <label htmlFor="edit-team-code" className="modal-label">Team code <span style={{ fontWeight: 'normal', opacity: 0.6 }}>(optional)</span></label>
                    <input id="edit-team-code" type="text"
                        className="modal-input"
                        value={code} onChange={e => setCode(e.target.value)}
                        placeholder={name.trim() || team.name} />
                    <div className="confirm-actions">
                        <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn-confirm" disabled={!valid}>Save</button>
                    </div>
                </form>
            </div>
        </div>
    )
}
