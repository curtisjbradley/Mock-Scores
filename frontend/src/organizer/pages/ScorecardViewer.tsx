import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiFetch } from '../../auth/auth'
import type { IScoreSheetFormat, ScorecardPayload } from '@mock-scores/shared'
import ModalBackdrop from '../../shared/components/ModalBackdrop'
import { useAutoFocus } from '../../shared/hooks/useAutoFocus'
import { resolveCoachTournament } from '../../coach/coachApi'
import '../styles/organizer.css'
import '../../judges/styles/scoresheet.css'
import '../../judges/styles/modal.css'
import AddButton from "../../shared/components/AddButton.tsx";
import DangerButton from "../../shared/components/DangerButton.tsx";

type EditLogEntry = {
    editor_email: string
    edited_at: string
    reason: string
    p_points_before: number
    p_points_after: number
    d_points_before: number
    d_points_after: number
}

type SubmittedBallotRecord = {
    scorer_assignment_id: string
    ballot_json: ScorecardPayload
    tiebreaker?: string | null
    presider_ballot: boolean
    p_points: number
    d_points: number
}

type DirectBallotPayload = ScorecardPayload & { tiebreaker?: string | null }

type ScorecardResponse = {
    sheet: IScoreSheetFormat | null
    ballot: SubmittedBallotRecord | DirectBallotPayload | null
    editLog?: EditLogEntry[]
}


type BallotScore = ScorecardPayload['scores'][number]

type MappedScore = {
    score: number
    original: BallotScore
}

type SheetCell = {
    assignmentKey: string
    side: 'P' | 'D'
    categoryId: string
    witnessKey: string
}

function witnessOf(assignmentKey: string): string {
    const parts = assignmentKey.split('__')
    return parts.length >= 3 ? parts[parts.length - 1] : ''
}

/**
 * Maps the submitted ballot's score keys onto the current sheet's cells.
 * Direct assignment-key matches are preferred. Older ballots can have keys that
 * no longer match the live sheet, so unmatched cells fall back by category/side,
 * then witness-group/side, while preserving the original ballot score metadata.
 */
function mapScoresToSheet(sheet: IScoreSheetFormat, ballot: ScorecardPayload): Map<string, MappedScore> {
    const cells: SheetCell[] = []
    for (const catId of sheet.categoryOrder) {
        const cat = sheet.scoringCategories[catId]
        if (!cat) continue
        for (const a of cat.categoryAssignments) {
            const witnessKey = cat.witnessId ?? witnessOf(a.assignmentKey)
            if (a.side !== 'D') cells.push({ assignmentKey: a.assignmentKey, side: 'P', categoryId: catId, witnessKey })
            if (a.side !== 'P') cells.push({ assignmentKey: a.assignmentKey, side: 'D', categoryId: catId, witnessKey })
        }
    }

    const cellKeys = new Set(cells.map(c => `${c.assignmentKey}:${c.side}`))
    const mapped = new Map<string, MappedScore>()
    const usedScores = new Set<number>()

    // 1) Exact assignment-key match.
    ballot.scores.forEach((score, index) => {
        const key = `${score.assignmentKey}:${score.side}`
        if (cellKeys.has(key)) {
            mapped.set(key, { score: score.score, original: score })
            usedScores.add(index)
        }
    })

    const fillByBucket = (
        cellBucket: (cell: SheetCell) => string,
        scoreBucket: (score: BallotScore) => string,
    ) => {
        const cellQueues = new Map<string, SheetCell[]>()
        for (const cell of cells) {
            const displayKey = `${cell.assignmentKey}:${cell.side}`
            if (mapped.has(displayKey)) continue
            const bucket = cellBucket(cell)
            const queue = cellQueues.get(bucket) ?? []
            queue.push(cell)
            cellQueues.set(bucket, queue)
        }

        const scoreQueues = new Map<string, { score: BallotScore; index: number }[]>()
        ballot.scores.forEach((score, index) => {
            if (usedScores.has(index)) return
            const bucket = scoreBucket(score)
            const queue = scoreQueues.get(bucket) ?? []
            queue.push({ score, index })
            scoreQueues.set(bucket, queue)
        })

        for (const [bucket, bucketCells] of cellQueues) {
            const bucketScores = scoreQueues.get(bucket) ?? []
            const count = Math.min(bucketCells.length, bucketScores.length)
            for (let i = 0; i < count; i++) {
                const cell = bucketCells[i]
                const candidate = bucketScores[i]
                mapped.set(`${cell.assignmentKey}:${cell.side}`, {
                    score: candidate.score.score,
                    original: candidate.score,
                })
                usedScores.add(candidate.index)
            }
        }
    }

    // 2) Stable category id + side. This handles regenerated assignment keys when
    // the category itself is still the same.
    fillByBucket(
        cell => `${cell.categoryId}:${cell.side}`,
        score => `${score.categoryId ?? ''}:${score.side}`,
    )

    // 3) Stable witness UUID + side. This handles regenerated assignment ids while
    // the witness/category UUID is still the same.
    fillByBucket(
        cell => `${cell.witnessKey}:${cell.side}`,
        score => `${witnessOf(score.assignmentKey)}:${score.side}`,
    )

    // 4) Historical witness fallback. Some old ballots were saved without a layout
    // snapshot, and the live scoring template can later regenerate *all* witness,
    // category, and assignment UUIDs. In that case there is literally no shared id
    // to join on. Match witness groups structurally instead:
    //
    //   - preserve current sheet witness order
    //   - preserve submitted ballot witness-group encounter order
    //   - pair groups with the same side signature (for example P,D,P or D,P,D)
    //   - inside a paired group, match by side and ordinal position
    //
    // This also tolerates a witness being added/removed: unmatched historical groups
    // are skipped rather than shifting every later witness score.
    type IndexedBallotScore = { score: BallotScore; index: number }
    type SheetWitnessGroup = { id: string; cells: SheetCell[]; signature: string }
    type BallotWitnessGroup = { id: string; scores: IndexedBallotScore[]; signature: string }

    const sheetWitnessGroups: SheetWitnessGroup[] = []
    for (const catId of sheet.categoryOrder) {
        const cat = sheet.scoringCategories[catId]
        if (!cat?.witnessId) continue

        const groupCells = cells.filter(cell =>
            cell.categoryId === catId && !mapped.has(`${cell.assignmentKey}:${cell.side}`)
        )
        if (groupCells.length === 0) continue

        sheetWitnessGroups.push({
            id: catId,
            cells: groupCells,
            signature: groupCells.map(cell => cell.side).join(','),
        })
    }

    const ballotWitnessGroupsById = new Map<string, IndexedBallotScore[]>()
    const ballotWitnessOrder: string[] = []
    ballot.scores.forEach((score, index) => {
        if (usedScores.has(index)) return

        // Witness assignments have a trailing witness segment in the assignment key.
        // categoryId is preferable for grouping because every score for the same
        // historical witness category shares it.
        const parts = score.assignmentKey.split('__')
        if (parts.length < 3) return
        const groupId = score.categoryId ?? parts[0]
        if (!ballotWitnessGroupsById.has(groupId)) {
            ballotWitnessGroupsById.set(groupId, [])
            ballotWitnessOrder.push(groupId)
        }
        ballotWitnessGroupsById.get(groupId)!.push({ score, index })
    })

    const ballotWitnessGroups: BallotWitnessGroup[] = ballotWitnessOrder.map(id => {
        const scores = ballotWitnessGroupsById.get(id) ?? []
        return {
            id,
            scores,
            signature: scores.map(entry => entry.score.side).join(','),
        }
    })

    const consumedBallotGroups = new Set<string>()
    for (const sheetGroup of sheetWitnessGroups) {
        const ballotGroup = ballotWitnessGroups.find(group =>
            !consumedBallotGroups.has(group.id) && group.signature === sheetGroup.signature
        )
        if (!ballotGroup) continue
        consumedBallotGroups.add(ballotGroup.id)

        const scoresBySide = new Map<'P' | 'D', IndexedBallotScore[]>([
            ['P', []],
            ['D', []],
        ])
        for (const entry of ballotGroup.scores) scoresBySide.get(entry.score.side)!.push(entry)

        const sideOffsets: Record<'P' | 'D', number> = { P: 0, D: 0 }
        for (const cell of sheetGroup.cells) {
            const candidates = scoresBySide.get(cell.side) ?? []
            const candidate = candidates[sideOffsets[cell.side]++]
            if (!candidate || usedScores.has(candidate.index)) continue

            mapped.set(`${cell.assignmentKey}:${cell.side}`, {
                score: candidate.score.score,
                original: candidate.score,
            })
            usedScores.add(candidate.index)
        }
    }

    return mapped
}

function unpackBallot(record: ScorecardResponse['ballot']): { payload: ScorecardPayload | null; tiebreaker: string | null } {
    if (!record) return { payload: null, tiebreaker: null }
    if ('ballot_json' in record) {
        const payload = record.ballot_json
        const payloadTiebreaker = (payload as DirectBallotPayload).tiebreaker ?? null
        return { payload, tiebreaker: record.tiebreaker ?? payloadTiebreaker }
    }
    return { payload: record, tiebreaker: record.tiebreaker ?? null }
}

/**
 * Organizer read-only view of a submitted scorecard.
 * Fetches both the scoresheet format (public endpoint, for category/student labels)
 * and the submitted ballot (organizer endpoint, JWT-required) and renders them together.
 */
const ScorecardViewer = () => {
    const { id, teamId, pairingId, ballotId } = useParams<{ id?: string; teamId?: string; pairingId?: string; ballotId?: string }>()
    const navigate = useNavigate()
    const location = window.location.pathname
    const isCoachView = location.includes('/coach/')

    const [sheet, setSheet] = useState<IScoreSheetFormat | null>(null)
    const [ballot, setBallot] = useState<ScorecardPayload | null | undefined>(undefined)
    const [ballotTiebreaker, setBallotTiebreaker] = useState<string | null>(null)
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
    const [editLog, setEditLog] = useState<EditLogEntry[]>([])
    const [showEditLog, setShowEditLog] = useState(false)

    const startEditing = () => {
        if (!ballot || !sheet) return
        const mappedScores = mapScoresToSheet(sheet, ballot)
        const map: Record<string, number> = {}
        for (const [displayKey, entry] of mappedScores) {
            map[displayKey] = entry.score
        }
        setEditedScores(map)
        setEditing(true)
    }

    const cancelEditing = () => {
        setEditing(false)
        setEditedScores({})
    }

    const handleSaveEdit = async () => {
        if (!id || !pairingId || !ballotId || !ballot || !editReason.trim()) return
        setSaving(true)
        try {
            if (!sheet) throw new Error('Scoresheet format is unavailable')
            const mappedScores = mapScoresToSheet(sheet, ballot)
            const displayKeyByOriginal = new Map<BallotScore, string>()
            for (const [displayKey, entry] of mappedScores) {
                displayKeyByOriginal.set(entry.original, displayKey)
            }

            // Preserve the ballot's original assignment/category/student ids when saving.
            // Only the numeric score changes; this avoids rewriting a historical ballot
            // with the live sheet's regenerated assignment keys.
            const scores = ballot.scores.map(original => {
                const displayKey = displayKeyByOriginal.get(original)
                const score = displayKey != null && editedScores[displayKey] != null
                    ? editedScores[displayKey]
                    : original.score
                return {
                    assignmentKey: original.assignmentKey,
                    side: original.side,
                    score,
                    studentId: original.studentId ?? null,
                    categoryId: original.categoryId ?? '',
                }
            })
            const res = await apiFetch(`/organizer/tournament/${id}/pairings/${pairingId}/scoresheets/${ballotId}`, {
                method: 'PUT',
                body: JSON.stringify({ scores, reason: editReason.trim() }),
            })
            if (!res.ok) throw new Error('Failed to save edits')
            // Refresh data
            const refreshRes = await apiFetch(`/organizer/tournament/${id}/pairings/${pairingId}/scoresheets/${ballotId}`)
            if (refreshRes.ok) {
                const data = await refreshRes.json() as ScorecardResponse
                const normalized = unpackBallot(data.ballot)
                setSheet(data.sheet)
                setBallot(normalized.payload)
                setBallotTiebreaker(normalized.tiebreaker)
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
        if (!id || !pairingId || !ballotId) return
        setDeleting(true)
        try {
            const res = await apiFetch(`/organizer/tournament/${id}/pairings/${pairingId}/scoresheets/${ballotId}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to delete ballot')
            navigate(-1)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete ballot')
            setDeleting(false)
            setShowDeleteModal(false)
        }
    }

    const scopeId = isCoachView ? teamId : id
    const routeError =
        !scopeId || !pairingId || !ballotId
            ? 'Missing scorecard route parameters.'
            : null

    useEffect(() => {
        if (routeError || !scopeId || !pairingId || !ballotId) return

        let cancelled = false

        const fetchData = async () => {
            // Prevent synchronous setState from the effect body.
            await Promise.resolve()

            if (cancelled) return

            setLoading(true)
            setError(null)

            try {
                let url: string

                if (isCoachView) {
                    const info = await resolveCoachTournament(
                        scopeId,
                        false,
                        undefined,
                    )

                    if (!info?.teamId) {
                        throw new Error('Failed to resolve tournament')
                    }

                    url =
                        `/coach/tournaments/${info.teamId}` +
                        `/pairings/${pairingId}` +
                        `/ballots/${ballotId}`
                } else {
                    url =
                        `/organizer/tournament/${scopeId}` +
                        `/pairings/${pairingId}` +
                        `/scoresheets/${ballotId}`
                }

                const res = await apiFetch(url)

                if (!res.ok) {
                    throw new Error('Failed to load scorecard')
                }

                const data = await res.json() as ScorecardResponse
                const normalized = unpackBallot(data.ballot)

                if (cancelled) return

                setSheet(data.sheet)
                setBallot(normalized.payload)
                setBallotTiebreaker(normalized.tiebreaker)
                setEditLog(data.editLog ?? [])
            } catch (e) {
                if (!cancelled) {
                    setError(
                        e instanceof Error
                            ? e.message
                            : 'Unknown error',
                    )
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        void fetchData()

        return () => {
            cancelled = true
        }
    }, [
        scopeId,
        pairingId,
        ballotId,
        isCoachView,
        routeError,
    ])

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

    // Map submitted scores onto the current sheet cells. Exact assignment keys are
    // used when possible; historical ballots fall back to stable positional buckets.
    const mappedScores = ballot ? mapScoresToSheet(sheet, ballot) : new Map<string, MappedScore>()
    const scoreMap = new Map<string, number>()
    for (const [key, entry] of mappedScores) scoreMap.set(key, entry.score)

    // Per-field multiplier lookup keyed by assignmentKey, taken from the sheet
    // format. Missing/undefined multipliers default to 1. Used so the displayed
    // side totals match the multiplier-weighted p_points/d_points the server stores.
    const multiplierMap = new Map<string, number>()
    for (const catId of sheet.categoryOrder) {
        const cat = sheet.scoringCategories[catId]
        for (const a of cat.categoryAssignments) {
            const m = Number(a.multiplier ?? 1)
            multiplierMap.set(a.assignmentKey, Number.isNaN(m) ? 1 : m)
        }
    }
    const sideTotal = (side: 'P' | 'D') => {
        let total = 0
        for (const catId of sheet.categoryOrder) {
            const cat = sheet.scoringCategories[catId]
            if (!cat) continue
            for (const a of cat.categoryAssignments) {
                if ((side === 'P' && a.side === 'D') || (side === 'D' && a.side === 'P')) continue
                const score = scoreMap.get(`${a.assignmentKey}:${side}`)
                if (score != null) total += score * (multiplierMap.get(a.assignmentKey) ?? 1)
            }
        }
        return total
    }

    return (
        <>
            <main className="org-main">
                <div className="org-container">
                    <button className="org-back-btn" onClick={() => navigate(-1)}>← Back to tournament</button>

                    <div className="coach-section">
                        <div className="sv-header">
                            <h2>Scorecard{sheet.scorer.firstName ? ` - ${sheet.scorer.firstName} ${sheet.scorer.lastName}` : ''}</h2>
                            {ballot && (
                                <div className="sv-header-actions">
                                    <AddButton onClick={() => {
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
                                        a.download = `ballot-${ballotId}.csv`
                                        a.click()
                                        URL.revokeObjectURL(url)
                                    }}>Export CSV</AddButton>
                                    {!isCoachView && (
                                        !editing ? (
                                            <AddButton onClick={startEditing}>Edit Scores</AddButton>
                                        ) : (
                                            <>
                                                <button className="pc-save-btn" onClick={() => setShowSaveModal(true)}>Save Changes</button>
                                                <button className="pc-cancel-btn" onClick={cancelEditing}>Cancel</button>
                                            </>
                                        )
                                    )}
                                </div>
                            )}
                        </div>

                        {!isCoachView && editLog.length > 0 && (
                            <div className="sv-editlog-section">
                                <button
                                    onClick={() => setShowEditLog(!showEditLog)}
                                    aria-expanded={showEditLog}
                                    className="sv-editlog-toggle"
                                >
                                    Ballot contains {editLog.length} edit{editLog.length !== 1 ? 's' : ''}
                                </button>
                                {showEditLog && (
                                    <div className="sv-editlog-list">
                                        {editLog.map((entry, i) => (
                                            <div key={i} className="sv-editlog-entry">
                                                <div className="sv-editlog-entry-head">
                                                    <strong>{entry.editor_email}</strong>
                                                    <span className="sv-editlog-time">{new Date(entry.edited_at).toLocaleString()}</span>
                                                </div>
                                                <div className="sv-editlog-diff">
                                                    P: {entry.p_points_before} → {entry.p_points_after} | D: {entry.d_points_before} → {entry.d_points_after}
                                                </div>
                                                <div className="sv-editlog-reason">{entry.reason}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {!isCoachView && ballot && (
                            <div className="sv-edit-actions">

                                <DangerButton
                                    onClick={() => setShowDeleteModal(true)}
                                    disabled={deleting}
                                    aria-label="Delete ballot permanently"
                                >
                                    {deleting ? 'Deleting…' : 'Delete Ballot'}
                                </DangerButton>
                            </div>
                        )}

                        {/* Trial info */}
                        <div className="trial-info-card sv-trial-info">
                            <div className="trial-info-meta">
                                <span className="trial-info-courtroom">Courtroom {sheet.courtroomNumber}</span>
                                <span className="trial-info-presider">{sheet.presiderName}</span>
                            </div>
                            <p className="case-name sv-case-name">{sheet.caseName}</p>
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
                            <p className="coach-empty sv-empty-italic">
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
                                                ? `${cat.categoryName} - ${witness.characterName}`
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
                                                                                className="score-input sv-score-input-edit"
                                                                                aria-label={`${prosecutionLabel} score for ${a.assignmentName}`}
                                                                                value={editedScores[`${a.assignmentKey}:P`] ?? ''}
                                                                                onChange={e => setEditedScores(prev => ({ ...prev, [`${a.assignmentKey}:P`]: Number(e.target.value) }))}
                                                                            />
                                                                        ) : (
                                                                            <span className="score-input sv-score-input-view">
                                                                                {pScore ?? '—'}
                                                                            </span>
                                                                        )}
                                                                        {pStudent && (
                                                                            <p className="student-name">
                                                                                {pStudent.name}
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
                                                                                className="score-input sv-score-input-edit"
                                                                                aria-label={`Defense score for ${a.assignmentName}`}
                                                                                value={editedScores[`${a.assignmentKey}:D`] ?? ''}
                                                                                onChange={e => setEditedScores(prev => ({ ...prev, [`${a.assignmentKey}:D`]: Number(e.target.value) }))}
                                                                            />
                                                                        ) : (
                                                                            <span className="score-input sv-score-input-view">
                                                                                {dScore ?? '—'}
                                                                            </span>
                                                                        )}
                                                                        {dStudent && (
                                                                            <p className="student-name">
                                                                                {dStudent.name}
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

                                {/* Nominations with ranks, grouped by award category */}
                                {ballot.nominations.length > 0 && (
                                    <div className="sv-section">
                                        <h3>Nominations</h3>
                                        <div className={"sv-nominations-grid"}>
                                            {(() => {
                                                // Group nominations by their award category, preserving encounter order.
                                                const groups = new Map<string, typeof ballot.nominations>()
                                                for (const n of ballot.nominations) {
                                                    const key = n.awardCategoryId ?? ''
                                                    if (!groups.has(key)) groups.set(key, [])
                                                    groups.get(key)!.push(n)
                                                }
                                                return [...groups.entries()].map(([awardCategoryId, noms]) => {
                                                    const award = sheet.awardCategories[awardCategoryId]
                                                    const awardName = award ? award.name : (awardCategoryId || 'Uncategorized')
                                                    const sorted = [...noms].sort((a, b) => a.rank - b.rank)
                                                    return (
                                                        <div key={awardCategoryId} className="sv-nomination-group">
                                                            <h4 className="sv-nomination-award">{awardName}</h4>
                                                            <ul className="sv-nominations-list">
                                                                {sorted.map((n) => {
                                                                    const s = sheet.students[n.studentId]
                                                                    return (
                                                                        <li key={`${awardCategoryId}:${n.studentId}`}>

                                                                            {s ? s.name : n.studentId} - Rank {n.rank}
                                                                            {s && (
                                                                                <span className={"sv-nomination-side"}>
                                                                            {s.schoolId === sheet.prosecutionId ? prosecutionLabel : 'Defense'}
                                                                        </span>
                                                                            )}
                                                                        </li>
                                                                    )
                                                                })}
                                                            </ul>
                                                        </div>
                                                    )
                                                })
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* Tiebreaker */}
                                {ballotTiebreaker && (
                                    <div className="sv-section--sm">
                                        <h3>Tiebreaker Selection</h3>
                                        <p>
                                            <strong>{ballotTiebreaker === sheet.prosecutionId ? sheet.prosecutionCode : sheet.defenseCode}</strong>
                                            {' - '}
                                            {ballotTiebreaker === sheet.prosecutionId ? prosecutionLabel : 'Defense'}
                                        </p>
                                    </div>
                                )}

                                {/* Totals */}
                                <div className="sv-totals">
                                    <div>
                                        <strong>{sheet.prosecutionCode} ({prosecutionLabel}) Total:</strong>{' '}
                                        {sideTotal('P')}
                                    </div>
                                    <div>
                                        <strong>{sheet.defenseCode} (Defense) Total:</strong>{' '}
                                        {sideTotal('D')}
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
                        <h2 id="delete-modal-title" className="sv-modal-title--danger">Delete Ballot</h2>
                        <p className="sv-modal-text">
                            Are you sure you want to delete this ballot? This action cannot be undone.
                        </p>
                        <p className="sv-modal-text--muted">
                            The scorer will need to resubmit their scores. Any standings or results that include this ballot will be recalculated.
                        </p>
                        <div className="confirm-actions">
                            <button onClick={() => setShowDeleteModal(false)} disabled={deleting}>Cancel</button>
                            <button onClick={handleDeleteBallot} disabled={deleting} className="sv-modal-confirm-danger">
                                {deleting ? 'Deleting…' : 'Confirm Delete'}
                            </button>
                        </div>
                    </div>
                </ModalBackdrop>
            )}

            {showSaveModal && (
                <ModalBackdrop onClose={() => setShowSaveModal(false)} dismissible={!saving}>
                    <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="save-modal-title">
                        <h2 id="save-modal-title" className="sv-modal-title">Save Ballot Edits</h2>
                        <p className="sv-modal-text--intro">
                            Please provide a reason for this edit. This will be logged for audit purposes.
                        </p>
                        <label htmlFor="edit-reason" className="sv-reason-label">Reason for edit</label>
                        <textarea
                            id="edit-reason"
                            ref={reasonRef}
                            className="modal-input sv-reason-textarea"
                            value={editReason}
                            onChange={e => setEditReason(e.target.value)}
                            placeholder="e.g., Scorer reported incorrect score for witness #2"
                        />
                        <div className="confirm-actions sv-modal-actions-spaced">
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

