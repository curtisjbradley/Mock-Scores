import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../organizer/styles/organizer.css'
import { apiFetch } from '../auth/auth'
import { formatDateRange } from '../utils/format'
import EmptyState from '../shared/components/EmptyState'
import type { ICoachTournament } from '@mock-scores/shared'

const CoachHome = () => {
    const navigate = useNavigate()
    const [tournaments, setTournaments] = useState<ICoachTournament[]>([])

    useEffect(() => {
        apiFetch('/coach/tournaments')
            .then(r => r.ok ? r.json() : [])
            .then(setTournaments)
            .catch(() => {})
    }, [])

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
                                    {t.start_date ? formatDateRange(t.start_date, t.end_date ?? undefined) : 'TBD'}
                                    {' · '} @ {t.location}
                                    {' · '}{t.num_teams} teams · {t.num_rounds} rounds
                                </span>
                                <span className="org-tournament-meta">{t.team_name} ({t.team_code})</span>
                            </div>
                        </button>
                    ))}
                    {tournaments.length === 0 && <EmptyState message="No tournaments found." />}
                </div>
            </div>
        </main>
    )
}

export default CoachHome
