import { useEffect, useState } from 'react'
import { getSession, logout, apiFetch } from './auth'
import { useNavigate } from 'react-router-dom'
import './styles/account.css'

export function Account() {
    const [email, setEmail] = useState<string | null>(null)
    const navigate = useNavigate()

    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [pwError, setPwError] = useState('')
    const [pwSuccess, setPwSuccess] = useState('')
    const [submitted, setSubmitted] = useState(false)

    useEffect(() => {
        getSession().then(s => {
            if (!s) navigate('/login', { replace: true })
            else setEmail(s.email)
        })
    }, [navigate])

    const handleLogout = () => {
        logout()
        navigate('/login', { replace: true })
    }

    const handleChangePassword = (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitted(true)
        setPwError(''); setPwSuccess('')
        if (!currentPassword || !newPassword || !confirmPassword) return
        if (newPassword.length < 8) { setPwError('New password must be at least 8 characters'); return }
        if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return }
        apiFetch('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) })
            .then(r => r.json().then(d => ({ ok: r.ok, message: d.message })))
            .then(({ ok, message }) => {
                if (!ok) { setPwError(message); return }
                setPwSuccess('Password updated successfully')
                setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setSubmitted(false)
            })
    }

    if (!email) return null

    return (
        <main className="account-main">
            <div className="account-card">
                <h1>Account</h1>
                <div className="account-info">
                    <span className="account-info-label">Email</span>
                    <span className="account-info-value">{email}</span>
                </div>

                <form onSubmit={handleChangePassword} noValidate>
                    <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.75rem' }}>Change password</h2>
                    {pwError && <p className="account-form-error">{pwError}</p>}
                    {pwSuccess && <p className="account-form-success">{pwSuccess}</p>}
                    <div className="account-field">
                        <label className="account-info-label" htmlFor="cur-pw">Current password</label>
                        <input id="cur-pw" type="password" className={`account-input${submitted && !currentPassword ? ' account-input--invalid' : ''}`}
                            value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" />
                    </div>
                    <div className="account-field">
                        <label className="account-info-label" htmlFor="new-pw">New password</label>
                        <input id="new-pw" type="password" className={`account-input${submitted && newPassword.length > 0 && newPassword.length < 8 ? ' account-input--invalid' : ''}`}
                            value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" />
                    </div>
                    <div className="account-field">
                        <label className="account-info-label" htmlFor="confirm-pw">Confirm new password</label>
                        <input id="confirm-pw" type="password" className={`account-input${submitted && confirmPassword && confirmPassword !== newPassword ? ' account-input--invalid' : ''}`}
                            value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" />
                    </div>
                    <button type="submit" className="account-submit">Update password</button>
                </form>

                <button className="account-signout" onClick={handleLogout}>Sign out</button>
            </div>
        </main>
    )
}
