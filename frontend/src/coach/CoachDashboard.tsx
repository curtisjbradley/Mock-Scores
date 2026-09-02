import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import '../organizer/styles/organizer.css'
import '../organizer/styles/tabs.css'
import '../organizer/styles/standings.css'
import '../organizer/styles/pairings.css'
import '../shared/styles/dashboard.css'
import { useSearchParamTab } from '../shared/hooks/useSearchParamTab'
import { useCoachDashboard } from './hooks/useCoachDashboard'
import DashboardSidebar, { type DashboardNavItem } from '../shared/components/DashboardSidebar'
import type { CoachTab } from './constants'
import OverviewTab from './tabs/OverviewTab'
import ScheduleTab from './tabs/ScheduleTab'
import ResultsTab from './tabs/ResultsTab'
import CoachesTab from './tabs/CoachesTab'
import RosterTab from './tabs/RosterTab'
import FieldTab from './tabs/FieldTab'
import StandingsTab from './tabs/StandingsTab'

// Placeholder icon glyphs — swap for designed icons later without touching layout.
const NAV_ITEMS: DashboardNavItem<CoachTab>[] = [
    { key: 'overview',  label: 'Overview',  icon: '▦' },
    { key: 'schedule',  label: 'Schedule',  icon: '▤' },
    { key: 'results',   label: 'Results',   icon: '◈' },
    { key: 'coaches',   label: 'Coaches',   icon: '◎' },
    { key: 'roster',    label: 'Roster',    icon: '☰' },
    { key: 'field',     label: 'Field',     icon: '⬡' },
    { key: 'standings', label: 'Standings', icon: '▲' },
]

const VALID_TABS = new Set<CoachTab>(NAV_ITEMS.map(t => t.key))

const SIDEBAR_STORAGE_KEY = 'coach-sidebar-collapsed'

interface Props { isOrganizerView?: boolean }

export default function CoachDashboard({ isOrganizerView = false }: Props) {
    const { id, schoolId } = useParams<{ id: string; schoolId?: string }>()
    const navigate = useNavigate()
    const [tab, setTab] = useSearchParamTab<CoachTab>('overview', VALID_TABS)

    const [collapsed, setCollapsed] = useState<boolean>(() => {
        try {
            return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
        } catch {
            return false
        }
    })
    const toggleCollapsed = () => {
        setCollapsed(prev => {
            const next = !prev
            try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)) } catch { /* ignore */ }
            return next
        })
    }

    const {
        tournament, schedule, results, coaches, students, field,
        standingsRows, standingsCols, standingsXml,
        teamId,
        addCoach, removeCoach, makeOwner, addStudent, removeStudent,
    } = useCoachDashboard(id, tab, isOrganizerView, schoolId)

    if (!tournament) return null

    return (
        <main className="org-main">
            <div className="dash-shell">
                <DashboardSidebar
                    items={NAV_ITEMS}
                    active={tab}
                    onChange={setTab}
                    collapsed={collapsed}
                    onToggleCollapse={toggleCollapsed}
                    title={tournament.team_code || tournament.team_name || 'Team'}
                    subtitle={tournament.team_name}
                    ariaLabel="Coach dashboard sections"
                />

                <div className="dash-content">
                    <button
                        className="org-back-btn"
                        onClick={() => navigate(isOrganizerView ? `/organizer/${id}?page=teams` : '/coach')}
                    >
                        {isOrganizerView ? '← Back to tournament' : '← All tournaments'}
                    </button>


                    {tab === 'overview' && <OverviewTab
                        tournament={tournament}
                        schedule={schedule}
                        results={results}
                        onNavigate={setTab}
                    />}
                    {tab === 'schedule' && <ScheduleTab
                        schedule={schedule}
                        teamId={teamId}
                        onAssignRoles={(pairingId, side) => navigate(
                            isOrganizerView
                                ? `/organizer/${id}/school/${teamId}/assign-roles/${pairingId}/${side}`
                                : `/coach/${id}/assign-roles/${teamId}/${pairingId}/${side}`
                        )}
                        onWitnessOrder={(pairingId) => {
                            const pairing = schedule.flatMap(r => r.pairings).find(p => p.pairing_id === pairingId)
                            const side = pairing?.d_team_code === tournament.team_code ? 'd' : 'p'
                            navigate(isOrganizerView
                                ? `/organizer/${id}/school/${teamId}/witness-order/${pairingId}?side=${side}`
                                : `/coach/${id}/witness-order/${teamId}/${pairingId}?side=${side}`)
                        }}
                    />}
                    {tab === 'results' && <ResultsTab results={results} tournamentId={id ?? ''} />}
                    {tab === 'coaches' && (
                        <CoachesTab
                            coaches={coaches}
                            isOrganizerView={isOrganizerView}
                            onAdd={addCoach}
                            onRemove={removeCoach}
                            onMakeOwner={makeOwner}
                        />
                    )}
                    {tab === 'roster' && <RosterTab students={students} tournamentId={id ?? ''} teamId={teamId} onAdd={addStudent} onRemove={removeStudent} />}
                    {tab === 'field' && <FieldTab field={field} />}
                    {tab === 'standings' && <StandingsTab rows={standingsRows} cols={standingsCols} standingsXml={standingsXml} />}
                </div>
            </div>
        </main>
    )
}
