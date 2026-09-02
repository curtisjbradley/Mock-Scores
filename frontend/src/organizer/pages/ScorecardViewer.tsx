import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiFetch } from '../../auth/auth'
import type { IScoreSheetFormat, ScorecardPayload } from '@mock-scores/shared'
import ModalBackdrop from '../../shared/components/ModalBackdrop'
import { useAutoFocus } from '../../shared/hooks/useAutoFocus'
import '../styles/organizer.css'
import '../../judges/styles/scoresheet.css'
import '../../judges/styles/modal.css'

/**
 * Organizer read-only view of a submitted scorecard.
 * Fetches both the scoresheet format (public endpoint, for category/student labels)
 * and the submitted ballot (organizer endpoint, JWT-required) and renders them together.
 */
const ScorecardViewer = () => {
    const { id, pairingId, judgeId, assignmentId } = useParams<{ id: string; pairingId: string; judgeId?: string; assignmentId?: string }>()
    const navigate = useNavigate()
    const location = window.location.pathname
    const isCoachView = location.includes('/coach/')
    const ballotAssignmentId = judgeId ?? assignmentId ?? ''

    const [sheet, setSheet] = useState<IScoreSheetFormat | null>(null)
    const [ballot, setBallot] = useState<ScorecardPayload | null | undefined>(undefined)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)

    // Edit mode state
    const [editing, setEditing] = useState(false)
    const [editedScores, setEditedScores] = useState<Record<string, number>>({})
    const [showSaveModal, setShowSaveModal] = useState(false)
    const [editReason, setEditReason] = useState('')
    // Programmatic focus (accessible replacement for the autoFocus attribute).
    const reasonRef = useAutoFocus<HTMLTextAreaElement>(showSaveModal)
    const [saving, setSaving] = useState(false)
    const [editLog, setEditLog] = useState<{ editor_email: string; edited_at: string; reason: string; p_points_before: number; p_points_after: number; d_points_before: number; d_points_after: number }[]>([])
    const [showEditLog, setShowEditLog] = useState(false)

    const startEditing = () => {
        if (!ballot) return
        const map: Record<string, number> = {}
        for (const s of ballot.scores) {
            map[`${s.assignmentKey}:${s.side}`] = s.score
        }
        setEditedScores(map)
        setEditing(true)
    }

    const cancelEditing = () => {
        setEditing(false)
        setEditedScores({})
    }

    const handleSaveEdit = async () => {
        if (!id || !pairingId || !judgeId || !ballot || !editReason.trim()) return
        setSaving(true)
        try {
            const scores = Object.entries(editedScores).map(([key, score]) => {
                const [assignmentKey, side] = key.split(':') as [string, 'P' | 'D']
                const original = ballot.scores.find(s => s.assignmentKey === assignmentKey && s.side === side)
                return { assignmentKey, side, score, studentId: original?.studentId ?? null, categoryId: original?.categoryId ?? '' }
            })
            const res = await apiFetch(`/organizer/tournament/${id}/pairings/${pairingId}/scoresheets/${ballotAssignmentId}`, {
                method: 'PUT',
                body: JSON.stringify({ scores, reason: editReason.trim() }),
            })
            if (!res.ok) throw new Error('Failed to save edits')
            // Refresh data
            const refreshRes = await apiFetch(`/organizer/tournament/${id}/pairings/${pairingId}/scoresheets/${ballotAssignmentId}`)
            if (refreshRes.ok) {
                const data = await refreshRes.json() as { sheet: IScoreSheetFormat | null; ballot: ScorecardPayload | null; editLog: { editor_email: string; edited_at: string; reason: string; p_points_before: number; p_points_after: number; d_points_before: number; d_points_after: number }[] }
                setSheet(data.sheet)
                setBallot(data.ballot)
                setEditLog(data.editLog ?? [])
            }
            setEditing(false)
            setShowSaveModal(false)
            setEditReason('')
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save edits')
        } finally {
            setSaving(false)
        }
    }

    const handleDeleteBallot = async () => {
        if (!id || !pairingId || !ballotAssignmentId) return
        setDeleting(true)
        try {
            const res = await apiFetch(`/organizer/tournament/${id}/pairings/${pairingId}/scoresheets/${ballotAssignmentId}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to delete ballot')
            navigate(-1)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete ballot')
            setDeleting(false)
            setShowDeleteModal(false)
        }
    }

    useEffect(() => {
        if (!id || !pairingId || !ballotAssignmentId) return

        const fetchData = async () => {
            setLoading(true)
            setError(null)
            try {
                const url = isCoachView
                    ? `/coach/tournaments/${id}/pairings/${pairingId}/ballots/${ballotAssignmentId}`
                    : `/organizer/tournament/${id}/pairings/${pairingId}/scoresheets/${ballotAssignmentId}`
                const res = await apiFetch(url)
                if (!res.ok) throw new Error('Failed to load scorecard')
                const data = await res.json() as { sheet: IScoreSheetFormat | null; ballot: ScorecardPayload | null; editLog?: { editor_email: string; edited_at: string; reason: string; p_points_before: number; p_points_after: number; d_points_before: number; d_points_after: number }[] }
                setSheet(data.sheet)
                setBallot(data.ballot)
                setEditLog(data.editLog ?? [])
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Unknown error')
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [id, pairingId, ballotAssignmentId, isCoachView])

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
        <>
        <main className="org-main">
            <div className="org-container">
                <button className="org-back-btn" onClick={() => navigate(-1)}>← Back to tournament</button>

                <div className="coach-section">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h2 style={{ margin: 0 }}>Scorecard{sheet.scorer.firstName ? ` — ${sheet.scorer.firstName} ${sheet.scorer.lastName}` : ''}</h2>
                        {ballot && (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="pc-cancel-btn" onClick={() => {
                                    if (!sheet || !ballot) return
                                    const rows: string[][] = [['Category', 'Field', 'Side', 'Score', 'Student']]
                                    for (const catId of sheet.categoryOrder) {
                                        const cat = sheet.scoringCategories[catId]
                                        const witness = cat.witnessId ? sheet.witnesses[cat.witnessId] : null
                                        const catName = witness ? `${cat.categoryName} — ${witness.characterName}` : cat.categoryName
                                        for (const a of cat.categoryAssignments) {
                                            if (a.side !== 'D') {
                                                const score = scoreMap.get(`${a.assignmentKey}:P`)
                                                const s = a.pStudentId ? sheet.students[a.pStudentId] : null
                                                rows.push([catName, a.assignmentName, 'P', String(score ?? ''), s?.name ?? ''])
                                            }
                                            if (a.side !== 'P') {
                                                const score = scoreMap.get(`${a.assignmentKey}:D`)
                                                const s = a.dStudentId ? sheet.students[a.dStudentId] : null
                                                rows.push([catName, a.assignmentName, 'D', String(score ?? ''), s?.name ?? ''])
                                            }
                                        }
                                    }
                                    const csv = rows.map(r => r.map(c => c.includes(',') || c.includes('"') ? `"${c.replace(/"/g, '""')}"` : c).join(',')).join('\n')
                                    const blob = new Blob([csv], { type: 'text/csv' })
                                    const url = URL.createObjectURL(blob)
                                    const a = document.createElement('a')
                                    a.href = url
                                    a.download = `ballot-${ballotAssignmentId}.csv`
                                    a.click()
                                    URL.revokeObjectURL(url)
                                }}>Export CSV</button>
                            </div>
                        )}
                    </div>

                    {!isCoachView && editLog.length > 0 && (
                        <div style={{ marginBottom: '1rem' }}>
                            <button
                                onClick={() => setShowEditLog(!showEditLog)}
                                aria-expanded={showEditLog}
                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary)', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'underline' }}
                            >
                                Ballot contains {editLog.length} edit{editLog.length !== 1 ? 's' : ''}
                            </button>
                            {showEditLog && (
                                <div style={{ marginTop: '0.75rem', border: '1px solid var(--border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
                                    {editLog.map((entry, i) => (
                                        <div key={i} style={{ padding: '0.75rem 1rem', borderBottom: i < editLog.length - 1 ? '1px solid var(--border)' : 'none', fontSize: '0.85rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                                <strong>{entry.editor_email}</strong>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(entry.edited_at).toLocaleString()}</span>
                                            </div>
                                            <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                                P: {entry.p_points_before} → {entry.p_points_after} | D: {entry.d_points_before} → {entry.d_points_after}
                                            </div>
                                            <div style={{ fontStyle: 'italic' }}>{entry.reason}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {!isCoachView && ballot && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                            {!editing ? (
                                <button className="pc-save-btn" onClick={startEditing}>Edit Scores</button>
                            ) : (
                                <>
                                    <button className="pc-save-btn" onClick={() => setShowSaveModal(true)}>Save Changes</button>
                                    <button className="pc-cancel-btn" onClick={cancelEditing}>Cancel</button>
                                </>
                            )}
                            <button
                                className="org-back-btn"
                                style={{ backgroundColor: '#d32f2f', color: '#fff', borderColor: '#d32f2f' }}
                                onClick={() => setShowDeleteModal(true)}
                                disabled={deleting}
                                aria-label="Delete ballot permanently"
                            >
                                {deleting ? 'Deleting…' : 'Delete Ballot'}
                            </button>
                        </div>
                    )}

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
                                                                        {editing ? (
                                                                            <input
                                                                                type="number"
                                                                                inputMode="numeric"
                                                                                className="score-input"
                                                                                style={{ width: '4rem', textAlign: 'center', fontWeight: 'bold' }}
                                                                                aria-label={`${prosecutionLabel} score for ${a.assignmentName}`}
                                                                                value={editedScores[`${a.assignmentKey}:P`] ?? ''}
                                                                                onChange={e => setEditedScores(prev => ({ ...prev, [`${a.assignmentKey}:P`]: Number(e.target.value) }))}
                                                                            />
                                                                        ) : (
                                                                            <span className="score-input" style={{ display: 'inline-block', minWidth: '2.5rem', textAlign: 'center', fontWeight: 'bold' }}>
                                                                                {pScore ?? '—'}
                                                                            </span>
                                                                        )}
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
                                                                        {editing ? (
                                                                            <input
                                                                                type="number"
                                                                                inputMode="numeric"
                                                                                className="score-input"
                                                                                style={{ width: '4rem', textAlign: 'center', fontWeight: 'bold' }}
                                                                                aria-label={`Defense score for ${a.assignmentName}`}
                                                                                value={editedScores[`${a.assignmentKey}:D`] ?? ''}
                                                                                onChange={e => setEditedScores(prev => ({ ...prev, [`${a.assignmentKey}:D`]: Number(e.target.value) }))}
                                                                            />
                                                                        ) : (
                                                                            <span className="score-input" style={{ display: 'inline-block', minWidth: '2.5rem', textAlign: 'center', fontWeight: 'bold' }}>
                                                                                {dScore ?? '—'}
                                                                            </span>
                                                                        )}
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

        {showDeleteModal && (
            <ModalBackdrop onClose={() => setShowDeleteModal(false)} dismissible={!deleting}>
                <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
                    <h2 id="delete-modal-title" style={{ margin: '0 0 0.75rem', color: '#d32f2f' }}>Delete Ballot</h2>
                    <p style={{ margin: '0 0 0.5rem', lineHeight: 1.6 }}>
                        Are you sure you want to delete this ballot? This action cannot be undone.
                    </p>
                    <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        The scorer will need to resubmit their scores. Any standings or results that include this ballot will be recalculated.
                    </p>
                    <div className="confirm-actions">
                        <button onClick={() => setShowDeleteModal(false)} disabled={deleting}>Cancel</button>
                        <button onClick={handleDeleteBallot} disabled={deleting} style={{ backgroundColor: '#d32f2f' }}>
                            {deleting ? 'Deleting…' : 'Confirm Delete'}
                        </button>
                    </div>
                </div>
            </ModalBackdrop>
        )}

        {showSaveModal && (
            <ModalBackdrop onClose={() => setShowSaveModal(false)} dismissible={!saving}>
                <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="save-modal-title">
                    <h2 id="save-modal-title" style={{ margin: '0 0 0.75rem' }}>Save Ballot Edits</h2>
                    <p style={{ margin: '0 0 1rem', lineHeight: 1.6, fontSize: '0.9rem' }}>
                        Please provide a reason for this edit. This will be logged for audit purposes.
                    </p>
                    <label htmlFor="edit-reason" style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>Reason for edit</label>
                    <textarea
                        id="edit-reason"
                        ref={reasonRef}
                        className="modal-input"
                        style={{ width: '100%', minHeight: '5rem', resize: 'vertical', padding: '0.5rem 0.75rem', fontFamily: 'inherit', fontSize: '0.9rem' }}
                        value={editReason}
                        onChange={e => setEditReason(e.target.value)}
                        placeholder="e.g., Scorer reported incorrect score for witness #2"
                    />
                    <div className="confirm-actions" style={{ marginTop: '1rem' }}>
                        <button onClick={() => { setShowSaveModal(false); setEditReason('') }} disabled={saving}>Cancel</button>
                        <button onClick={handleSaveEdit} disabled={saving || !editReason.trim()}>
                            {saving ? 'Saving…' : 'Confirm Edit'}
                        </button>
                    </div>
                </div>
            </ModalBackdrop>
        )}
        </>
    )
}

export default ScorecardViewer
