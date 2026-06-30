import { useEffect, useState } from 'react'
import { getSession, logout } from './auth'
import { validatePassword } from '../utils/validation'
import PasswordRequirements from './PasswordRequirements'
import { useNavigate } from 'react-router-dom'
import { useChangePasswordForm } from './hooks/useChangePasswordForm'
import './styles/account.css'

function isPasswordInvalid(password: string): boolean {
    try { validatePassword(password); return false; } catch { return true; }
}

export function Account() {
    const [email, setEmail] = useState<string | null>(null)
    const navigate = useNavigate()
    const {
        currentPassword, setCurrentPassword,
        newPassword, setNewPassword,
        confirmPassword, setConfirmPassword,
        pwError, pwSuccess, submitted,
        handleSubmit,
    } = useChangePasswordForm()

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

    if (!email) return null

    return (
        <main className="account-main">
            <div className="account-card">
                <h1>Account</h1>
                <div className="account-info">
                    <span className="account-info-label">Email</span>
                    <span className="account-info-value">{email}</span>
                </div>

                <form onSubmit={handleSubmit} noValidate>
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
                        <input id="new-pw" type="password" className={`account-input${submitted && newPassword.length > 0 && isPasswordInvalid(newPassword) ? ' account-input--invalid' : ''}`}
                            value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" />
                        {newPassword && <PasswordRequirements password={newPassword} />}
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
