import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import '../styles/organizer.css'
import '../styles/tabs.css'
import '../styles/rounds.css'
import '../styles/pairings.css'
import '../styles/standings.css'
import '../../shared/styles/dashboard.css'
import { apiFetch } from '../../auth/auth'
import type { ITournament } from '@mock-scores/shared'
import { useSearchParamTab } from '../../shared/hooks/useSearchParamTab'
import DashboardSidebar, { type DashboardNavItem } from '../../shared/components/DashboardSidebar'
import { type OrganizerTab, type OrganizerScreen, VALID_SCREENS } from '../constants'
import OverviewTab from '../tabs/OverviewTab'
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
import AwardCategoriesTab from '../tabs/AwardCategoriesTab'

// Primary navigation — icon names map to SVGs in `public/icons/`.
const NAV_ITEMS: DashboardNavItem<OrganizerScreen>[] = [
    { key: 'overview',   label: 'Overview',   icon: 'Overview' },
    { key: 'rounds',     label: 'Rounds',     icon: 'Rounds' },
    { key: 'standings',  label: 'Standings',  icon: 'Standings' },
    { key: 'teams',      label: 'Teams',      icon: 'Teams' },
    { key: 'scorers',    label: 'Scorers',    icon: 'Scorers' },
    { key: 'courtrooms', label: 'Courtrooms', icon: 'Courtrooms' },
    { key: 'organizers', label: 'Organizers', icon: 'Organizers' },
    { key: 'structure',  label: 'Structure',  icon: 'Settings' },
]

const STRUCTURE_CARDS: { label: string; tab: OrganizerTab }[] = [
    { label: 'Tournament Details',  tab: 'tournament' },
    { label: 'Manage Scorecard',    tab: 'scoring' },
    { label: 'Manage Witnesses',    tab: 'witnesses' },
    { label: 'Manage Awards',       tab: 'awards' },
    { label: 'Manage Tiebreakers',  tab: 'tiebreakers' },
]

const STRUCTURE_TABS = new Set<OrganizerTab>(['tournament', 'scoring', 'witnesses', 'tiebreakers', 'awards'])

export default function TournamentDashboard() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [screen, setScreen] = useSearchParamTab<OrganizerScreen>('overview', VALID_SCREENS)
    const [tournament, setTournament] = useState<ITournament | null>(null)
    const [visitedTabs, setVisitedTabs] = useState<Set<OrganizerTab>>(() => {
        if (screen !== 'overview' && screen !== 'structure') return new Set([screen as OrganizerTab])
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

    // Sidebar selection. "structure" reveals a card grid; tabs are lazily mounted.
    const onNavSelect = (next: OrganizerScreen) => {
        if (next === 'overview' || next === 'structure') setScreen(next)
        else goToTab(next as OrganizerTab)
    }

    if (!id) return null

    const activeTab = (screen !== 'overview' && screen !== 'structure') ? screen as OrganizerTab : null
    // Highlight "Structure" in the sidebar while viewing any structure sub-tab.
    const activeNav: OrganizerScreen = STRUCTURE_TABS.has(screen as OrganizerTab) ? 'structure' : screen

    return (
        <main className="org-main">
            <div className="dash-shell">
                <DashboardSidebar
                    items={NAV_ITEMS}
                    active={activeNav}
                    onChange={onNavSelect}
                    title={tournament?.name ?? 'Tournament'}
                    subtitle={tournament?.location ?? undefined}
                    ariaLabel="Tournament dashboard sections"
                />

                <div className="dash-content">

                    {screen === 'overview' && (
                        <OverviewTab tournamentId={id} tournament={tournament} onNavigate={onNavSelect} />
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
                    {visitedTabs.has('awards')     && <div hidden={activeTab !== 'awards'}><AwardCategoriesTab tournamentId={id} /></div>}
                </div>
            </div>
        </main>
    )
}
