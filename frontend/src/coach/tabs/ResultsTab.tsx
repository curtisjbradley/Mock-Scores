import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ICoachResultRound } from '@mock-scores/shared'
import { apiFetch } from '../../auth/auth'

interface BallotDetail {
    p_points: number
    d_points: number
    assignment_id: string
}

export default function ResultsTab({ results, tournamentId }: { results: ICoachResultRound[]; tournamentId: string }) {
    const [expanded, setExpanded] = useState<string | null>(null)
    const [ballots, setBallots] = useState<Record<string, BallotDetail[]>>({})
    const [loadingId, setLoadingId] = useState<string | null>(null)

    const togglePairing = async (pairingId: string) => {
        if (expanded === pairingId) { setExpanded(null); return }
        setExpanded(pairingId)
        if (ballots[pairingId]) return // already loaded
        setLoadingId(pairingId)
        try {
            const res = await apiFetch(`/coach/tournaments/${tournamentId}/pairings/${pairingId}/ballots`)
            if (res.ok) {
                const data: BallotDetail[] = await res.json()
                setBallots(prev => ({ ...prev, [pairingId]: data }))
            }
        } finally {
            setLoadingId(null)
        }
    }

    if (results.length === 0) return <p className="coach-empty">No results published yet.</p>
    return (
        <>
            {results.map(round => (
                <div key={round.round_id} style={{ marginBottom: 16 }}>
                    <h3 style={{ margin: '8px 0 6px' }}>{round.name}</h3>
                    <table className="dash-standings-table">
                        <thead><tr><th>Prosecution</th><th>P Pts</th><th>Defense</th><th>D Pts</th><th></th></tr></thead>
                        <tbody>{round.pairings.map(p => {
                            const isExpanded = expanded === p.pairing_id
                            const pairingBallots = ballots[p.pairing_id]
                            const diff = p.p_points - p.d_points
                            return (
                                <Fragment key={p.pairing_id}>
                                <tr onClick={() => togglePairing(p.pairing_id)} style={{ cursor: 'pointer' }}>
                                    <td>{p.p_team_code} — {p.p_team_name}</td><td><strong>{p.p_points}</strong></td>
                                    <td>{p.d_team_code} — {p.d_team_name}</td><td><strong>{p.d_points}</strong></td>
                                    <td style={{ fontSize: '0.8rem', fontWeight: 700, color: diff > 0 ? '#166534' : diff < 0 ? '#991b1b' : '#4b5563' }}>
                                        {diff > 0 ? `+${diff} P` : diff < 0 ? `${diff} D` : 'Tie'}
                                    </td>
                                </tr>
                                {isExpanded && (
                                    <tr>
                                        <td colSpan={5} style={{ padding: '0.5rem 1rem', background: 'var(--surface-muted)' }}>
                                            {loadingId === p.pairing_id && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading ballots…</span>}
                                            {pairingBallots && pairingBallots.length === 0 && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No individual ballots available.</span>}
                                            {pairingBallots && pairingBallots.length > 0 && (
                                                <>
                                                <div style={{ marginBottom: '0.5rem' }}>
                                                    <Link to={`/coach/${tournamentId}/pairing/${p.pairing_id}/scoresheet?roundName=${encodeURIComponent(round.name)}${round.round_time ? `&roundTime=${encodeURIComponent(round.round_time)}` : ''}`} className="pc-view-btn">View combined scoresheet</Link>
                                                </div>
                                                <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                                                    <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                        <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem' }}>Ballot</th>
                                                        <th style={{ textAlign: 'center', padding: '0.25rem 0.5rem' }}>P</th>
                                                        <th style={{ textAlign: 'center', padding: '0.25rem 0.5rem' }}>D</th>
                                                        <th style={{ textAlign: 'center', padding: '0.25rem 0.5rem' }}>Result</th>
                                                        <th style={{ padding: '0.25rem 0.5rem' }}></th>
                                                    </tr></thead>
                                                    <tbody>{pairingBallots.map((b, i) => {
                                                        const bd = b.p_points - b.d_points
                                                        return (
                                                            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                                                <td style={{ padding: '0.35rem 0.5rem' }}>Ballot {i + 1}</td>
                                                                <td style={{ textAlign: 'center', padding: '0.35rem 0.5rem' }}>{b.p_points}</td>
                                                                <td style={{ textAlign: 'center', padding: '0.35rem 0.5rem' }}>{b.d_points}</td>
                                                                <td style={{ textAlign: 'center', padding: '0.35rem 0.5rem', fontWeight: 700, color: bd > 0 ? '#166534' : bd < 0 ? '#991b1b' : '#4b5563' }}>
                                                                    {bd > 0 ? `+${bd} P Win` : bd < 0 ? `${bd} D Win` : 'Tie'}
                                                                </td>
                                                                <td style={{ padding: '0.35rem 0.5rem' }}>
                                                                    <Link to={`/coach/${tournamentId}/ballot/${p.pairing_id}/${b.assignment_id}`} className="pc-view-btn">View ballot</Link>
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
