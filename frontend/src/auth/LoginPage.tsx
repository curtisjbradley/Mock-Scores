import { Link } from 'react-router-dom'
import { useLoginForm } from './hooks/useLoginForm'
import GoogleAuthButton from './GoogleAuthButton'
import './styles/auth-form.css'


const LoginPage = () => {
    const { email, setEmail, password, setPassword, error, setError, handleSubmit, handleGoogleSuccess } = useLoginForm()

    return (
        <main className="auth-main">
            <div className="auth-card">
                <h1>Sign In</h1>
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
               <div >
                   <p className="auth-footer-text">
                       <Link to="/register">Create an Account</Link>
                   </p>
                   <p className="auth-footer-text">
                       <Link to="/forgot-password">Forgot Password?</Link>
                   </p>
               </div>
            </div>
        </main>
    )
}

export default LoginPage
