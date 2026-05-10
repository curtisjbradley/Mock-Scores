import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/organizer.css'
import '../styles/tabs.css'
import '../styles/rounds.css'
import '../styles/pairings.css'
import '../styles/standings.css'
// TODO: fetch tournament by id from GET /api/tournaments/:id (replace dummyTournaments[0])
// TODO: fetch teams from GET /api/tournaments/:id/teams (replace dummyTeams)
// TODO: fetch pairings from GET /api/tournaments/:id/pairings (replace dummyPairings)
// TODO: fetch invites from GET /api/tournaments/:id/invites (replace dummyInvites)
// TODO: fetch organizers from GET /api/tournaments/:id/organizers (replace dummyOrganizers)
// TODO: fetch courtrooms from GET /api/tournaments/:id/courtrooms (replace dummyCourtrooms)
import { dummyTournaments, dummyTeams, dummyPairings, dummyInvites, dummyOrganizers, dummyCourtrooms, type IInvite, type IOrganizer } from '../data/dummyData'
import { dateRange } from '../data/utils'
import OverviewTab from '../tabs/OverviewTab'
import RoundsTab from '../tabs/RoundsTab'
import StandingsTab from '../tabs/StandingsTab'
import SetupTab from '../tabs/SetupTab'

type Tab = 'overview' | 'rounds' | 'standings' | 'setup'
type SetupSubTab = 'invites' | 'organizers' | 'scorers' | 'courtrooms'

const TournamentDashboard = () => {
    const navigate = useNavigate()
    const tournament = dummyTournaments[0]

    const [activeTab, setActiveTab] = useState<Tab>('overview')
    const [setupSubTab, setSetupSubTab] = useState<SetupSubTab>('invites')

    const [invites, setInvites] = useState<IInvite[]>(() => dummyInvites)
    const [organizers, setOrganizers] = useState<IOrganizer[]>(() => dummyOrganizers)
    const [pairings, setPairings] = useState(() => dummyPairings)
    const [courtroomsState] = useState(() => dummyCourtrooms)
    const [roundNames] = useState<Record<number, string>>({})

    if (!tournament) {
        navigate('/organizer/select', { replace: true })
        return null
    }

    const teams = dummyTeams
    const rounds = [...new Set(pairings.map(p => p.round))].sort((a, b) => a - b)
    const allSheets = pairings.flatMap(p => p.scoresheets)
    const submitted = allSheets.filter(s => s.status === 'submitted').length
    const missing   = allSheets.filter(s => s.status === 'missing').length
    const pending   = allSheets.filter(s => s.status === 'pending').length
    const id= 't2';
    return (


            <main className="org-main">
                <div className="org-container">
                    <button className="org-back-btn" onClick={() => navigate('/organizer/select')}>← All tournaments</button>

                    <div className="org-header">
                        <h1>{tournament.name}</h1>
                        <span className={`org-status org-status--${tournament.status}`}>
                            {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                        </span>
                    </div>

                    <div className="org-meta-row">
                        <span>{dateRange(tournament.dates)}</span>
                        <span>{tournament.location}</span>
                        <span>{tournament.teams} teams</span>
                        <span>{tournament.rounds} rounds</span>
                    </div>

                    <div className="org-dashboard-grid">
                        <div className="org-dashboard-card"><h2>Teams</h2><p className="org-dashboard-stat">{teams.length || tournament.teams}</p></div>
                        <div className="org-dashboard-card"><h2>Scoresheets</h2><p className="org-dashboard-stat">{submitted}/{allSheets.length}</p></div>
                        <div className="org-dashboard-card"><h2>Pending</h2><p className="org-dashboard-stat">{pending}</p></div>
                        <div className="org-dashboard-card"><h2>Missing</h2><p className="org-dashboard-stat org-dashboard-stat--alert">{missing}</p></div>
                    </div>

                    <div className="dash-tabs">
                        {(['overview', 'rounds', 'standings', 'setup'] as const).map(tab => (
                            <button key={tab} className={`dash-tab${activeTab === tab ? ' dash-tab--active' : ''}`}
                                onClick={() => setActiveTab(tab)}>
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'setup' && (
                        <div className="dash-subtabs">
                            {(['invites', 'organizers', 'scorers', 'courtrooms'] as const).map(sub => (
                                <button key={sub} className={`dash-subtab${setupSubTab === sub ? ' dash-subtab--active' : ''}`}
                                    onClick={() => setSetupSubTab(sub)}>
                                    {sub.charAt(0).toUpperCase() + sub.slice(1)}
                                </button>
                            ))}
                        </div>
                    )}

                    {activeTab === 'overview' && (
                        <OverviewTab
                            tournamentId={id!}
                            rounds={rounds}
                            pairings={pairings}
                            roundNames={roundNames}
                            onAddRound={() => {
                                // TODO: POST /api/tournaments/:id/rounds to create round, then refetch pairings
                                const nextRound = rounds.length > 0 ? Math.max(...rounds) + 1 : 1
                                setPairings(prev => [...prev, {
                                    id: `p-new-${Date.now()}`,
                                    tournamentId: id!,
                                    round: nextRound,
                                    date: new Date().toISOString().slice(0, 10),
                                    courtroom: courtroomsState[0]?.name ?? '1A',
                                    prosecutionTeamId: '',
                                    defenseTeamId: '',
                                    scoresheets: [],
                                    isPublished: false,
                                    resultsPublished: false,
                                }])
                            }}
                            onTogglePublish={(round, isPublished) =>
                                // TODO: PATCH /api/tournaments/:id/rounds/:round { isPublished: !isPublished }
                                setPairings(prev => prev.map(p => p.round === round ? { ...p, isPublished: !isPublished } : p))
                            }
                            onToggleResults={(round, resultsPublished) =>
                                // TODO: PATCH /api/tournaments/:id/rounds/:round { resultsPublished: !resultsPublished }
                                setPairings(prev => prev.map(p => p.round === round ? { ...p, resultsPublished: !resultsPublished } : p))
                            }
                        />
                    )}

                    {activeTab === 'rounds' && (
                        <RoundsTab
                            tournamentId={id!}
                            rounds={rounds}
                            pairings={pairings}
                            roundNames={roundNames}
                        />
                    )}

                    {activeTab === 'standings' && <StandingsTab teams={teams} />}

                    {activeTab === 'setup' && (
                        <SetupTab
                            tournamentId={id!}
                            subTab={setupSubTab}
                            invites={invites}
                            organizers={organizers}
                            onAddInvite={inv => setInvites(prev => [...prev, inv])}
                            onRemoveInvite={invId => setInvites(prev => prev.filter(i => i.id !== invId))}
                            onAddOrganizer={org => setOrganizers(prev => [...prev, org])}
                            onRemoveOrganizer={orgId => setOrganizers(prev => prev.filter(o => o.id !== orgId))}
                            onUpdateOrgEmail={(orgId, email) => setOrganizers(prev => prev.map(o => o.id === orgId ? { ...o, email } : o))}
                        />
                    )}
                </div>
            </main>


    )
}

export default TournamentDashboard
