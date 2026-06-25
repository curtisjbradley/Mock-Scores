import './styles/header.css'
import { Link } from 'react-router-dom'
import { useSession } from '../shared/hooks/useSession'
import type { Session } from '../auth/auth'

const getInitials = (session: Session): string => {
    const first = session.firstName?.[0] ?? ''
    const last = session.lastName?.[0] ?? ''
    return (first + last).toUpperCase() || '?'
}

const Header = () => {
    const session = useSession()

    return (
        <header className="site-header">
            <span className="site-logo"><Link to="/">MockScores</Link></span>
            {session && (
                <Link to="/account" className="account-button" title={session.email}>
                    <span className="account-avatar" aria-hidden="true">{getInitials(session)}</span>
                    <span className="account-name">{session.firstName}</span>
                    <svg className="account-chevron" aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </Link>
            )}
        </header>
    )
}

export default Header
