import { Link } from 'react-router-dom'
import { useLoginForm } from './hooks/useLoginForm'
import GoogleAuthButton from './GoogleAuthButton'
import './styles/auth-form.css'

interface LoginPageProps {
    title: string
    footerLink?: { text: string; label: string; to: string }
}

const LoginPage = ({ title, footerLink }: LoginPageProps) => {
    const { email, setEmail, password, setPassword, error, setError, handleSubmit, handleGoogleSuccess } = useLoginForm()

    return (
        <main className="auth-main">
            <div className="auth-card">
                <h1>{title}</h1>
                <form className="auth-form" onSubmit={handleSubmit} noValidate>
                    <label htmlFor="email">Email</label>
                    <input id="email" type="email" autoComplete="email" required
                        value={email} onChange={e => setEmail(e.target.value)} />
                    <label htmlFor="password">Password</label>
                    <input id="password" type="password" autoComplete="current-password" required
                        value={password} onChange={e => setPassword(e.target.value)} />
                    {error && <p className="auth-error">{error}</p>}
                    <button type="submit">Sign in</button>
                </form>
                <div className="auth-divider"><span>or</span></div>
                <div className="auth-google">
                    <GoogleAuthButton onSuccess={handleGoogleSuccess} onError={setError} />
                </div>
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
