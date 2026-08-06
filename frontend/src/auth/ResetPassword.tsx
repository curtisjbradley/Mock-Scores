import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { postJson } from './auth'
import { validatePassword } from '../utils/validation'
import PasswordRequirements from './PasswordRequirements'
import './styles/auth-form.css'

const ResetPassword = () => {
    const [params] = useSearchParams()
    const token = params.get('token')

    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    if (!token) {
        return (
            <main className="auth-main">
                <div className="auth-card">
                    <h1>Invalid reset link</h1>
                    <p style={{ lineHeight: 1.6, margin: '0.5rem 0 1.5rem' }}>
                        This password reset link is invalid or has already been used.
                    </p>
                    <Link to="/forgot-password">Request a new reset link</Link>
                </div>
            </main>
        )
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setSubmitted(true)
        setError('')

        try {
            validatePassword(newPassword)
        } catch (err) {
            setError((err as Error).message)
            return
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.')
            return
        }

        const { ok, data } = await postJson<{ message: string }>('/api/auth/reset-password', { token, newPassword })
        if (!ok) {
            setError(data?.message ?? 'Failed to reset password. The link may have expired.')
            return
        }
        setSuccess(true)
    }

    if (success) {
        return (
            <main className="auth-main">
                <div className="auth-card">
                    <h1>Password reset</h1>
                    <p style={{ lineHeight: 1.6, margin: '0.5rem 0 1.5rem' }}>
                        Your password has been successfully reset. You can now sign in with your new password.
                    </p>
                    <Link to="/login" className="auth-link-back">Go to sign in</Link>
                </div>
            </main>
        )
    }

    return (
        <main className="auth-main">
            <div className="auth-card">
                <h1>Choose a new password</h1>
                <form className="auth-form" onSubmit={handleSubmit} noValidate>
                    <label htmlFor="new-pw">New password</label>
                    <input id="new-pw" type="password" autoComplete="new-password" required
                        value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                    {newPassword && <PasswordRequirements password={newPassword} />}

                    <label htmlFor="confirm-pw">Confirm new password</label>
                    <input id="confirm-pw" type="password" autoComplete="new-password" required
                        className={submitted && confirmPassword && confirmPassword !== newPassword ? 'input--invalid' : ''}
                        value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />

                    {error && <p className="auth-error">{error}</p>}
                    <button type="submit">Reset password</button>
                </form>
                <p className="auth-footer-text">
                    <Link to="/login">Back to sign in</Link>
                </p>
            </div>
        </main>
    )
}

export default ResetPassword
