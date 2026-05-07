import { useState } from 'react'
import { Link } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import './components/layout.css'

const Register = () => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        // TODO: implement registration
    }

    return (
        <>
            <Header />
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
                        <button type="submit">Create account</button>
                    </form>
                    <p className="auth-footer-text">
                        Already have an account? <Link to="/login">Sign in</Link>
                    </p>
                </div>
            </main>
            <Footer />
        </>
    )
}

export default Register
