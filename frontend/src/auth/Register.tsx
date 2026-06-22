import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { isValidEmail, validatePassword } from '../utils/validation'
import './styles/auth-form.css'
import { GoogleLogin } from '@react-oauth/google'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { GOOGLE_CLIENT_ID, saveToken, apiFetch } from './auth'
import PasswordRequirements from './PasswordRequirements'

const Register = () => {
    const navigate = useNavigate()
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        if (!isValidEmail(email)) {
            setError('Please enter a valid email address.')
            return
        }
        if (password !== confirm) {
            setError('Passwords do not match.')
            return
        }
        const pwError = validatePassword(password)
        if (pwError) { setError(pwError); return }
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    email,
                    password,
                }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                setError(data.message ?? 'Registration failed.')
                return
            }
            navigate('/login')
        } catch {
            setError('Something went wrong. Please try again.')
        }
    }

    return (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <main className="auth-main">
            <div className="auth-card">
                <h1>Create account</h1>
                <form className="auth-form" onSubmit={handleSubmit} noValidate>
                    <label htmlFor="firstName">First name</label>
                    <input
                        id="firstName"
                        type="text"
                        autoComplete="given-name"
                        required
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                    />
                    <label htmlFor="lastName">Last name</label>
                    <input
                        id="lastName"
                        type="text"
                        autoComplete="family-name"
                        required
                        value={lastName}
                        onChange={e => setLastName(e.target.value)}
                    />
                    <label htmlFor="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                    />
                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />
                    {password && <PasswordRequirements password={password} />}
                    <label htmlFor="confirm">Confirm password</label>
                    <input
                        id="confirm"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                    />
                    {error && <p className="auth-error">{error}</p>}
                    <button type="submit">Create account</button>
                </form>
                <div className="auth-divider"><span>or</span></div>
                <div className="auth-google">
                    <GoogleLogin onSuccess={async (credentialResponse) => {
                        if (!credentialResponse.credential) return
                        const res = await apiFetch('/api/auth/google/login', { method: 'POST', body: JSON.stringify({ token: credentialResponse.credential }) })
                        const data = await res.json().catch(() => ({}))
                        if (!res.ok) { setError(data.message ?? 'Unable to sign up with Google.'); return }
                        saveToken(data.token)
                        navigate('/')
                    }} />
                </div>
                <p className="auth-footer-text">
                    Already have an account? <Link to="/login">Sign in</Link>
                </p>
            </div>
        </main>
        </GoogleOAuthProvider>
    )
}

export default Register
