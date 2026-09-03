import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../../auth/auth'
import type { IScoreSheetFormat, ScorecardPayload, IPairingScorer, BallotLayoutSegment } from '@mock-scores/shared'
import CombinedScoresheet, { type CombinedBallot, type SegmentRow } from './CombinedScoresheet'
import { downloadCombinedXlsx } from './combinedScoresheetXls'
import './combined-scoresheet.css'

type BallotDetail = { sheet: IScoreSheetFormat | null; ballot: ScorecardPayload | null }

/** Formats an ISO date-time string as a localized date + time, or '' when absent/invalid. */
function formatRoundTime(iso: string | null): string | null {
    if (!iso) return null
    const d = new Date(iso)
    if (isNaN(d.getTime())) return null
    return d.toLocaleString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
    })
}interface LoadedData {
    rows: SegmentRow[]
    ballots: CombinedBallot[]
    prosLabel: string
    prosecutionCode: string
    defenseCode: string
    /** Presider tiebreaker (a team code) from whichever ballot recorded one. */
    tiebreaker: string | null
}

/** Builds canonical segment rows from a ballot's stored layout snapshot. */
function rowsFromLayout(layout: BallotLayoutSegment[]): SegmentRow[] {
    return layout.map(seg => ({
        key: seg.assignmentKey,
        label: seg.witnessName ? `${seg.assignmentName} — ${seg.witnessName}` : seg.assignmentName,
        hasP: seg.side !== 'D',
        hasD: seg.side !== 'P',
        student: seg.pStudentName ?? seg.dStudentName,
    }))
}

/** Builds canonical segment rows from the live sheet format (legacy fallback). */
function rowsFromSheet(sheet: IScoreSheetFormat): SegmentRow[] {
    const rows: SegmentRow[] = []
    for (const catId of sheet.categoryOrder) {
        const cat = sheet.scoringCategories[catId]
        if (!cat) continue
        const witnessName = cat.witnessId ? sheet.witnesses[cat.witnessId]?.characterName ?? null : null
        for (const a of cat.categoryAssignments) {
            const pName = a.pStudentId ? sheet.students[a.pStudentId]?.name ?? null : null
            const dName = a.dStudentId ? sheet.students[a.dStudentId]?.name ?? null : null
            rows.push({
                key: a.assignmentKey,
                label: witnessName ? `${a.assignmentName} — ${witnessName}` : a.assignmentName,
                hasP: a.side !== 'D',
                hasD: a.side !== 'P',
                student: pName ?? dName,
            })
        }
    }
    return rows
}

/** The ordered (side) cells implied by a row set, partitioned for positional matching. */
function cellsOf(rows: SegmentRow[]): { key: string; side: 'P' | 'D'; witness: string | null }[] {
    const cells: { key: string; side: 'P' | 'D'; witness: string | null }[] = []
    for (const r of rows) {
        const witness = witnessOf(r.key)
        if (r.hasP) cells.push({ key: r.key, side: 'P', witness })
        if (r.hasD) cells.push({ key: r.key, side: 'D', witness })
    }
    return cells
}

/** Trailing UUID-looking suffix of an assignment key (its witness group), or null. */
function witnessOf(assignmentKey: string): string | null {
    const parts = assignmentKey.split('__')
    return parts.length >= 3 ? parts[parts.length - 1] : null
}

/**
 * Maps one ballot's scores onto the canonical row keys, producing a
 * `${rowKey}:${side}` → score map.
 *
 * Preferred path: the ballot's own `assignmentKey`s already equal the canonical
 * keys (they were captured together in the ballot's layout snapshot), so scores
 * map directly. Fallback: for ballots submitted before layout capture — whose
 * keys may differ from the canonical rows — we align by ordinal position within
 * each (witness group, side) partition, which both sequences share.
 */
function mapBallot(rows: SegmentRow[], ballot: ScorecardPayload): Map<string, number> {
    const rowKeys = new Set<string>()
    for (const r of rows) {
        if (r.hasP) rowKeys.add(`${r.key}:P`)
        if (r.hasD) rowKeys.add(`${r.key}:D`)
    }

    // Direct mapping: keep only scores whose key matches a canonical row.
    const direct = new Map<string, number>()
    let directHits = 0
    for (const s of ballot.scores) {
        const key = `${s.assignmentKey}:${s.side}`
        if (rowKeys.has(key)) { direct.set(key, s.score); directHits++ }
    }
    // If most scores landed directly, trust the direct mapping.
    if (ballot.scores.length > 0 && directHits >= ballot.scores.length * 0.9) return direct

    // Positional fallback, partitioned by (witness, side).
    const cellQueues = new Map<string, string[]>()
    for (const c of cellsOf(rows)) {
        const bucket = `${c.witness ?? ''}:${c.side}`
        const q = cellQueues.get(bucket) ?? []
        q.push(c.key)
        cellQueues.set(bucket, q)
    }
    const scoreQueues = new Map<string, number[]>()
    for (const s of ballot.scores) {
        const bucket = `${witnessOf(s.assignmentKey) ?? ''}:${s.side}`
        const q = scoreQueues.get(bucket) ?? []
        q.push(s.score)
        scoreQueues.set(bucket, q)
    }
    const map = new Map<string, number>()
    for (const [bucket, keys] of cellQueues) {
        const scores = scoreQueues.get(bucket) ?? []
        const side = bucket.split(':')[1]
        for (let i = 0; i < keys.length && i < scores.length; i++) {
            map.set(`${keys[i]}:${side}`, scores[i])
        }
    }
    return map
}

/**
 * Fetches every submitted ballot for a pairing and renders the combined
 * scoresheet (see {@link CombinedScoresheet}). Works for both roles:
 *
 * - Coach route `/coach/:id/pairing/:pairingId/scoresheet` — uses the coach
 *   ballots endpoints. Scorer identities are redacted server-side, so columns
 *   are labelled "Scorer 1..N".
 * - Organizer route `/organizer/:id/round/:round/pairing/:pairingId/scoresheet`
 *   — uses the round scorers list + per-assignment scoresheet endpoint, so
 *   columns are labelled with the real scorer names.
 */
export default function CombinedScoresheetPage() {
    const { id, round, pairingId } = useParams<{ id: string; round?: string; pairingId: string }>()
    const navigate = useNavigate()
    const [params] = useSearchParams()
    const isCoachView = window.location.pathname.includes('/coach/')

    const roundLabel = params.get('roundName') || null
    const dateLabel = formatRoundTime(params.get('roundTime'))

    const [data, setData] = useState<LoadedData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!id || !pairingId) return
        let cancelled = false

        const loadCoach = async (): Promise<LoadedData | null> => {
            const listRes = await apiFetch(`/coach/tournaments/${id}/pairings/${pairingId}/ballots`)
            if (!listRes.ok) throw new Error('Failed to load ballots')
            const list = await listRes.json() as { assignment_id: string }[]
            const details = await Promise.all(list.map(b =>
                apiFetch(`/coach/tournaments/${id}/pairings/${pairingId}/ballots/${b.assignment_id}`)
                    .then(r => r.ok ? r.json() as Promise<BallotDetail> : null)
            ))
            return buildData(details, (_d, i) => `Scorer ${i + 1}`)
        }

        const loadOrganizer = async (): Promise<LoadedData | null> => {
            if (!round) throw new Error('Missing round')
            const scorersRes = await apiFetch(`/organizer/tournament/${id}/rounds/${round}/pairings/${pairingId}/scorers`)
            if (!scorersRes.ok) throw new Error('Failed to load scorers')
            const scorers = await scorersRes.json() as IPairingScorer[]
            // Only scorers who have actually submitted a ballot contribute columns.
            const submitted = scorers.filter(s => s.p_points != null || s.d_points != null)
            const details = await Promise.all(submitted.map(s =>
                apiFetch(`/organizer/tournament/${id}/pairings/${pairingId}/scoresheets/${s.assignment_id}`)
                    .then(r => r.ok ? r.json() as Promise<BallotDetail> : null)
            ))
            return buildData(details, (_d, i) => submitted[i]?.name || `Scorer ${i + 1}`)
        }

        const run = async () => {
            // Defer the loading/error reset off the synchronous effect body so we
            // don't trigger cascading renders (react-hooks/set-state-in-effect).
            await Promise.resolve()
            if (cancelled) return
            setLoading(true)
            setError(null)
            try {
                const result = await (isCoachView ? loadCoach() : loadOrganizer())
                if (cancelled) return
                if (!result) setError('No submitted ballots for this trial yet.')
                else setData(result)
            } catch (e: unknown) {
                if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load scoresheet')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        void run()

        return () => { cancelled = true }
    }, [id, round, pairingId, isCoachView])

    if (loading) {
        return (
            <main className="cs-page">
                <button className="cs-back-btn" onClick={() => navigate(-1)}>← Back</button>
                <p className="cs-message">Loading combined scoresheet…</p>
            </main>
        )
    }

    if (error || !data) {
        return (
            <main className="cs-page">
                <button className="cs-back-btn" onClick={() => navigate(-1)}>← Back</button>
                <p className="cs-message">{error ?? 'Scoresheet not found.'}</p>
            </main>
        )
    }

    return (
        <main className="cs-page">
            <div className="cs-toolbar">
                <button className="cs-back-btn" onClick={() => navigate(-1)}>← Back</button>
                <button
                    className="cs-print-btn"
                    onClick={() => void downloadCombinedXlsx(
                        {
                            rows: data.rows,
                            ballots: data.ballots,
                            prosLabel: data.prosLabel,
                            prosecutionCode: data.prosecutionCode,
                            defenseCode: data.defenseCode,
                            roundLabel,
                            dateLabel,
                            tiebreaker: data.tiebreaker,
                        },
                        `scoresheet-${data.prosecutionCode || 'pros'}-vs-${data.defenseCode || 'def'}.xlsx`,
                    )}
                >
                    Save as Excel
                </button>
            </div>
            <CombinedScoresheet
                rows={data.rows}
                ballots={data.ballots}
                prosLabel={data.prosLabel}
                prosecutionCode={data.prosecutionCode}
                defenseCode={data.defenseCode}
                roundLabel={roundLabel}
                dateLabel={dateLabel}
                tiebreaker={data.tiebreaker}
            />
        </main>
    )
}

/**
 * Combines fetched ballot details into the {@link CombinedScoresheet} inputs.
 *
 * Canonical rows come from a ballot's stored `layout` snapshot when available
 * (deterministic across template changes); otherwise they fall back to the live
 * sheet format. Each ballot's scores are then mapped onto those canonical rows.
 * Returns null if no usable ballot exists.
 */
function buildData(
    details: (BallotDetail | null)[],
    label: (d: BallotDetail, index: number) => string,
): LoadedData | null {
    const usable = details.filter((d): d is BallotDetail => !!d && !!d.ballot)
    if (usable.length === 0) return null

    const sheet = usable.find(d => d.sheet)?.sheet ?? null
    const layout = usable.find(d => d.ballot?.layout && d.ballot.layout.length > 0)?.ballot?.layout
    const rows = layout ? rowsFromLayout(layout) : sheet ? rowsFromSheet(sheet) : null
    if (!rows || rows.length === 0) return null

    const ballots: CombinedBallot[] = usable.map((d, i) => ({
        label: label(d, i),
        scores: mapBallot(rows, d.ballot!),
    }))

    // Team codes / prosecution label: prefer the sheet, else the layout can't
    // carry them, so fall back to blanks (rows still render correctly).
    // The presider tiebreaker is taken from whichever ballot recorded one.
    const tiebreaker = usable.map(d => d.ballot?.tiebreaker).find(t => !!t) ?? null
    return {
        rows,
        ballots,
        prosLabel: sheet ? (sheet.isCriminal ? 'Prosecution' : 'Plaintiff') : 'Prosecution',
        prosecutionCode: sheet?.prosecutionCode ?? '',
        defenseCode: sheet?.defenseCode ?? '',
        tiebreaker,
    }
}
