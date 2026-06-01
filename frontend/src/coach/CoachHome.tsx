import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../organizer/styles/organizer.css'
import { apiFetch } from '../auth/auth'
import type { ICoachTournament } from '@mock-scores/shared'

const CoachHome = () => {
    const navigate = useNavigate()
    const [tournaments, setTournaments] = useState<ICoachTournament[]>([])

    useEffect(() => {
        apiFetch('/api/coach/tournaments')
            .then(r => r.ok ? r.json() : [])
            .then(setTournaments)
            .catch(() => {})
    }, [])

    const fmt = (d: string | Date) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

    return (
        <main className="org-main">
            <div className="org-container">
                <h1>Select a tournament</h1>
                <div className="org-tournament-list">
                    {tournaments.map(t => (
                        <button
                            key={t.team_id}
                            className="org-tournament-card"
                            onClick={() => navigate(`/coach/${t.id}`)}
                        >
                            <div className="org-tournament-info">
                                <span className="org-tournament-name">{t.team_name} - {t.name}</span>
                                <span className="org-tournament-meta">
                                    {t.start_date ? fmt(t.start_date) : 'TBD'}
                                    {t.end_date && t.end_date !== t.start_date ? ` – ${fmt(t.end_date)}` : ''}
                                    {' · '} @ {t.location}
                                    {' · '}{t.num_teams} teams · {t.num_rounds} rounds
                                </span>
                                <span className="org-tournament-meta">{t.team_name} ({t.team_code})</span>
                            </div>
                        </button>
                    ))}
                    {tournaments.length === 0 && <p className="coach-empty">No tournaments found.</p>}
                </div>
            </div>
        </main>
    )
}

export default CoachHome
