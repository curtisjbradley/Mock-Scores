import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './styles/auth-form.css'

const Register = () => {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        if (password !== confirm) {
            setError('Passwords do not match.')
            return
        }
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
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
        <main className="auth-main">
            <div className="auth-card">
                <h1>Create account</h1>
                <form className="auth-form" onSubmit={handleSubmit} noValidate>
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
                <p className="auth-footer-text">
                    Already have an account? <Link to="/login">Sign in</Link>
                </p>
            </div>
        </main>
    )
}

export default Register
