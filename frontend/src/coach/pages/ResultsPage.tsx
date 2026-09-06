import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { type BallotDetail, useCoachContext } from '../CoachContext'
import '../styles/coach-pages.css'

/** Maps a point differential to the win/loss/tie diff-cell modifier class. */
function diffClass(diff: number): string {
    return diff > 0 ? 'coach-diff-cell--pos' : diff < 0 ? 'coach-diff-cell--neg' : 'coach-diff-cell--tie'
}

/**
 * Results page. Reads published results from the shared `CoachLayout` context
 * and lazily loads per-pairing ballot detail (via the context loader) on
 * expand. Keeps only its own expand/loading UI state locally.
 */
export default function ResultsPage() {
    const { teamId, results, loadBallots } = useCoachContext()

    const [expanded, setExpanded] = useState<string | null>(null)
    const [ballots, setBallots] = useState<Record<string, BallotDetail[]>>({})
    const [loadingId, setLoadingId] = useState<string | null>(null)

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

    return (
        <>
            {results.map(round => (
                <div key={round.round_id} className="coach-round-group">
                    <h3 className="coach-round-heading">{round.name}</h3>
                    <table className="dash-standings-table">
                        <thead><tr><th>Prosecution</th><th>P Pts</th><th>Defense</th><th>D Pts</th><th></th></tr></thead>
                        <tbody>{round.pairings.map(p => {
                            const isExpanded = expanded === p.pairing_id
                            const pairingBallots = ballots[p.pairing_id]
                            const diff = p.p_points - p.d_points
                            return (
                                <Fragment key={p.pairing_id}>
                                <tr onClick={() => togglePairing(p.pairing_id)} className="coach-pairing-row">
                                    <td>{p.p_team_code} — {p.p_team_name}</td><td><strong>{p.p_points}</strong></td>
                                    <td>{p.d_team_code} — {p.d_team_name}</td><td><strong>{p.d_points}</strong></td>
                                    <td className={`coach-diff-cell ${diffClass(diff)}`}>
                                        {diff > 0 ? `+${diff} P` : diff < 0 ? `${diff} D` : 'Tie'}
                                    </td>
                                </tr>
                                {isExpanded && (
                                    <tr>
                                        <td colSpan={5} className="coach-ballot-cell">
                                            {loadingId === p.pairing_id && <span className="coach-ballot-status">Loading ballots…</span>}
                                            {pairingBallots && pairingBallots.length === 0 && <span className="coach-ballot-status coach-ballot-status--empty">No individual ballots available.</span>}
                                            {pairingBallots && pairingBallots.length > 0 && (
                                                <>
                                                <div className="coach-ballot-link-row">
                                                    <Link to={`/coach/${teamId}/pairing/${p.pairing_id}/scoresheet?roundName=${encodeURIComponent(round.name)}${round.round_time ? `&roundTime=${encodeURIComponent(round.round_time)}` : ''}`} className="pc-view-btn">View combined scoresheet</Link>
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
                                    </tr>
                                )}
                                </Fragment>
                            )
                        })}</tbody>
                    </table>
                </div>
            ))}
        </>
    )
}
