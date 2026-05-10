import { useNavigate } from 'react-router-dom'
import '../organizer/organizer.css'
import { dummyTournaments, dummyInvites, CURRENT_SCHOOL_ID, type ITournament } from '../organizer/dummyData'

const statusLabel: Record<ITournament['status'], string> = {
    upcoming: 'Upcoming',
    active: 'Active',
    completed: 'Completed',
}

const CoachHome = () => {
    const navigate = useNavigate()

    const myTournamentIds = new Set(
        dummyInvites
            .filter(i => i.schoolId === CURRENT_SCHOOL_ID && i.status == 'accepted')
            .map(i => i.tournamentId)
    )
    const tournaments = dummyTournaments.filter(t => myTournamentIds.has(t.id))

    return (
            <main className="org-main">
                <div className="org-container">
                    <h1>Select a tournament</h1>
                    <div className="org-tournament-list">
                        {tournaments.map(t => (
                            <button
                                key={t.id}
                                className="org-tournament-card"
                                onClick={() => navigate(`/coach/${t.id}`)}
                            >
                                <div className="org-tournament-info">
                                    <span className="org-tournament-name">{t.name}</span>
                                    <span className="org-tournament-meta">
                                        {t.dates[0] === t.dates[t.dates.length-1] ? new Date(t.dates[0]).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : new Date(t.dates[0]).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + ' – ' + new Date(t.dates[t.dates.length-1]).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
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

export default CoachHome
