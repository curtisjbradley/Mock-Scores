import { useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import '../components/layout.css'
import { dummyTournaments, dummySchools } from '../organizer/dummyData'

interface Props {
    isOrganizerView?: boolean
}

const CoachDashboard = ({ isOrganizerView = false }: Props) => {
    const { id, schoolId } = useParams<{ id: string; schoolId?: string }>()
    const navigate = useNavigate()
    const tournament = dummyTournaments.find(t => t.id === id)
    const school = schoolId ? dummySchools.find(s => s.id === schoolId) : null

    if (!tournament) {
        navigate(isOrganizerView ? '/organizer/select' : '/coach/select', { replace: true })
        return null
    }

    const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const dates = tournament.dates
    const dateStr = dates[0] === dates[dates.length - 1] ? fmt(dates[0]) : `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}`

    return (
        <>
            <Header />
            <main className="org-main">
                <div className="org-container">
                    <button className="org-back-btn" onClick={() => navigate(isOrganizerView ? `/organizer/${id}` : '/coach/select')}>
                        {isOrganizerView ? '← Back to tournament' : '← All tournaments'}
                    </button>

                    {isOrganizerView && (
                        <p className="coach-view-banner">Coach View{school ? ` — ${school.name}` : ''}</p>
                    )}

                    <div className="org-header">
                        <h1>{tournament.name}</h1>
                        <span className={`org-status org-status--${tournament.status}`}>
                            {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                        </span>
                    </div>

                    <div className="org-meta-row">
                        <span>{dateStr}</span>
                        <span>{tournament.location}</span>
                        <span>{tournament.teams} teams</span>
                        <span>{tournament.rounds} rounds</span>
                    </div>

                    <div className="coach-section">
                        <h2>My teams</h2>
                        <p className="coach-empty">No teams assigned yet.</p>
                    </div>

                    <div className="coach-section">
                        <h2>Schedule</h2>
                        <p className="coach-empty">No rounds scheduled yet.</p>
                    </div>

                    <div className="coach-section">
                        <h2>Results</h2>
                        <p className="coach-empty">No results available yet.</p>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    )
}

export default CoachDashboard
