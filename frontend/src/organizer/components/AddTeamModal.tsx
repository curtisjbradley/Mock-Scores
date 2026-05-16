import { useState } from 'react'
import '../../judges/styles/modal.css'
import { isValidEmail } from '../../utils/validation'

interface Props {
    onClose: () => void
    onAdd: (name: string, email: string, code: string) => void
    existingNames: string[]
}

const AddTeamModal = ({ onClose, onAdd, existingNames }: Props) => {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [code, setCode] = useState('')

    const isDuplicate = existingNames.some(n => n.toLowerCase() === name.trim().toLowerCase())

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim() || !isValidEmail(email) || isDuplicate) return
        onAdd(name.trim(), email.trim(), code.trim() || name.trim())
        onClose()
    }

    const valid = name.trim() && isValidEmail(email) && !isDuplicate

    return (
        <div className="modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="add-team-title">
                <h2 id="add-team-title">Invite a team</h2>
                <p>An invitation will be sent to the coach's email address.</p>

                <form onSubmit={handleSubmit} noValidate className="modal-form">
                    <label htmlFor="team-name" className="modal-label">Team name</label>
                    <input
                        id="team-name"
                        type="text"
                        required
                        autoFocus
                        className={`modal-input${isDuplicate ? ' modal-input--invalid' : ''}`}
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g Morro Bay High School"
                    />
                    <label htmlFor="team-code" className="modal-label">Team code <span style={{ fontWeight: 'normal', opacity: 0.6 }}>(optional)</span></label>
                    <input
                        id="team-code"
                        type="text"
                        className="modal-input"
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        placeholder={name.trim() || 'Defaults to team name'}
                    />
                    <label htmlFor="school-email" className="modal-label">Coach email</label>
                    <input
                        id="school-email"
                        type="email"
                        required
                        className={`modal-input${email && !isValidEmail(email) ? ' modal-input--invalid' : ''}`}
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="coach@school.edu"
                    />

                    <div className="confirm-actions">
                        <button type="button" onClick={onClose}>Cancel</button>
                        <button type="submit" disabled={!valid}>Send invite</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default AddTeamModal
