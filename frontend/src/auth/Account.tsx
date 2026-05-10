import { useEffect, useState } from 'react'
import { getSession, logout } from './auth'
import { useNavigate } from 'react-router-dom'
import './styles/account.css'

export function Account() {
    const [email, setEmail] = useState<string | null>(null)
    const navigate = useNavigate()

    useEffect(() => {
        getSession().then(s => {
            if (!s) navigate('/login', { replace: true })
            else setEmail(s.email)
        })
    }, [navigate])

    const handleLogout = () => {
        logout()
        navigate('/login', { replace: true })
    }

    if (!email) return null

    return (
        <main className="account-main">
            <div className="account-card">
                <h1>Account</h1>
                <div className="account-info">
                    <span className="account-info-label">Email</span>
                    <span className="account-info-value">{email}</span>
                </div>
                <button className="account-signout" onClick={handleLogout}>Sign out</button>
            </div>
        </main>
    )
}
