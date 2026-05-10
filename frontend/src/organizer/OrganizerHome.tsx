import { useNavigate } from 'react-router-dom'
import './styles/organizer.css'
import { dummyTournaments, type ITournament } from './dummyData'

const statusLabel: Record<ITournament['status'], string> = {
    upcoming: 'Upcoming',
    active: 'Active',
    completed: 'Completed',
}

const OrganizerHome = () => {
    const navigate = useNavigate()

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
                        {dummyTournaments.map(t => (
                            <button
                                key={t.id}
                                className="org-tournament-card"
                                onClick={() => navigate(`/organizer/${t.id}`)}
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

export default OrganizerHome
