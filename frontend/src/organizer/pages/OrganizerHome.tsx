import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/organizer.css'
import type { ITournament } from '../data/dummyData'
import { apiFetch } from '../../auth/auth'

const statusLabel: Record<ITournament['status'], string> = {
    upcoming: 'Upcoming',
    active: 'Active',
    completed: 'Completed',
}

const OrganizerHome = () => {
    const navigate = useNavigate()
    const [tournaments, setTournaments] = useState<ITournament[]>([])

    useEffect(() => {
        apiFetch('/api/tournament')
            .then(res => res.ok ? res.json() : [])
            .then(setTournaments)
            .catch(console.error)
    }, [])

    return (
            <main className="org-main">
                <div className="org-container">
                    <div className="org-header">
                        <h1>Tournaments</h1>
                        <button className="org-new-btn" onClick={() => navigate('/organizer/new')}>
                            + New tournament
                        </button>
                    </div>

                    <div className="org-tournament-list">
                        {tournaments.map(t => (
                            <button
                                key={t.id}
                                className="org-tournament-card"
                                onClick={() => navigate(`/organizer/${t.id}`)}
                            >
                                <div className="org-tournament-info">
                                    <span className="org-tournament-name">{t.name}</span>
                                    <span className="org-tournament-meta">
                                        {' · '}{t.location}
                                        {' · '}{t.teams} teams · {t.rounds} rounds
                                    </span>
                                </div>
                                <span className={`org-status org-status--${t.status}`}>
                                    {statusLabel[t.status]}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </main>

    )
}

export default OrganizerHome
