import { useEffect, useState } from 'react'
import type { ITournament, IRound, IBallotStatus } from '@mock-scores/shared'
import { apiFetch } from '../../auth/auth'
import { formatDate } from '../../utils/format'
import type { OrganizerScreen } from '../constants'

interface Props {
    tournamentId: string
    tournament: ITournament | null
    /** Navigate to another dashboard section (used by the quick-link cards). */
    onNavigate: (screen: OrganizerScreen) => void
}

interface BallotTotals {
    total: number
    submitted: number
}

/** A round is "upcoming" when it has a time in the future, or no time set yet. */
function findNextRound(rounds: IRound[]): IRound | null {
    const now = Date.now()
    const timed = rounds
        .filter(r => r.round_time && new Date(r.round_time).getTime() >= now)
        .sort((a, b) => new Date(a.round_time!).getTime() - new Date(b.round_time!).getTime())
    if (timed.length > 0) return timed[0]
    const sorted = [...rounds].sort((a, b) => a.position - b.position)
    return sorted.find(r => !r.round_time) ?? null
}

/**
 * Landing page for the organizer tournament dashboard. Surfaces at-a-glance
 * operational information — teams, rounds, publish progress, ballot completion,
 * and the next round — with quick links into the detailed management sections.
 */
export default function OverviewTab({ tournamentId, tournament, onNavigate }: Props) {
    const [rounds, setRounds] = useState<IRound[]>([])
    const [ballots, setBallots] = useState<BallotTotals>({ total: 0, submitted: 0 })

    useEffect(() => {
        let cancelled = false
        apiFetch(`/organizer/tournament/${tournamentId}/rounds`)
            .then(r => r.ok ? r.json() : [])
            .then(async (data: IRound[]) => {
                if (cancelled) return
                setRounds(data)
                // Aggregate ballot completion across every round.
                const statuses = await Promise.all(
                    data.map(r =>
                        apiFetch(`/organizer/tournament/${tournamentId}/rounds/${r.round_id}/ballot-status`)
                            .then(res => res.ok ? res.json() : [])
                            .then((s: IBallotStatus[]) => ({
                                total: s.reduce((sum, x) => sum + x.total_scorers, 0),
                                submitted: s.reduce((sum, x) => sum + x.submitted, 0),
                            })),
                    ),
                )
                if (cancelled) return
                setBallots(statuses.reduce(
                    (acc, s) => ({ total: acc.total + s.total, submitted: acc.submitted + s.submitted }),
                    { total: 0, submitted: 0 },
                ))
            })
            .catch(() => { /* overview is best-effort; leave stats empty */ })
        return () => { cancelled = true }
    }, [tournamentId])

    const nextRound = findNextRound(rounds)
    const publishedResults = rounds.filter(r => r.results_public).length
    const publishedPairings = rounds.filter(r => r.teams_public).length
    const ballotPct = ballots.total > 0 ? Math.round((ballots.submitted / ballots.total) * 100) : 0

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
                                {nextRound.teams_public ? 'Pairings published' : 'Pairings not yet published'}
                            </p>
                            <button className="dash-stat-link" onClick={() => onNavigate('rounds')}>
                                Manage rounds →
                            </button>
                        </>
                    ) : (
                        <p className="dash-stat-sub">
                            No rounds yet.{' '}
                            <button className="dash-stat-link" onClick={() => onNavigate('rounds')}>Add a round →</button>
                        </p>
                    )}
                </section>

                <section className="dash-stat-card">
                    <h2 className="dash-stat-label">Teams Registered</h2>
                    <p className="dash-stat-value">{tournament?.num_teams ?? 0}</p>
                    <button className="dash-stat-link" onClick={() => onNavigate('teams')}>
                        Manage teams →
                    </button>
                </section>

                <section className="dash-stat-card">
                    <h2 className="dash-stat-label">Rounds</h2>
                    <p className="dash-stat-value">{rounds.length || (tournament?.num_rounds ?? 0)}</p>
                    <p className="dash-stat-sub">
                        {publishedPairings} with pairings · {publishedResults} with results published
                    </p>
                    <button className="dash-stat-link" onClick={() => onNavigate('rounds')}>
                        Manage rounds →
                    </button>
                </section>

                <section className="dash-stat-card">
                    <h2 className="dash-stat-label">Ballot Completion</h2>
                    {ballots.total > 0 ? (
                        <>
                            <p className="dash-stat-value">{ballotPct}%</p>
                            <div className="dash-stat-progress">
                                <div className="dash-stat-progress-fill" style={{ width: `${ballotPct}%` }} />
                            </div>
                            <p className="dash-stat-sub">{ballots.submitted} of {ballots.total} ballots submitted</p>
                        </>
                    ) : (
                        <p className="dash-stat-sub">No scorers assigned yet.</p>
                    )}
                    <button className="dash-stat-link" onClick={() => onNavigate('scorers')}>
                        Manage scorers →
                    </button>
                </section>

                <section className="dash-stat-card">
                    <h2 className="dash-stat-label">Standings</h2>
                    <p className="dash-stat-sub">
                        {publishedResults > 0
                            ? `${publishedResults} round${publishedResults === 1 ? '' : 's'} scored`
                            : 'No results published yet'}
                    </p>
                    <button className="dash-stat-link" onClick={() => onNavigate('standings')}>
                        View standings →
                    </button>
                </section>
            </div>
        </div>
    )
}
