import { useEffect, useState } from 'react'
import { getSession, logout } from './auth'
import { useNavigate } from 'react-router-dom'

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
        <main style={{ padding: '2rem' }}>
            <h1>Account</h1>
            <p>{email}</p>
            <button onClick={handleLogout}>Sign out</button>
        </main>
    )
}
