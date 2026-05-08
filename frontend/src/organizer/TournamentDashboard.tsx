import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import '../components/layout.css'
import { dummyTournaments, dummyTeams, dummyPairings, dummyInvites, dummyOrganizers, dummyCourtrooms, type IInvite, type IOrganizer } from './dummyData'
import { dateRange } from './utils'
import OverviewTab from './OverviewTab'
import RoundsTab from './RoundsTab'
import StandingsTab from './StandingsTab'
import SetupTab from './SetupTab'

type Tab = 'overview' | 'rounds' | 'standings' | 'setup'
type SetupSubTab = 'invites' | 'organizers' | 'scorers' | 'courtrooms'

const TournamentDashboard = () => {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const tournament = dummyTournaments.find(t => t.id === id)

    const [activeTab, setActiveTab] = useState<Tab>('overview')
    const [setupSubTab, setSetupSubTab] = useState<SetupSubTab>('invites')

    const [invites, setInvites] = useState<IInvite[]>(() => dummyInvites.filter(i => i.tournamentId === id))
    const [organizers, setOrganizers] = useState<IOrganizer[]>(() => dummyOrganizers.filter(o => o.tournamentId === id))
    const [pairings, setPairings] = useState(() => dummyPairings.filter(p => p.tournamentId === id))
    const [courtroomsState] = useState(() => dummyCourtrooms.filter(c => c.tournamentId === id))
    const [roundNames] = useState<Record<number, string>>({})

    if (!tournament) {
        navigate('/organizer/select', { replace: true })
        return null
    }

    const teams = dummyTeams.filter(t => t.tournamentId === id)
    const rounds = [...new Set(pairings.map(p => p.round))].sort((a, b) => a - b)
    const allSheets = pairings.flatMap(p => p.scoresheets)
    const submitted = allSheets.filter(s => s.status === 'submitted').length
    const missing   = allSheets.filter(s => s.status === 'missing').length
    const pending   = allSheets.filter(s => s.status === 'pending').length

    return (
        <>
            <Header />
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
                                setPairings(prev => prev.map(p => p.round === round ? { ...p, isPublished: !isPublished } : p))
                            }
                            onToggleResults={(round, resultsPublished) =>
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
            <Footer />
        </>
    )
}

export default TournamentDashboard
