import { useNavigate } from 'react-router-dom'
import type { ICoachScheduleRound } from '@mock-scores/shared'
import { formatDate } from '../../utils/format'
import { useCoachContext } from '../CoachContext'
import AddButton from '../../shared/components/AddButton.tsx'
import { DashboardStatusCard } from '../../organizer/components/DashboardStatusCard.tsx'

/** A round is "upcoming" when it has a time in the future, or no time set yet. */
function findNextRound(schedule: ICoachScheduleRound[]): ICoachScheduleRound | null {
    const now = Date.now()
    const timed = schedule
        .filter(r => r.round_time && new Date(r.round_time).getTime() >= now)
        .sort((a, b) => new Date(a.round_time!).getTime() - new Date(b.round_time!).getTime())
    if (timed.length > 0) return timed[0]
    return schedule.find(r => !r.round_time) ?? null
}

/**
 * Landing page for the coach dashboard. Reads the tournament, schedule, results
 * and roster from the shared `CoachLayout` context and surfaces at-a-glance
 * information — the next round, prep status, roster size and results — with
 * quick links into the detailed sections. Mirrors the organizer overview:
 * a feature card for the next round followed by actionable alert cards that
 * only appear when the coach has something to do.
 */
export default function OverviewPage() {
    const { tournament, schedule, results, students, coaches, field, base } = useCoachContext()
    const navigate = useNavigate()

    const nextRound = findNextRound(schedule)

    // Prep gaps for this team across the whole schedule.
    const pairingsNeedingRoles = schedule.reduce(
        (count, round) => count + round.pairings.filter(p => !p.has_assignments).length,
        0,
    )
    const pairingsNeedingCallOrder = schedule.reduce(
        (count, round) => count + round.pairings.filter(p => !p.has_call_order).length,
        0,
    )

    // Coaches invited to the team who have not yet accepted their invite.
    const unregisteredCoaches = coaches.filter(c => !c.has_joined).length

    // How many pairings this team has a released result for.
    const completedPairings = results.reduce((count, round) => count + round.pairings.length, 0)

    return (
        <div className="dash-overview">
            <div className="dash-overview-grid">
                <DashboardStatusCard
                    title="Next Round"
                    button={
                        <AddButton onClick={() => navigate(`${base}/schedule`)}>View Schedule</AddButton>
                    }
                >
                    {nextRound ? (
                        <>
                            <h3>{nextRound.name}</h3>
                            {nextRound.round_time && (
                                <h4>
                                    {formatDate(nextRound.round_time)} @{' '}
                                    {new Date(nextRound.round_time).toLocaleTimeString()}
                                </h4>
                            )}
                            <span className="dash-stat-sub">
                                {nextRound.pairings.length} pairing
                                {nextRound.pairings.length === 1 ? '' : 's'}
                            </span>
                        </>
                    ) : (
                        <p>No upcoming rounds scheduled.</p>
                    )}
                </DashboardStatusCard>

                <DashboardStatusCard
                    title="Roster"
                    button={<AddButton onClick={() => navigate(`${base}/roster`)}>Manage Roster</AddButton>}
                >
                    <span className="dash-stat-value">{students.length}</span>
                    <span className="dash-stat-sub">
                        Student{students.length === 1 ? '' : 's'} on your team
                    </span>
                </DashboardStatusCard>

                <DashboardStatusCard
                    title="Results Released"
                    button={<AddButton onClick={() => navigate(`${base}/results`)}>View Results</AddButton>}
                >
                    <span className="dash-stat-value">{completedPairings}</span>
                    <span className="dash-stat-sub">
                        Round{completedPairings === 1 ? '' : 's'} scored so far
                    </span>
                </DashboardStatusCard>

                <DashboardStatusCard
                    title="Field"
                    button={<AddButton onClick={() => navigate(`${base}/field`)}>View Field</AddButton>}
                >
                    <span className="dash-stat-value">{field.length || tournament.num_teams}</span>
                    <span className="dash-stat-sub">Teams competing</span>
                </DashboardStatusCard>

                {/* ── Actionable alerts (only shown when there is work to do) ── */}
                {pairingsNeedingRoles > 0 && (
                    <DashboardStatusCard
                        title="Pairings Missing Roles"
                        button={
                            <AddButton onClick={() => navigate(`${base}/schedule`)}>Assign Roles</AddButton>
                        }
                    >
                        <span className="dash-stat-alert-value">{pairingsNeedingRoles}</span>
                        <span className="dash-stat-alert-sub">
                            Pairing{pairingsNeedingRoles === 1 ? '' : 's'}
                        </span>
                    </DashboardStatusCard>
                )}

                {pairingsNeedingCallOrder > 0 && (
                    <DashboardStatusCard
                        title="Pairings Missing Call Order"
                        button={
                            <AddButton onClick={() => navigate(`${base}/schedule`)}>Set Call Order</AddButton>
                        }
                    >
                        <span className="dash-stat-alert-value">{pairingsNeedingCallOrder}</span>
                        <span className="dash-stat-alert-sub">
                            Pairing{pairingsNeedingCallOrder === 1 ? '' : 's'}
                        </span>
                    </DashboardStatusCard>
                )}

                {unregisteredCoaches > 0 && (
                    <DashboardStatusCard
                        title="Coaches Not Yet Joined"
                        button={
                            <AddButton onClick={() => navigate(`${base}/coaches`)}>Manage Coaches</AddButton>
                        }
                    >
                        <span className="dash-stat-alert-value">{unregisteredCoaches}</span>
                        <span className="dash-stat-alert-sub">
                            Coach{unregisteredCoaches === 1 ? '' : 'es'}
                        </span>
                    </DashboardStatusCard>
                )}
            </div>
        </div>
    )
}
