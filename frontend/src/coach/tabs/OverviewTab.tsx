import type { ICoachTournament, ICoachScheduleRound, ICoachResultRound } from '@mock-scores/shared'
import { formatDate } from '../../utils/format'
import type { CoachTab } from '../constants'

interface Props {
    tournament: ICoachTournament
    schedule: ICoachScheduleRound[]
    results: ICoachResultRound[]
    /** Navigate to another dashboard section (used by the quick-link cards). */
    onNavigate: (tab: CoachTab) => void
}

/** A round is "upcoming" when it has a time in the future, or no time set yet. */
function findNextRound(schedule: ICoachScheduleRound[]): ICoachScheduleRound | null {
    const now = Date.now()
    const timed = schedule
        .filter(r => r.round_time && new Date(r.round_time).getTime() >= now)
        .sort((a, b) => new Date(a.round_time!).getTime() - new Date(b.round_time!).getTime())
    if (timed.length > 0) return timed[0]
    // Fall back to the first round without a scheduled time, if any.
    return schedule.find(r => !r.round_time) ?? null
}

/**
 * Landing page for the coach dashboard. Surfaces at-a-glance information:
 * the next upcoming round, team/round counts, roles-to-assign, and a short
 * results record — with quick links into the detailed sections.
 */
export default function OverviewTab({ tournament, schedule, results, onNavigate }: Props) {
    const nextRound = findNextRound(schedule)

    // Count pairings still needing role assignments or witness call order.
    const pendingTasks = schedule.reduce((count, round) => {
        return count + round.pairings.filter(p => !p.has_assignments || !p.has_call_order).length
    }, 0)

    // Compute the team's ballot record from completed results.
    const code = tournament.team_code
    let wins = 0
    let losses = 0
    let ties = 0
    for (const round of results) {
        for (const p of round.pairings) {
            const isProsecution = p.p_team_code === code
            const isDefense = p.d_team_code === code
            if (!isProsecution && !isDefense) continue
            const own = isProsecution ? p.p_points : p.d_points
            const opp = isProsecution ? p.d_points : p.p_points
            if (own > opp) wins++
            else if (own < opp) losses++
            else ties++
        }
    }
    const hasResults = wins + losses + ties > 0

    return (
        <div className="dash-overview">
            <div className="dash-overview-grid">
                {/* Next round — spans full width as the primary highlight */}
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
                            <button className="dash-stat-link" onClick={() => onNavigate('schedule')}>
                                View schedule →
                            </button>
                        </>
                    ) : (
                        <p className="dash-stat-sub">No upcoming rounds scheduled.</p>
                    )}
                </section>

                <section className="dash-stat-card">
                    <h2 className="dash-stat-label">Teams Registered</h2>
                    <p className="dash-stat-value">{tournament.num_teams}</p>
                    <button className="dash-stat-link" onClick={() => onNavigate('field')}>
                        View field →
                    </button>
                </section>

                <section className="dash-stat-card">
                    <h2 className="dash-stat-label">Total Rounds</h2>
                    <p className="dash-stat-value">{tournament.num_rounds}</p>
                    <button className="dash-stat-link" onClick={() => onNavigate('standings')}>
                        View standings →
                    </button>
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
                        <button className="dash-stat-link" onClick={() => onNavigate('schedule')}>
                            Complete prep →
                        </button>
                    )}
                </section>

                <section className="dash-stat-card">
                    <h2 className="dash-stat-label">Ballot Record</h2>
                    {hasResults ? (
                        <>
                            <p className="dash-stat-value">
                                {wins}–{losses}{ties > 0 ? `–${ties}` : ''}
                            </p>
                            <p className="dash-stat-sub">Win–Loss{ties > 0 ? '–Tie' : ''} across scored ballots</p>
                            <button className="dash-stat-link" onClick={() => onNavigate('results')}>
                                View results →
                            </button>
                        </>
                    ) : (
                        <p className="dash-stat-sub">No results published yet.</p>
                    )}
                </section>
            </div>
        </div>
    )
}
