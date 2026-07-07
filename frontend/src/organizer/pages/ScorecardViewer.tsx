import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiFetch } from '../../auth/auth'
import type { IScoreSheetFormat, ScorecardPayload } from '@mock-scores/shared'
import '../styles/organizer.css'
import '../../judges/styles/scoresheet.css'

/**
 * Organizer read-only view of a submitted scorecard.
 * Fetches both the scoresheet format (public endpoint, for category/student labels)
 * and the submitted ballot (organizer endpoint, JWT-required) and renders them together.
 */
const ScorecardViewer = () => {
    const { id, pairingId, judgeId } = useParams<{ id: string; pairingId: string; judgeId: string }>()
    const navigate = useNavigate()

    const [sheet, setSheet] = useState<IScoreSheetFormat | null>(null)
    const [ballot, setBallot] = useState<ScorecardPayload | null | undefined>(undefined)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!id || !pairingId || !judgeId) return

        const fetchData = async () => {
            setLoading(true)
            setError(null)
            try {
                // Fetch both in parallel. The scoresheet endpoint is public;
                // the ballot endpoint requires a JWT (handled by apiFetch).
                const [sheetRes, ballotRes] = await Promise.all([
                    fetch(`/api/score/${judgeId}`),
                    apiFetch(`/api/organizer/tournament/${id}/pairings/${pairingId}/scoresheets/${judgeId}`),
                ])
                if (!sheetRes.ok) throw new Error('Failed to load scoresheet format')
                if (!ballotRes.ok) throw new Error('Failed to load ballot')
                const sheetData: IScoreSheetFormat = await sheetRes.json()
                const ballotData: ScorecardPayload | null = await ballotRes.json()
                setSheet(sheetData)
                setBallot(ballotData)
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Unknown error')
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [id, pairingId, judgeId])

    if (loading) {
        return (
            <main className="org-main">
                <div className="org-container">
                    <button className="org-back-btn" onClick={() => navigate(-1)}>← Back</button>
                    <p>Loading scorecard…</p>
                </div>
            </main>
        )
    }

    if (error || !sheet) {
        return (
            <main className="org-main">
                <div className="org-container">
                    <button className="org-back-btn" onClick={() => navigate(-1)}>← Back</button>
                    <p className="coach-empty">{error ?? 'Scoresheet not found.'}</p>
                </div>
            </main>
        )
    }

    const prosecutionLabel = sheet.isCriminal ? 'Prosecution' : 'Plaintiff'
    const student = (sid: string | null) => (sid ? sheet.students[sid] ?? null : null)

    // Build a lookup from assignmentKey → score for each side
    const scoreMap = new Map<string, number>()
    const nominationSet = new Set<string>()
    if (ballot) {
        for (const s of ballot.scores) {
            scoreMap.set(`${s.assignmentKey}:${s.side}`, s.score)
        }
        for (const n of ballot.nominations) {
            nominationSet.add(n.studentId)
        }
    }

    return (
        <main className="org-main">
            <div className="org-container">
                <button className="org-back-btn" onClick={() => navigate(-1)}>← Back to tournament</button>

                <div className="coach-section">
                    <h2>Scorecard — {sheet.scorer.firstName} {sheet.scorer.lastName}</h2>

                    {/* Trial info */}
                    <div className="trial-info-card" style={{ marginBottom: '1rem' }}>
                        <div className="trial-info-meta">
                            <span className="trial-info-courtroom">Courtroom {sheet.courtroomNumber}</span>
                            <span className="trial-info-presider">{sheet.presiderName}</span>
                        </div>
                        <p className="case-name" style={{ margin: 0 }}>{sheet.caseName}</p>
                        <div className="team-labels">
                            <div className="team-label team-label--prosecution">
                                <span className="team-code">{sheet.prosecutionCode}</span>
                                <span className="team-label-role">{prosecutionLabel}</span>
                            </div>
                            <div className="team-label team-label--defense">
                                <span className="team-code team-code--defense">{sheet.defenseCode}</span>
                                <span className="team-label-role">Defense</span>
                            </div>
                        </div>
                    </div>

                    {ballot === null && (
                        <p className="coach-empty" style={{ fontStyle: 'italic' }}>
                            No ballot has been submitted yet.
                        </p>
                    )}

                    {ballot && (
                        <>
                            {/* Scores table */}
                            <div className="score-container">
                                <table id="score-table">
                                    <thead>
                                        <tr className="scoresheet-header">
                                            <th>Scoring Category</th>
                                            <th>{prosecutionLabel}</th>
                                            <th>Defense</th>
                                        </tr>
                                    </thead>
                                    {sheet.categoryOrder.map((catId) => {
                                        const cat = sheet.scoringCategories[catId]
                                        const witness = cat.witnessId ? sheet.witnesses[cat.witnessId] : null
                                        const displayName = witness
                                            ? `${cat.categoryName} — ${witness.characterName}`
                                            : cat.categoryName
                                        return (
                                            <tbody key={catId}>
                                                <tr className="category-name">
                                                    <th colSpan={3}>{displayName}</th>
                                                </tr>
                                                {cat.categoryAssignments.map((a) => {
                                                    const pScore = scoreMap.get(`${a.assignmentKey}:P`)
                                                    const dScore = scoreMap.get(`${a.assignmentKey}:D`)
                                                    const pStudent = student(a.pStudentId)
                                                    const dStudent = student(a.dStudentId)
                                                    const pNominated = a.pStudentId ? nominationSet.has(a.pStudentId) : false
                                                    const dNominated = a.dStudentId ? nominationSet.has(a.dStudentId) : false
                                                    return (
                                                        <tr key={`${a.assignmentKey}-${a.side}`} className="score-row">
                                                            <td>{a.assignmentName}</td>
                                                            <td>
                                                                {a.side !== 'D' && (
                                                                    <div className="score-box">
                                                                        <span className="score-input" style={{ display: 'inline-block', minWidth: '2.5rem', textAlign: 'center', fontWeight: 'bold' }}>
                                                                            {pScore ?? '—'}
                                                                        </span>
                                                                        {pStudent && (
                                                                            <p className="student-name">
                                                                                {pStudent.name}
                                                                                {pStudent.pronouns && <span className="student-pronouns"> ({pStudent.pronouns})</span>}
                                                                                {pNominated && <span style={{ marginLeft: 4, fontSize: '0.75rem', color: 'var(--color-accent, #e07b00)' }}>★ Nominated</span>}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td>
                                                                {a.side !== 'P' && (
                                                                    <div className="score-box">
                                                                        <span className="score-input" style={{ display: 'inline-block', minWidth: '2.5rem', textAlign: 'center', fontWeight: 'bold' }}>
                                                                            {dScore ?? '—'}
                                                                        </span>
                                                                        {dStudent && (
                                                                            <p className="student-name">
                                                                                {dStudent.name}
                                                                                {dStudent.pronouns && <span className="student-pronouns"> ({dStudent.pronouns})</span>}
                                                                                {dNominated && <span style={{ marginLeft: 4, fontSize: '0.75rem', color: 'var(--color-accent, #e07b00)' }}>★ Nominated</span>}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        )
                                    })}
                                </table>
                            </div>

                            {/* Nominations with ranks */}
                            {ballot.nominations.length > 0 && (
                                <div style={{ marginTop: '1.5rem' }}>
                                    <h3>Nominations</h3>
                                    <ul style={{ paddingLeft: '1.25rem' }}>
                                        {ballot.nominations.map((n) => {
                                            const s = sheet.students[n.studentId]
                                            return (
                                                <li key={n.studentId}>
                                                    {s ? s.name : n.studentId} — Rank {n.rank}
                                                </li>
                                            )
                                        })}
                                    </ul>
                                </div>
                            )}

                            {/* Tiebreaker */}
                            {ballot.tiebreaker && (
                                <div style={{ marginTop: '1rem' }}>
                                    <h3>Tiebreaker Selection</h3>
                                    <p>
                                        <strong>{ballot.tiebreaker}</strong>
                                        {' — '}
                                        {ballot.tiebreaker === sheet.prosecutionCode ? prosecutionLabel : 'Defense'}
                                    </p>
                                </div>
                            )}

                            {/* Totals */}
                            <div style={{ marginTop: '1rem', display: 'flex', gap: '2rem' }}>
                                <div>
                                    <strong>{sheet.prosecutionCode} ({prosecutionLabel}) Total:</strong>{' '}
                                    {ballot.scores.filter(s => s.side === 'P').reduce((sum, s) => sum + s.score, 0)}
                                </div>
                                <div>
                                    <strong>{sheet.defenseCode} (Defense) Total:</strong>{' '}
                                    {ballot.scores.filter(s => s.side === 'D').reduce((sum, s) => sum + s.score, 0)}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </main>
    )
}

export default ScorecardViewer
