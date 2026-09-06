import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { postJson } from './auth'
import './styles/auth-form.css'

const ForgotPassword = () => {
    const [email, setEmail] = useState('')
    const [error, setError] = useState('')
    const [sent, setSent] = useState(false)

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError('')
        if (!email.trim()) { setError('Please enter your email address.'); return }
        const { ok, data } = await postJson<{ message: string }>('/auth/forgot-password', { email: email.trim() })
        if (!ok && data?.message) { setError(data.message); return }
        setSent(true)
    }

    if (sent) {
        return (
            <main className="auth-main">
                <div className="auth-card">
                    <h1>Check your email</h1>
                    <p className="auth-message">
                        If an account exists for <strong>{email}</strong>, we've sent a password reset link.
                        Please check your inbox (and spam folder).
                    </p>
                    <Link to="/login" className="auth-link-back">Back to sign in</Link>
                </div>
            </main>
        )
    }

    return (
        <main className="auth-main">
            <div className="auth-card">
                <h1>Reset your password</h1>
                <p className="auth-intro">
                    Enter your email address and we'll send you a link to reset your password.
                </p>
                <form className="auth-form" onSubmit={handleSubmit} noValidate>
                    <label htmlFor="reset-email">Email</label>
                    <input id="reset-email" type="email" autoComplete="email" required
                        value={email} onChange={e => setEmail(e.target.value)} />
                    {error && <p className="auth-error">{error}</p>}
                    <button type="submit">Send reset link</button>
                </form>
                <p className="auth-footer-text">
                    Remember your password? <Link to="/login">Sign in</Link>
                </p>
            </div>
        </main>
    )
}

export default ForgotPassword
