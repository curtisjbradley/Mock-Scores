import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import '../styles/organizer.css'
import '../styles/tabs.css'
import '../styles/rounds.css'
import '../styles/pairings.css'
import '../styles/standings.css'
import { dateRange } from '../data/utils'
import { apiFetch } from '../../auth/auth'
import type { ITournament } from '@mock-scores/shared'
import { useSearchParamTab } from '../../shared/hooks/useSearchParamTab'
import { type OrganizerTab, type OrganizerScreen, VALID_SCREENS } from '../constants'
import RoundsTab from '../tabs/RoundsTab'
import StandingsTab from '../tabs/StandingsTab'
import WitnessesTab from '../tabs/WitnessesTab'
import ScoringTab from '../tabs/ScoringTab'
import TeamsTab from '../tabs/TeamsTab'
import OrganizersTab from '../tabs/OrganizersTab'
import ScorersTab from '../tabs/ScorersTab'
import CourtroomsTab from '../tabs/CourtroomsTab'
import TournamentSettingsTab from '../tabs/TournamentSettingsTab'
import TiebreakersTab from '../tabs/TiebreakersTab'

const MAIN_CARDS: { label: string; screen: OrganizerScreen }[] = [
    { label: 'Manage Rounds',        screen: 'rounds' },
    { label: 'See Standings',        screen: 'standings' },
    { label: 'Manage Teams',         screen: 'teams' },
    { label: 'Manage Scorers',       screen: 'scorers' },
    { label: 'Manage Courtrooms',    screen: 'courtrooms' },
    { label: 'Manage Organizers',    screen: 'organizers' },
    { label: 'Manage Tournament',    screen: 'tournament' },
    { label: 'Tournament Structure', screen: 'structure' },
]

const STRUCTURE_CARDS: { label: string; tab: OrganizerTab }[] = [
    { label: 'Manage Scorecard',   tab: 'scoring' },
    { label: 'Manage Witnesses',   tab: 'witnesses' },
    { label: 'Manage Tiebreakers', tab: 'tiebreakers' },
]

const STRUCTURE_TABS = new Set<OrganizerTab>(['scoring', 'witnesses', 'tiebreakers'])

export default function TournamentDashboard() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [screen, setScreen] = useSearchParamTab<OrganizerScreen>('home', VALID_SCREENS)
    const [tournament, setTournament] = useState<ITournament | null>(null)
    const [visitedTabs, setVisitedTabs] = useState<Set<OrganizerTab>>(() => {
        if (screen !== 'home' && screen !== 'structure') return new Set([screen as OrganizerTab])
        return new Set()
    })

    useEffect(() => {
        if (!id) { navigate('/organizer', { replace: true }); return }
        apiFetch(`/organizer/tournament/${id}`)
            .then(r => {
                if (r.status === 403) { navigate('/403', { replace: true }); return null }
                return r.ok ? r.json() : null
            })
            .then((data: ITournament | null) => { if (data) setTournament(data) })
            .catch(console.error)
    }, [id, navigate])

    const goToTab = (tab: OrganizerTab) => {
        setScreen(tab)
        setVisitedTabs(prev => new Set([...prev, tab]))
    }

    const goBack = () => {
        if (STRUCTURE_TABS.has(screen as OrganizerTab)) setScreen('structure')
        else if (screen !== 'home') setScreen('home')
        else navigate('/organizer')
    }

    if (!id) return null

    const dates = [tournament?.start_date, tournament?.end_date].filter(Boolean).map(String)
    const activeTab = (screen !== 'home' && screen !== 'structure') ? screen as OrganizerTab : null

    return (
        <main className="org-main">
            <div className="org-container">
                <button className="org-back-btn" onClick={goBack}>
                    {screen === 'home' ? '← All tournaments' : '← Back'}
                </button>

                <div className="org-header">
                    <h1>{tournament?.name ?? ''}</h1>
                </div>

                <div className="org-meta-row">
                    <span>{dates.length ? dateRange(dates) : ''}</span>
                    <span>{tournament?.location ?? ''}</span>
                    {tournament && <span>{tournament.num_teams} teams · {tournament.num_rounds} rounds</span>}
                </div>

                {screen === 'home' && (
                    <div className="dash-card-grid">
                        {MAIN_CARDS.map(c => (
                            <button key={c.screen} className="dash-nav-card"
                                onClick={() => c.screen === 'structure' ? setScreen('structure') : goToTab(c.screen as OrganizerTab)}>
                                {c.label}
                            </button>
                        ))}
                    </div>
                )}

                {screen === 'structure' && (
                    <div className="dash-card-grid">
                        {STRUCTURE_CARDS.map(c => (
                            <button key={c.tab} className="dash-nav-card" onClick={() => goToTab(c.tab)}>
                                {c.label}
                            </button>
                        ))}
                    </div>
                )}

                {visitedTabs.has('tournament') && <div hidden={activeTab !== 'tournament'}><TournamentSettingsTab tournamentId={id} /></div>}
                {visitedTabs.has('teams')      && <div hidden={activeTab !== 'teams'}><TeamsTab tournamentId={id} /></div>}
                {visitedTabs.has('scorers')    && <div hidden={activeTab !== 'scorers'}><ScorersTab tournamentId={id} /></div>}
                {visitedTabs.has('courtrooms') && <div hidden={activeTab !== 'courtrooms'}><CourtroomsTab tournamentId={id} /></div>}
                {visitedTabs.has('organizers') && <div hidden={activeTab !== 'organizers'}><OrganizersTab tournamentId={id} /></div>}
                {visitedTabs.has('witnesses')  && <div hidden={activeTab !== 'witnesses'}><WitnessesTab tournamentId={id} /></div>}
                {visitedTabs.has('scoring')    && <div hidden={activeTab !== 'scoring'}><ScoringTab tournamentId={id} /></div>}
                {visitedTabs.has('rounds')     && <div hidden={activeTab !== 'rounds'}><RoundsTab tournamentId={id} /></div>}
                {visitedTabs.has('standings')  && <div hidden={activeTab !== 'standings'}><StandingsTab tournamentId={id} /></div>}
                {visitedTabs.has('tiebreakers')&& <div hidden={activeTab !== 'tiebreakers'}><TiebreakersTab tournamentId={id} /></div>}
            </div>
        </main>
    )
}
