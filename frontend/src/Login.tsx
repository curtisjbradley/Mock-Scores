import { useState } from 'react'
import { Link } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import './components/layout.css'

const Login = () => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        // TODO: implement login
    }

    return (
        <>
            <Header />
            <main className="auth-main">
                <div className="auth-card">
                    <h1>Sign in</h1>
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
                        <button type="submit">Sign in</button>
                    </form>
                    <p className="auth-footer-text">
                        Don't have an account? <Link to="/register">Register</Link>
                    </p>
                </div>
            </main>
            <Footer />
        </>
    )
}

export default Login
