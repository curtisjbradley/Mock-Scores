import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import '../styles/organizer.css'
import '../styles/tabs.css'
import '../styles/rounds.css'
import '../styles/pairings.css'
import '../styles/standings.css'
import { dummyTeams, dummyPairings, dummyTeamInvites, dummyOrganizers, dummyCourtrooms, type ITeamInvite, type IOrganizer } from '../data/dummyData'
import { dateRange } from '../data/utils'
import OverviewTab from '../tabs/OverviewTab'
import StandingsTab from '../tabs/StandingsTab'
import SetupTab from '../tabs/SetupTab'
import { ConfirmRemoveModal } from '../components/modals'
import { getToken } from '../../auth/auth'
import { emptyInfo, emptyCaseFormat, defaultWitnessCategory } from '../types/tournament'
import type { TournamentInfo, CaseFormatState, ScoringCategory } from '../types/tournament'
import type { TournamentPayload } from '@mock-scores/shared'

type Tab = 'overview' | 'standings' | 'setup'
type SetupSubTab = 'tournament' | 'teams' | 'organizers' | 'scorers' | 'courtrooms'

const TournamentDashboard = () => {
    const navigate = useNavigate()
    const { id } = useParams<{ id: string }>()

    const [activeTab, setActiveTab] = useState<Tab>('overview')
    const [setupSubTab, setSetupSubTab] = useState<SetupSubTab>('tournament')

    const [teamInvites, setTeamInvites] = useState<ITeamInvite[]>(() => dummyTeamInvites)
    const [organizers, setOrganizers] = useState<IOrganizer[]>(() => dummyOrganizers)
    const [pairings, setPairings] = useState(() => dummyPairings)
    const [courtroomsState] = useState(() => dummyCourtrooms)
    const [roundNames] = useState<Record<number, string>>({})
    const [confirmRemoveRound, setConfirmRemoveRound] = useState<number | null>(null)

    // Tournament data for editing
    const [tournamentName, setTournamentName] = useState('')
    const [tournamentLocation, setTournamentLocation] = useState('')
    const [tournamentDates, setTournamentDates] = useState<string[]>([])
    const [info, setInfo] = useState<TournamentInfo>(emptyInfo)
    const [caseFormat, setCaseFormat] = useState<CaseFormatState>(emptyCaseFormat)
    const [categories, setCategories] = useState<ScoringCategory[]>([defaultWitnessCategory()])

    useEffect(() => {
        if (!id) return
        fetch(`/api/tournament/${id}`, {
            headers: { Authorization: `Bearer ${getToken()}` },
        })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data) return
                setTournamentName(data.name)
                setTournamentLocation(data.location)
                const dates = [data.start_date, data.end_date].filter(Boolean) as string[]
                setTournamentDates(dates)
                setInfo({
                    name: data.name,
                    location: data.location,
                    startDate: data.start_date ? data.start_date.slice(0, 10) : '',
                    endDate: data.end_date ? data.end_date.slice(0, 10) : '',
                    startTbd: !data.start_date,
                    endTbd: !data.end_date,
                })
                setCaseFormat({
                    caseName: data.case_name,
                    criminalCase: data.criminal_case,
                    pWitnessNames: data.pWitnessNames ?? [],
                    pWitnessesCalled: data.p_witnesses_called ?? '',
                    dWitnessNames: data.dWitnessNames ?? [],
                    dWitnessesCalled: data.d_witnesses_called ?? '',
                    hasSwing: data.has_swing,
                    swingWitnessNames: data.swingWitnessNames?.length ? data.swingWitnessNames : [''],
                })
                if (data.scoringCategories?.length) {
                    setCategories(data.scoringCategories.map((c: ScoringCategory) => ({ ...c })))
                }
            })
    }, [id])

    const handleSaveTournament = async (newInfo: TournamentInfo, newCaseFormat: CaseFormatState, newCategories: ScoringCategory[]) => {
        const payload: TournamentPayload = {
            tournament: {
                name: newInfo.name,
                location: newInfo.location,
                startDate: newInfo.startTbd ? null : newInfo.startDate,
                endDate: newInfo.endTbd ? null : newInfo.endDate,
                startTbd: newInfo.startTbd,
                endTbd: newInfo.endTbd,
            },
            caseFormat: {
                caseName: newCaseFormat.caseName,
                criminalCase: newCaseFormat.criminalCase,
                pWitnessesCalled: newCaseFormat.pWitnessesCalled === '' ? null : newCaseFormat.pWitnessesCalled,
                dWitnessesCalled: newCaseFormat.dWitnessesCalled === '' ? null : newCaseFormat.dWitnessesCalled,
                hasSwing: newCaseFormat.hasSwing,
                pWitnessNames: newCaseFormat.pWitnessNames,
                dWitnessNames: newCaseFormat.dWitnessNames,
                swingWitnessNames: newCaseFormat.hasSwing ? newCaseFormat.swingWitnessNames : [],
            },
            scoringCategories: newCategories.map((cat, catPos) => ({
                name: cat.name,
                witnessCategory: !!cat.witnessCategory,
                position: catPos,
                fields: cat.fields.map((f, fPos) => ({
                    label: f.label, min: f.min, max: f.max, multiplier: f.multiplier,
                    assignable: f.assignable, eligibleForAward: f.eligibleForAward,
                    visibleToScorers: f.visibleToScorers, prosecution: f.prosecution,
                    defense: f.defense, calling: f.calling, crossing: f.crossing, position: fPos,
                })),
            })),
        }
        const res = await fetch(`/api/tournament/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
            body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error(res.statusText)
        setInfo(newInfo)
        setCaseFormat(newCaseFormat)
        setCategories(newCategories)
        setTournamentName(newInfo.name)
        setTournamentLocation(newInfo.location)
        const dates = [newInfo.startTbd ? null : newInfo.startDate, newInfo.endTbd ? null : newInfo.endDate].filter(Boolean) as string[]
        setTournamentDates(dates)
    }

    if (!id) {
        navigate('/organizer', { replace: true })
        return null
    }

    const teams = dummyTeams
    const rounds = [...new Set(pairings.map(p => p.round))].sort((a, b) => a - b)
    const allSheets = pairings.flatMap(p => p.scoresheets)
    const submitted = allSheets.filter(s => s.status === 'submitted').length
    const missing   = allSheets.filter(s => s.status === 'missing').length
    const pending   = allSheets.filter(s => s.status === 'pending').length

    return (
        <main className="org-main">
            <div className="org-container">
                <button className="org-back-btn" onClick={() => navigate('/organizer')}>← All tournaments</button>

                <div className="org-header">
                    <h1>{tournamentName}</h1>
                </div>

                <div className="org-meta-row">
                    <span>{tournamentDates.length ? dateRange(tournamentDates) : ''}</span>
                    <span>{tournamentLocation}</span>
                    <span>{teams.length} teams</span>
                    <span>{rounds.length} rounds</span>
                </div>

                <div className="org-dashboard-grid">
                    <div className="org-dashboard-card"><h2>Teams</h2><p className="org-dashboard-stat">{teams.length}</p></div>
                    <div className="org-dashboard-card"><h2>Scoresheets</h2><p className="org-dashboard-stat">{submitted}/{allSheets.length}</p></div>
                    <div className="org-dashboard-card"><h2>Pending</h2><p className="org-dashboard-stat">{pending}</p></div>
                    <div className="org-dashboard-card"><h2>Missing</h2><p className="org-dashboard-stat org-dashboard-stat--alert">{missing}</p></div>
                </div>

                <div className="dash-tabs">
                    {(['overview', 'standings', 'setup'] as const).map(tab => (
                        <button key={tab} className={`dash-tab${activeTab === tab ? ' dash-tab--active' : ''}`}
                            onClick={() => setActiveTab(tab)}>
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {activeTab === 'setup' && (
                    <div className="dash-subtabs">
                        {(['tournament', 'teams', 'organizers', 'scorers', 'courtrooms'] as const).map(sub => (
                            <button key={sub} className={`dash-subtab${setupSubTab === sub ? ' dash-subtab--active' : ''}`}
                                onClick={() => setSetupSubTab(sub)}>
                                {sub.charAt(0).toUpperCase() + sub.slice(1)}
                            </button>
                        ))}
                    </div>
                )}

                {activeTab === 'overview' && (
                    <OverviewTab
                        tournamentId={id}
                        rounds={rounds}
                        pairings={pairings}
                        roundNames={roundNames}
                        onAddRound={() => {
                            const nextRound = rounds.length > 0 ? Math.max(...rounds) + 1 : 1
                            setPairings(prev => [...prev, {
                                id: `p-new-${Date.now()}`,
                                tournamentId: id,
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
                        onRemoveRound={round => setConfirmRemoveRound(round)}
                    />
                )}

                {activeTab === 'standings' && <StandingsTab teams={teams} />}

                {activeTab === 'setup' && (
                    <SetupTab
                        tournamentId={id}
                        subTab={setupSubTab}
                        info={info}
                        caseFormat={caseFormat}
                        categories={categories}
                        onChangeInfo={setInfo}
                        onChangeCaseFormat={setCaseFormat}
                        onChangeCategories={setCategories}
                        onSaveTournament={handleSaveTournament}
                        teams={teamInvites}
                        organizers={organizers}
                        onAddTeam={inv => setTeamInvites(prev => [...prev, inv])}
                        onRemoveTeam={invId => setTeamInvites(prev => prev.filter(i => i.id !== invId))}
                        onUpdateTeamEmail={(invId, email) => setTeamInvites(prev => prev.map(i => i.id === invId ? { ...i, contactEmail: email } : i))}
                        onAddOrganizer={org => setOrganizers(prev => [...prev, org])}
                        onRemoveOrganizer={orgId => setOrganizers(prev => prev.filter(o => o.id !== orgId))}
                        onUpdateOrgEmail={(orgId, email) => setOrganizers(prev => prev.map(o => o.id === orgId ? { ...o, email } : o))}
                    />
                )}
            </div>
            {confirmRemoveRound !== null && (
                <ConfirmRemoveModal
                    message={`Remove ${roundNames[confirmRemoveRound] ?? `Round ${confirmRemoveRound}`} and all its matchups?`}
                    onCancel={() => setConfirmRemoveRound(null)}
                    onConfirm={() => {
                        setPairings(prev => prev.filter(p => p.round !== confirmRemoveRound))
                        setConfirmRemoveRound(null)
                    }}
                />
            )}
        </main>
    )
}

export default TournamentDashboard
