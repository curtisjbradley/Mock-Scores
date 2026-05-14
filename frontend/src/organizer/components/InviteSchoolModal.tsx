import { useState } from 'react'
import '../../judges/styles/modal.css'
import { isValidEmail } from '../../utils/validation'

interface Props {
    onClose: () => void
    onInvite: (school: string, email: string) => void
}

const InviteSchoolModal = ({ onClose, onInvite }: Props) => {
    const [school, setSchool] = useState('')
    const [email, setEmail] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!school.trim() || !email.trim()) return
        onInvite(school.trim(), email.trim())
        onClose()
    }

    const valid = school.trim() && isValidEmail(email)

    return (
        <div className="modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="invite-title">
                <h2 id="invite-title">Invite a team</h2>
                <p>An invitation will be sent to the coach's email address.</p>

                <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                    <label htmlFor="school-name" style={{ fontSize: '0.875rem', fontWeight: 600 }}>Team name</label>
                    <input
                        id="school-name"
                        type="text"
                        required
                        autoFocus
                        value={school}
                        onChange={e => setSchool(e.target.value)}
                        placeholder="e.g. Lincoln High"
                        style={{ height: '2.75rem', padding: '0 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', fontSize: '1rem', fontFamily: 'inherit' }}
                    />
                    <label htmlFor="school-email" style={{ fontSize: '0.875rem', fontWeight: 600, marginTop: '0.25rem' }}>Coach email</label>
                    <input
                        id="school-email"
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="coach@school.edu"
                        style={{ height: '2.75rem', padding: '0 0.75rem', border: `1px solid ${email && !isValidEmail(email) ? 'var(--danger)' : 'var(--border-strong)'}`, borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', fontSize: '1rem', fontFamily: 'inherit' }}
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

export default InviteSchoolModal
