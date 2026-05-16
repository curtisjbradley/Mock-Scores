import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/organizer.css'
import type { ITournament } from '@mock-scores/shared'
import { apiFetch } from '../../auth/auth'
import { fmt } from '../data/utils'

const fmtDate = (d: Date | null) => d ? fmt(String(d)) : 'TBD'

const OrganizerHome = () => {
    const navigate = useNavigate()
    const [tournaments, setTournaments] = useState<ITournament[]>([])

    useEffect(() => {
        apiFetch('/api/organizer/tournament')
            .then(res => res.ok ? res.json() : [])
            .then((data: ITournament[]) => setTournaments(data))
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
                                        {fmtDate(t.start_date)} – {fmtDate(t.end_date)}
                                        {' · '}{t.location}
                                        {' · '}{t.num_teams} teams · {t.num_rounds} rounds
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </main>

    )
}

export default OrganizerHome
