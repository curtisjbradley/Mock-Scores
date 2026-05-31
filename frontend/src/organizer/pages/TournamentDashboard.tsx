import { Component } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import '../styles/organizer.css'
import '../styles/tabs.css'
import '../styles/rounds.css'
import '../styles/pairings.css'
import '../styles/standings.css'
import { dateRange } from '../data/utils'
import { apiFetch } from '../../auth/auth'
import type { ITournament } from '@mock-scores/shared'
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

type Tab = 'tournament' | 'teams' | 'scorers' | 'courtrooms' | 'organizers' | 'witnesses' | 'scoring' | 'rounds' | 'standings' | 'tiebreakers'
type Screen = 'home' | 'structure' | Tab

const STRUCTURE_TABS: Tab[] = ['scoring', 'witnesses', 'tiebreakers']

const MAIN_CARDS: { label: string; screen: Screen }[] = [
    { label: 'Manage Rounds',        screen: 'rounds' },
    { label: 'See Standings',        screen: 'standings' },
    { label: 'Manage Teams',         screen: 'teams' },
    { label: 'Manage Scorers',       screen: 'scorers' },
    { label: 'Manage Courtrooms',    screen: 'courtrooms' },
    { label: 'Manage Organizers',    screen: 'organizers' },
    { label: 'Manage Tournament',    screen: 'tournament' },
    { label: 'Tournament Structure', screen: 'structure' },
]

const STRUCTURE_CARDS: { label: string; tab: Tab }[] = [
    { label: 'Manage Scorecard',    tab: 'scoring' },
    { label: 'Manage Witnesses',    tab: 'witnesses' },
    { label: 'Manage Tiebreakers',  tab: 'tiebreakers' },
]

interface Props {
    id: string
    navigate: ReturnType<typeof useNavigate>
    screen: Screen
    setScreen: (s: Screen) => void
}
interface State { tournament: ITournament | null; visitedTabs: Set<Tab> }

class TournamentDashboardClass extends Component<Props, State> {
    state: State = { tournament: null, visitedTabs: new Set() }

    componentDidMount() {
        // If a valid tab is in the URL, mark it visited immediately
        const { screen } = this.props
        if (screen !== 'home' && screen !== 'structure') {
            this.setState(s => ({ visitedTabs: new Set([...s.visitedTabs, screen as Tab]) }))
        }
        apiFetch(`/api/organizer/tournament/${this.props.id}`)
            .then(r => {
                if (r.status === 403) { this.props.navigate('/403', { replace: true }); return null }
                return r.ok ? r.json() : null
            })
            .then((data: ITournament | null) => { if (data) this.setState({ tournament: data }) })
            .catch(console.error)
    }

    setTab(tab: Tab) {
        this.props.setScreen(tab)
        this.setState(s => ({ visitedTabs: new Set([...s.visitedTabs, tab]) }))
    }

    goBack() {
        const { screen } = this.props
        if (STRUCTURE_TABS.includes(screen as Tab)) this.props.setScreen('structure')
        else if (screen !== 'home') this.props.setScreen('home')
        else this.props.navigate('/organizer')
    }

    render() {
        const { id, screen } = this.props
        const { tournament, visitedTabs } = this.state
        const dates = [tournament?.start_date, tournament?.end_date].filter(Boolean).map(String)
        const activeTab = (screen !== 'home' && screen !== 'structure') ? screen as Tab : null

        return (
            <main className="org-main">
                <div className="org-container">
                    <button className="org-back-btn" onClick={() => this.goBack()}>
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
                                    onClick={() => c.screen === 'structure' ? this.props.setScreen('structure') : this.setTab(c.screen as Tab)}>
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {screen === 'structure' && (
                        <div className="dash-card-grid">
                            {STRUCTURE_CARDS.map(c => (
                                <button key={c.tab} className="dash-nav-card" onClick={() => this.setTab(c.tab)}>
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
                    {visitedTabs.has('standings')   && <div hidden={activeTab !== 'standings'}><StandingsTab tournamentId={id} /></div>}
                    {visitedTabs.has('tiebreakers') && <div hidden={activeTab !== 'tiebreakers'}><TiebreakersTab tournamentId={id} /></div>}
                </div>
            </main>
        )
    }
}

const VALID_SCREENS = new Set(['home', 'structure', 'tournament', 'teams', 'scorers', 'courtrooms', 'organizers', 'witnesses', 'scoring', 'rounds', 'standings', 'tiebreakers'])

export default function TournamentDashboard() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()

    if (!id) { navigate('/organizer', { replace: true }); return null }

    const pageParam = searchParams.get('page') ?? 'home'
    const screen: Screen = VALID_SCREENS.has(pageParam) ? pageParam as Screen : 'home'

    const setScreen = (s: Screen) => {
        if (s === 'home') setSearchParams({}, { replace: true })
        else setSearchParams({ page: s }, { replace: true })
    }

    return <TournamentDashboardClass id={id} navigate={navigate} screen={screen} setScreen={setScreen} />
}
