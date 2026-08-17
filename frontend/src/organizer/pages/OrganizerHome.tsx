import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/organizer.css'
import type { ITournament, IDuplicateOptions } from '@mock-scores/shared'
import { apiFetch } from '../../auth/auth'
import { fmt } from '../data/utils'
import { DuplicateTournamentModal } from '../components/DuplicateTournamentModal'

const fmtDate = (d: Date | null) => d ? fmt(String(d)) : 'TBD'

const OrganizerHome = () => {
    const navigate = useNavigate()
    const [tournaments, setTournaments] = useState<ITournament[]>([])
    const [duplicating, setDuplicating] = useState<ITournament | null>(null)
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'archived'>('all')

    useEffect(() => {
        apiFetch('/organizer/tournament')
            .then(res => res.ok ? res.json() : [])
            .then((data: ITournament[]) => setTournaments(data))
            .catch(console.error)
    }, [])

    const handleDuplicate = async (options: IDuplicateOptions) => {
        if (!duplicating) return
        const res = await apiFetch(`/organizer/tournament/duplicate/${duplicating.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(options),
        })
        if (res.ok) {
            const newT: ITournament = await res.json()
            setTournaments(prev => [...prev, newT])
        }
    }

    const filteredTournaments = statusFilter === 'all'
        ? tournaments
        : tournaments.filter(t => (t.status ?? 'active') === statusFilter)

    return (
        <main className="org-main">
            <div className="org-container">
                <div className="org-header">
                    <h1>Tournaments</h1>
                    <button className="org-new-btn" onClick={() => navigate('/organizer/new')}>
                        + New tournament
                    </button>
                </div>

                <div className="org-status-filter" role="tablist" aria-label="Filter by status">
                    {(['all', 'active', 'completed', 'archived'] as const).map(s => (
                        <button
                            key={s}
                            role="tab"
                            aria-selected={statusFilter === s}
                            className={`org-status-filter-btn${statusFilter === s ? ' org-status-filter-btn--active' : ''}`}
                            onClick={() => setStatusFilter(s)}
                        >
                            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                            {s !== 'all' && (
                                <span className="org-status-filter-count">
                                    {tournaments.filter(t => (t.status ?? 'active') === s).length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                <div className="org-tournament-list">
                    {filteredTournaments.map(t => (
                        <div
                            key={t.id}
                            className={`org-tournament-card${(t.status ?? 'active') === 'archived' ? ' org-tournament-card--archived' : ''}`}
                        >
                            <div className="org-tournament-info" role="button" tabIndex={0}
                                onClick={() => navigate(`/organizer/${t.id}`)}
                                onKeyDown={e => e.key === 'Enter' && navigate(`/organizer/${t.id}`)}>
                                <span className="org-tournament-name">
                                    {t.name}
                                    {(t.status ?? 'active') !== 'active' && (
                                        <span className={`org-tournament-status org-tournament-status--${t.status ?? 'active'}`}>
                                            {(t.status ?? 'active').toUpperCase()}
                                        </span>
                                    )}
                                </span>
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
                    {filteredTournaments.length === 0 && tournaments.length > 0 && (
                        <p style={{ opacity: 0.6, textAlign: 'center', padding: '24px 0' }}>
                            No {statusFilter} tournaments.
                        </p>
                    )}
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
