import { useNavigate } from 'react-router-dom'
import type { ICoachScheduleRound } from '@mock-scores/shared'
import { formatDate } from '../../utils/format'
import { useCoachContext } from '../CoachContext'
import AddButton from "../../shared/components/AddButton.tsx";

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
 * Landing page for the coach dashboard. Reads the tournament, schedule and
 * results from the shared `CoachLayout` context and surfaces at-a-glance
 * information with quick links into the detailed sections.
 */
export default function OverviewPage() {
    const { tournament, schedule, base } = useCoachContext()
    const navigate = useNavigate()

    const nextRound = findNextRound(schedule)

    const pendingTasks = schedule.reduce((count, round) => {
        return count + round.pairings.filter(p => !p.has_assignments || !p.has_call_order).length
    }, 0)


    return (
        <div className="dash-overview">
            <div className="dash-overview-grid">
                <section className="dash-stat-card dash-stat-card--feature">
                    <h2 className="dash-stat-label">Next Round</h2>
                    {nextRound ? (
                        <>
                            <p className="dash-stat-value">{nextRound.name}</p>
                            <p className="dash-stat-sub">
                                {nextRound.round_time ? formatDate(nextRound.round_time) : 'Time TBD'}
                                {' · '}
                                {nextRound.pairings.length} pairing{nextRound.pairings.length === 1 ? '' : 's'}
                            </p>
                            <button className="dash-stat-link" onClick={() => navigate(`${base}/schedule`)}>
                                <AddButton  onClick={() => navigate(`${base}/schedule`)}>View Schedule</AddButton>
                            </button>
                        </>
                    ) : (
                        <p className="dash-stat-sub">No upcoming rounds scheduled.</p>
                    )}
                </section>

                <section className="dash-stat-card">
                    <h2 className="dash-stat-label">Teams Registered</h2>
                    <p className="dash-stat-value">{tournament.num_teams}</p>

                    <AddButton  onClick={() => navigate(`${base}/field`)}>View Field</AddButton>
                </section>

                <section className="dash-stat-card">
                    <h2 className="dash-stat-label">Total Rounds</h2>
                    <p className="dash-stat-value">{tournament.num_rounds}</p>
                    <AddButton  onClick={() => navigate(`${base}/standings`)}>View Standings</AddButton>
                </section>

                <section className={`dash-stat-card${pendingTasks > 0 ? ' dash-stat-card--alert' : ''}`}>
                    <h2 className="dash-stat-label">Pending Prep</h2>
                    <p className="dash-stat-value">{pendingTasks}</p>
                    <p className="dash-stat-sub">
                        {pendingTasks === 0
                            ? 'All roles & call orders set'
                            : `Pairing${pendingTasks === 1 ? '' : 's'} need roles or call order`}
                    </p>
                    {pendingTasks > 0 && (
                        <AddButton className={"dash-button"}  onClick={() => navigate(`${base}/schedule`)}>Complete Prep</AddButton>

                    )}
                </section>
            </div>
        </div>
    )
}
