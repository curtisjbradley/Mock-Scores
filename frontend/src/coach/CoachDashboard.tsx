import { useNavigate, useParams } from 'react-router-dom'
import '../organizer/styles/organizer.css'
import '../organizer/styles/tabs.css'
import '../organizer/styles/standings.css'
import '../organizer/styles/pairings.css'
import { useSearchParamTab } from '../shared/hooks/useSearchParamTab'
import { useCoachDashboard } from './hooks/useCoachDashboard'
import { formatDateRange } from '../utils/format'
import TabBar from '../shared/components/TabBar'
import type { CoachTab } from './constants'
import ScheduleTab from './tabs/ScheduleTab'
import ResultsTab from './tabs/ResultsTab'
import CoachesTab from './tabs/CoachesTab'
import RosterTab from './tabs/RosterTab'
import FieldTab from './tabs/FieldTab'
import StandingsTab from './tabs/StandingsTab'

const COACH_TABS: { key: CoachTab; label: string }[] = [
    { key: 'schedule',  label: 'Schedule' },
    { key: 'results',   label: 'Results' },
    { key: 'coaches',   label: 'Coaches' },
    { key: 'roster',    label: 'Roster' },
    { key: 'field',     label: 'Field' },
    { key: 'standings', label: 'Standings' },
]

const VALID_TABS = new Set(COACH_TABS.map(t => t.key))

interface Props { isOrganizerView?: boolean }

export default function CoachDashboard({ isOrganizerView = false }: Props) {
    const { id, schoolId } = useParams<{ id: string; schoolId?: string }>()
    const navigate = useNavigate()
    const [tab, setTab] = useSearchParamTab<CoachTab>('schedule', VALID_TABS)
    const {
        tournament, schedule, results, coaches, students, field,
        standingsRows, standingsCols, standingsXml,
        teamId,
        addCoach, removeCoach, makeOwner, addStudent, removeStudent,
    } = useCoachDashboard(id, tab, isOrganizerView, schoolId)

    if (!tournament) return null

    const dateStr = tournament.start_date
        ? formatDateRange(tournament.start_date, tournament.end_date ?? undefined)
        : 'TBD'

    return (
        <main className="org-main">
            <div className="org-container">
                <button className="org-back-btn" onClick={() => navigate(isOrganizerView ? `/organizer/${id}?page=teams` : '/coach')}>
                    {isOrganizerView ? '← Back to tournament' : '← All tournaments'}
                </button>
                <div className="org-header">
                    <div>
                        <h1>{tournament.team_name || tournament.name} ({tournament.team_code})</h1>
                        <h2 className="org-header-sub">{tournament.name}</h2>
                    </div>
                </div>
                <div className="org-meta-row">
                    <span>{dateStr}</span><span> @ {tournament.location}</span>
                    <span>{tournament.num_teams} teams</span><span>{tournament.num_rounds} rounds</span>
                </div>

                <TabBar tabs={COACH_TABS} active={tab} onChange={setTab} />

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
                {tab === 'results' && <ResultsTab results={results} />}
                {tab === 'coaches' && (
                    <CoachesTab
                        coaches={coaches}
                        isOrganizerView={isOrganizerView}
                        onAdd={addCoach}
                        onRemove={removeCoach}
                        onMakeOwner={makeOwner}
                    />
                )}
                {tab === 'roster' && <RosterTab students={students} onAdd={addStudent} onRemove={removeStudent} />}
                {tab === 'field' && <FieldTab field={field} />}
                {tab === 'standings' && <StandingsTab rows={standingsRows} cols={standingsCols} standingsXml={standingsXml} />}
            </div>
        </main>
    )
}
