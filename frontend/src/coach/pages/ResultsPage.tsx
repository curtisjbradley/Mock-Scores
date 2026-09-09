import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ICoachResultPairing } from '@mock-scores/shared'
import { type BallotDetail, useCoachContext } from '../CoachContext'
import { parseDsl } from '../../organizer/blockly/standingsDsl'
import type { StandingsConfig } from '../../organizer/blockly/standingsGenerator'
import { computePairingStats, formatStatValue, type PairingBallot } from '../pairingStats'
import RoundGroup from '../components/RoundGroup'
import '../styles/results.css'

/** Maps a point differential to the win/loss/tie diff-cell modifier class. */
function diffClass(diff: number): string {
    return diff > 0 ? 'coach-diff-cell--pos' : diff < 0 ? 'coach-diff-cell--neg' : 'coach-diff-cell--tie'
}

/**
 * Per-pairing standings input, grouped from the raw standings ballots by
 * `pairing_id`. Each entry keeps the individual scorer ballots plus the
 * presider tiebreaker outcome so we can compute the tournament's stats for
 * just that trial.
 */
interface PairingGroup {
    ballots: PairingBallot[]
    tiebreakerWinner: 'P' | 'D' | null
}

/**
 * Results page. Instead of only showing raw prosecution/defense points — which
 * carry little meaning when a tournament tabulates on ballots won, point
 * differential, or a custom stat — this computes the tournament's own standings
 * columns for each trial (via the shared standings engine and the tournament's
 * DSL config) and shows them per side. Falls back to raw P/D points when the
 * tournament has no standings config.
 */
export default function ResultsPage() {
    const { teamId, results, standings, loadBallots } = useCoachContext()

    const [expanded, setExpanded] = useState<string | null>(null)
    const [ballots, setBallots] = useState<Record<string, BallotDetail[]>>({})
    const [loadingId, setLoadingId] = useState<string | null>(null)

    // Parse the tournament's standings DSL once. `null` → no per-trial stats,
    // so we fall back to raw points.
    const config = useMemo<StandingsConfig | null>(() => {
        if (!standings?.config?.dsl) return null
        try {
            return parseDsl(standings.config.dsl)
        } catch (e) {
            console.error('Standings DSL parse failed:', e)
            return null
        }
    }, [standings])

    // Group the raw standings ballots by pairing so each trial's individual
    // scorer ballots and tiebreaker outcome are available for computation.
    const pairingGroups = useMemo<Map<string, PairingGroup>>(() => {
        const map = new Map<string, PairingGroup>()
        for (const b of standings?.ballots ?? []) {
            const g = map.get(b.pairing_id) ?? { ballots: [], tiebreakerWinner: null }
            g.ballots.push({
                p_points: b.p_points,
                d_points: b.d_points,
                presider_ballot: b.presider_ballot,
                tiebreaker: b.tiebreaker,
            })
            // The presider ballot carries the pairing's tiebreaker (winning team id);
            // translate it to which side (P/D) won.
            if (b.presider_ballot && b.tiebreaker) {
                g.tiebreakerWinner = b.tiebreaker === b.p_team_id ? 'P' : b.tiebreaker === b.d_team_id ? 'D' : g.tiebreakerWinner
            }
            map.set(b.pairing_id, g)
        }
        return map
    }, [standings])

    const togglePairing = async (pairingId: string) => {
        if (expanded === pairingId) { setExpanded(null); return }
        setExpanded(pairingId)
        if (ballots[pairingId]) return // already loaded
        setLoadingId(pairingId)
        try {
            const data = await loadBallots(pairingId)
            setBallots(prev => ({ ...prev, [pairingId]: data }))
        } finally {
            setLoadingId(null)
        }
    }

    if (results.length === 0) return <p className="coach-empty">No results published yet.</p>

    // Column headers come from the tournament's config; fall back to points.
    const statCols = config?.columns ?? null

    /** Renders the expanded ballot-detail cell shared by both layouts. */
    const renderBallotDetail = (p: ICoachResultPairing, roundName: string, roundTime: string | null, colSpan: number) => {
        const pairingBallots = ballots[p.pairing_id]
        return (
            <td colSpan={colSpan} className="coach-ballot-cell">
                {loadingId === p.pairing_id && <span className="coach-ballot-status">Loading ballots…</span>}
                {pairingBallots && pairingBallots.length === 0 && <span className="coach-ballot-status coach-ballot-status--empty">No individual ballots available.</span>}
                {pairingBallots && pairingBallots.length > 0 && (
                    <>
                        <div className="coach-ballot-link-row">
                            <Link to={`/coach/${teamId}/pairing/${p.pairing_id}/scoresheet?roundName=${encodeURIComponent(roundName)}${roundTime ? `&roundTime=${encodeURIComponent(roundTime)}` : ''}`} className="pc-view-btn">View combined scoresheet</Link>
                        </div>
                        <table className="coach-ballot-table">
                            <thead><tr>
                                <th className="coach-ballot-col-label">Ballot</th>
                                <th className="coach-ballot-col-center">P</th>
                                <th className="coach-ballot-col-center">D</th>
                                <th className="coach-ballot-col-center">Result</th>
                                <th></th>
                            </tr></thead>
                            <tbody>{pairingBallots.map((b, i) => {
                                const bd = b.p_points - b.d_points
                                return (
                                    <tr key={i}>
                                        <td>Ballot {i + 1}</td>
                                        <td className="coach-ballot-col-center">{b.p_points}</td>
                                        <td className="coach-ballot-col-center">{b.d_points}</td>
                                        <td className={`coach-ballot-result ${diffClass(bd)}`}>
                                            {bd > 0 ? `+${bd} P Win` : bd < 0 ? `${bd} D Win` : 'Tie'}
                                        </td>
                                        <td>
                                            <Link to={`/coach/${teamId}/ballot/${p.pairing_id}/${b.assignment_id}`} className="pc-view-btn">View ballot</Link>
                                        </td>
                                    </tr>
                                )
                            })}</tbody>
                        </table>
                    </>
                )}
            </td>
        )
    }

    return (
        <>
            {results.map(round => (
                <RoundGroup key={round.round_id} heading={round.name}>
                    {statCols ? (
                        // ── Stat-driven layout: two rows per pairing (P then D), each
                        //    showing the tournament's configured standings columns. ──
                        <table className="dash-standings-table coach-results-table">
                            <thead><tr>
                                <th>Side</th>
                                <th>Team</th>
                                {statCols.map(c => <th key={c.stat} className="coach-stat-col">{c.label}</th>)}
                                <th></th>
                            </tr></thead>
                            {round.pairings.map(p => {
                                const group = pairingGroups.get(p.pairing_id)
                                const stats = group && config
                                    ? computePairingStats(config, group.ballots, p.p_team_code, p.d_team_code, group.tiebreakerWinner)
                                    : null
                                const isExpanded = expanded === p.pairing_id
                                const colSpan = statCols.length + 3
                                return (
                                    <tbody key={p.pairing_id} className="coach-pairing-group">
                                        <tr onClick={() => togglePairing(p.pairing_id)} className="coach-pairing-row coach-pairing-row--top">
                                            <td className="coach-side-cell">P{stats?.prosecution.wonTiebreaker && <span className="coach-tb-badge" title="Won presider tiebreaker">TB</span>}</td>
                                            <td>{p.p_team_name} ({p.p_team_code})</td>
                                            {statCols.map(c => {
                                                const cell = stats?.prosecution.cells.find(x => x.stat === c.stat)
                                                return <td key={c.stat} className="coach-stat-col"><strong>{cell ? formatStatValue(cell.value) : '—'}</strong></td>
                                            })}
                                            <td rowSpan={2} className="coach-expand-cell">{isExpanded ? '▲' : '▼'}</td> {/*TODO: Add custom icons*/}
                                        </tr>
                                        <tr onClick={() => togglePairing(p.pairing_id)} className="coach-pairing-row coach-pairing-row--bottom">
                                            <td className="coach-side-cell">D{stats?.defense.wonTiebreaker && <span className="coach-tb-badge" title="Won presider tiebreaker">TB</span>}</td>
                                            <td>{p.d_team_name} ({p.d_team_code})</td>
                                            {statCols.map(c => {
                                                const cell = stats?.defense.cells.find(x => x.stat === c.stat)
                                                return <td key={c.stat} className="coach-stat-col"><strong>{cell ? formatStatValue(cell.value) : '—'}</strong></td>
                                            })}
                                        </tr>
                                        {isExpanded && (
                                            <tr className="coach-ballot-detail-row">{renderBallotDetail(p, round.name, round.round_time, colSpan)}</tr>
                                        )}
                                    </tbody>
                                )
                            })}
                        </table>
                    ) : (
                        // ── Fallback: raw prosecution/defense points. ──
                        <table className="dash-standings-table">
                            <thead><tr><th>Prosecution</th><th>P Pts</th><th>Defense</th><th>D Pts</th><th></th></tr></thead>
                            <tbody>{round.pairings.map(p => {
                                const isExpanded = expanded === p.pairing_id
                                const diff = p.p_points - p.d_points
                                return (
                                    <Fragment key={p.pairing_id}>
                                        <tr onClick={() => togglePairing(p.pairing_id)} className="coach-pairing-row">
                                            <td>{p.p_team_code} - {p.p_team_name}</td><td><strong>{p.p_points}</strong></td>
                                            <td>{p.d_team_code} - {p.d_team_name}</td><td><strong>{p.d_points}</strong></td>
                                            <td className={`coach-diff-cell ${diffClass(diff)}`}>
                                                {diff > 0 ? `+${diff} P` : diff < 0 ? `${diff} D` : 'Tie'}
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr>{renderBallotDetail(p, round.name, round.round_time, 5)}</tr>
                                        )}
                                    </Fragment>
                                )
                            })}</tbody>
                        </table>
                    )}
                </RoundGroup>
            ))}
        </>
    )
}
