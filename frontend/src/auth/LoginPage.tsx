import { useState } from 'react'
import {Link, useNavigate, useSearchParams} from 'react-router-dom'
import { saveToken } from './auth'
import { isValidEmail } from '../utils/validation'
import './styles/auth-form.css'

interface LoginPageProps {
    title: string
    footerLink?: { text: string; label: string; to: string }
}

const LoginPage = ({ title, footerLink }: LoginPageProps) => {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const redirect = searchParams.get('redirect') ?? '/'
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        if (!isValidEmail(email)) {
            setError('Please enter a valid email address.')
            return
        }
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            })

            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(data.message ?? 'Invalid email or password.')
                return
            }
            saveToken(data.token)
            navigate(redirect)
        } catch {
            setError('Something went wrong. Please try again.')
        }
    }

    return (
        <main className="auth-main">
                <div className="auth-card">
                    <h1>{title}</h1>
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
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                        {error && <p className="auth-error">{error}</p>}
                        <button type="submit">Sign in</button>
                    </form>
                    {footerLink && (
                        <p className="auth-footer-text">
                            {footerLink.text} <Link to={footerLink.to}>{footerLink.label}</Link>
                        </p>
                    )}
                </div>
            </main>
    )
}

export default LoginPage
