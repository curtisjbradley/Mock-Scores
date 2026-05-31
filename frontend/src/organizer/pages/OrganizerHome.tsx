import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/organizer.css'
import type { ITournament } from '@mock-scores/shared'
import { apiFetch } from '../../auth/auth'
import { fmt } from '../data/utils'
import { DuplicateTournamentModal } from '../components/DuplicateTournamentModal'

const fmtDate = (d: Date | null) => d ? fmt(String(d)) : 'TBD'

const OrganizerHome = () => {
    const navigate = useNavigate()
    const [tournaments, setTournaments] = useState<ITournament[]>([])
    const [duplicating, setDuplicating] = useState<ITournament | null>(null)

    useEffect(() => {
        apiFetch('/api/organizer/tournament')
            .then(res => res.ok ? res.json() : [])
            .then((data: ITournament[]) => setTournaments(data))
            .catch(console.error)
    }, [])

    const handleDuplicate = async (options: {
        scorers: boolean; courtrooms: boolean; scoringCategories: boolean; witnesses: boolean; format: boolean
    }) => {
        if (!duplicating) return
        const res = await apiFetch(`/api/organizer/tournament/duplicate/${duplicating.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(options),
        })
        if (res.ok) {
            const newT: ITournament = await res.json()
            setTournaments(prev => [...prev, newT])
        }
    }

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
                        <div
                            key={t.id}
                            className="org-tournament-card"
                        >
                            <div className="org-tournament-info" role="button" tabIndex={0}
                                onClick={() => navigate(`/organizer/${t.id}`)}
                                onKeyDown={e => e.key === 'Enter' && navigate(`/organizer/${t.id}`)}>
                                <span className="org-tournament-name">{t.name}</span>
                                <span className="org-tournament-meta">
                                    {fmtDate(t.start_date)} – {fmtDate(t.end_date)}
                                    {' · '}{t.location}
                                    {' · '}{t.num_teams} teams · {t.num_rounds} rounds
                                </span>
                            </div>
                            <button
                                className="org-duplicate-btn"
                                aria-label={`Duplicate ${t.name}`}
                                onClick={() => setDuplicating(t)}
                            >
                                Duplicate
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {duplicating && (
                <DuplicateTournamentModal
                    tournamentName={duplicating.name}
                    onClose={() => setDuplicating(null)}
                    onDuplicate={handleDuplicate}
                />
            )}
        </main>
    )
}

export default OrganizerHome
