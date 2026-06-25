import { Link } from 'react-router-dom'
import { useRegisterForm } from './hooks/useRegisterForm'
import GoogleAuthButton from './GoogleAuthButton'
import PasswordRequirements from './PasswordRequirements'
import './styles/auth-form.css'

const Register = () => {
    const {
        firstName, setFirstName, lastName, setLastName,
        email, setEmail, password, setPassword, confirm, setConfirm,
        error, setError, handleSubmit, handleGoogleSuccess,
    } = useRegisterForm()

    return (
        <main className="auth-main">
            <div className="auth-card">
                <h1>Create account</h1>
                <form className="auth-form" onSubmit={handleSubmit} noValidate>
                    <label htmlFor="firstName">First name</label>
                    <input id="firstName" type="text" autoComplete="given-name" required
                        value={firstName} onChange={e => setFirstName(e.target.value)} />
                    <label htmlFor="lastName">Last name</label>
                    <input id="lastName" type="text" autoComplete="family-name" required
                        value={lastName} onChange={e => setLastName(e.target.value)} />
                    <label htmlFor="email">Email</label>
                    <input id="email" type="email" autoComplete="email" required
                        value={email} onChange={e => setEmail(e.target.value)} />
                    <label htmlFor="password">Password</label>
                    <input id="password" type="password" autoComplete="new-password" required
                        value={password} onChange={e => setPassword(e.target.value)} />
                    {password && <PasswordRequirements password={password} />}
                    <label htmlFor="confirm">Confirm password</label>
                    <input id="confirm" type="password" autoComplete="new-password" required
                        value={confirm} onChange={e => setConfirm(e.target.value)} />
                    {error && <p className="auth-error">{error}</p>}
                    <button type="submit">Create account</button>
                </form>
                <div className="auth-divider"><span>or</span></div>
                <div className="auth-google">
                    <GoogleAuthButton onSuccess={handleGoogleSuccess} onError={setError} />
                </div>
                <p className="auth-footer-text">
                    Already have an account? <Link to="/login">Sign in</Link>
                </p>
            </div>
        </main>
    )
}

export default Register
