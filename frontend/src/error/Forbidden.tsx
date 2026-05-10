import { Link, useNavigate } from 'react-router-dom'
import './styles/notfound.css'

const Forbidden = () => {
    const navigate = useNavigate()
    const prev = document.referrer
    const canGoBack = prev && !prev.includes('/login') && new URL(prev).origin === window.location.origin

    return (
        <main className="notfound-main">
            <div className="notfound-code">403</div>
            <h2>Access denied</h2>
            <p>You don't have permission to view this page.</p>
            {canGoBack && (
                <button className="notfound-back-btn" onClick={() => navigate(-1)}>← Go back</button>
            )}
            <Link to="/">← Go home</Link>
        </main>
    )
}

export default Forbidden
