import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../../auth/auth'
import type { IScoreSheetFormat, ScorecardPayload, IPairingScorer, BallotLayoutSegment } from '@mock-scores/shared'
import CombinedScoresheet, { type CombinedBallot, type CombinedStat, type SegmentRow } from './CombinedScoresheet'
import { downloadCombinedXlsx } from './combinedScoresheetXls'
import { resolveCoachTournament } from '../../coach/coachApi'
import { parseDsl } from '../../organizer/blockly/standingsDsl'
import type { StandingsConfig } from '../../organizer/blockly/standingsGenerator'
import { computePairingStats, type PairingBallot } from '../../coach/pairingStats'
import './combined-scoresheet.css'

type BallotDetail = { sheet: IScoreSheetFormat | null; ballot: ScorecardPayload | null }

/** A scorer's ballot point totals for the pairing, used to compute per-trial stats. */
type BallotPoints = { p_points: number; d_points: number }

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
    prosecutionId: string,
    defenseId: string,
    /** Presider tiebreaker (a team uuid) from whichever ballot recorded one. */
    tiebreaker: string | null
    /** Tournament-configured standings stats for this trial, or null if no config. */
    statSummary: CombinedStat[] | null
}

/** Builds canonical segment rows from a ballot's stored layout snapshot. */
function rowsFromLayout(layout: BallotLayoutSegment[]): SegmentRow[] {
    return layout.map(seg => ({
        key: seg.assignmentKey,
        label: seg.witnessName ? `${seg.witnessName}: ${seg.assignmentName}` : seg.assignmentName,
        hasP: seg.side !== 'D',
        hasD: seg.side !== 'P',
        student: seg.pStudentName ?? seg.dStudentName,
        // Layout snapshots don't capture the multiplier; default to 1 here and let
        // buildData overlay the live multiplier from the sheet when available.
        multiplier: 1,
    }))
}

/**
 * Builds an `assignmentKey → multiplier` lookup from the live sheet format.
 * Used to attach per-field multipliers to canonical rows regardless of whether
 * those rows came from a layout snapshot (which omits multipliers) or the sheet.
 */
function multipliersFromSheet(sheet: IScoreSheetFormat): Map<string, number> {
    const map = new Map<string, number>()
    for (const catId of sheet.categoryOrder) {
        const cat = sheet.scoringCategories[catId]
        if (!cat) continue
        for (const a of cat.categoryAssignments) {
            // `numeric` columns can arrive as strings from the API; normalize to a
            // number so SegmentRow.multiplier is genuinely numeric downstream.
            const m = Number(a.multiplier ?? 1)
            map.set(a.assignmentKey, Number.isNaN(m) ? 1 : m)
        }
    }
    return map
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
                label: witnessName ? `${witnessName}: ${a.assignmentName}` : a.assignmentName,
                hasP: a.side !== 'D',
                hasD: a.side !== 'P',
                student: pName ?? dName,
                multiplier: Number(a.multiplier ?? 1) || 1,
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
 * - Coach route `/coach/:teamId/pairing/:pairingId/scoresheet` — resolves the
 *   tournament from the team, then uses the coach ballots endpoints. Scorer
 *   identities are redacted server-side, so columns are labelled "Scorer 1..N".
 * - Organizer route `/organizer/:id/round/:round/pairing/:pairingId/scoresheet`
 *   — uses the round scorers list + per-assignment scoresheet endpoint, so
 *   columns are labelled with the real scorer names.
 */
export default function CombinedScoresheetPage() {
    // Organizer routes use `:id` (tournament id); coach routes use `:teamId`.
    const { id, teamId, round, pairingId } = useParams<{ id: string; teamId: string; round?: string; pairingId: string }>()
    const navigate = useNavigate()
    const [params] = useSearchParams()
    const isCoachView = window.location.pathname.includes('/coach/')

    // The route id that identifies the fetch scope: organizer tournament id, or
    // the coach team id (resolved to a tournament id below).
    const routeId = isCoachView ? (teamId ?? '') : (id ?? '')

    const roundLabel = params.get('roundName') || null
    const dateLabel = formatRoundTime(params.get('roundTime'))

    const [data, setData] = useState<LoadedData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!routeId || !pairingId) return
        let cancelled = false

        const loadCoach = async (): Promise<LoadedData | null> => {
            // Coach ballots endpoints query by tournament id; resolve it from the team.
            const info = await resolveCoachTournament(routeId, false, undefined)
            const tid = info?.tournamentId
            if (!tid) throw new Error('Failed to resolve tournament')
            const [listRes, standingsRes] = await Promise.all([
                apiFetch(`/coach/tournaments/${tid}/pairings/${pairingId}/ballots`),
                apiFetch(`/coach/tournaments/${tid}/standings`).catch(() => null),
            ])
            if (!listRes.ok) throw new Error('Failed to load ballots')
            const list = await listRes.json() as { assignment_id: string; p_points: number; d_points: number }[]
            const details = await Promise.all(list.map(b =>
                apiFetch(`/coach/tournaments/${tid}/pairings/${pairingId}/ballots/${b.assignment_id}`)
                    .then(r => r.ok ? r.json() as Promise<BallotDetail> : null)
            ))
            const points: BallotPoints[] = list.map(b => ({ p_points: b.p_points, d_points: b.d_points }))
            const dsl = standingsRes?.ok
                ? (await standingsRes.json().catch(() => null) as { config?: { dsl?: string } } | null)?.config?.dsl ?? null
                : null
            return buildData(details, (_d, i) => `Scorer ${i + 1}`, points, dsl)
        }

        const loadOrganizer = async (): Promise<LoadedData | null> => {
            if (!round) throw new Error('Missing round')
            const [scorersRes, configRes] = await Promise.all([
                apiFetch(`/organizer/tournament/${routeId}/rounds/${round}/pairings/${pairingId}/scorers`),
                apiFetch(`/organizer/tournament/${routeId}/standings-config`).catch(() => null),
            ])
            if (!scorersRes.ok) throw new Error('Failed to load scorers')
            const scorers = await scorersRes.json() as IPairingScorer[]
            // Only scorers who have actually submitted a ballot contribute columns.
            const submitted = scorers.filter(s => s.p_points != null || s.d_points != null)
            const details = await Promise.all(submitted.map(s =>
                apiFetch(`/organizer/tournament/${routeId}/pairings/${pairingId}/scoresheets/${s.assignment_id}`)
                    .then(r => r.ok ? r.json() as Promise<BallotDetail> : null)
            ))
            const points: BallotPoints[] = submitted.map(s => ({ p_points: s.p_points ?? 0, d_points: s.d_points ?? 0 }))
            const dsl = configRes?.ok
                ? (await configRes.json().catch(() => null) as { dsl?: string } | null)?.dsl ?? null
                : null
            return buildData(details, (_d, i) => submitted[i]?.name || `Scorer ${i + 1}`, points, dsl)
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
    }, [routeId, round, pairingId, isCoachView])

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
                            statSummary: data.statSummary,
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
                statSummary={data.statSummary}
                prosecutionId={data.prosecutionId}
                defenseId={data.defenseId}
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
    points: BallotPoints[],
    dsl: string | null,
): LoadedData | null {
    // Keep each detail paired with its point totals so filtering stays aligned.
    const paired = details.map((d, i) => ({ d, pts: points[i] }))
    const usablePairs = paired.filter((x): x is { d: BallotDetail; pts: BallotPoints } => !!x.d && !!x.d.ballot)
    const usable = usablePairs.map(x => x.d)
    if (usable.length === 0) return null

    const sheet = usable.find(d => d.sheet)?.sheet ?? null
    const layout = usable.find(d => d.ballot?.layout && d.ballot.layout.length > 0)?.ballot?.layout
    const rows = layout ? rowsFromLayout(layout) : sheet ? rowsFromSheet(sheet) : null
    if (!rows || rows.length === 0) return null

    // Overlay live per-field multipliers from the sheet onto the canonical rows.
    // rowsFromSheet already sets them, but the preferred layout path can't, so
    // this ensures the Mult column and multiplier-weighted totals are correct
    // regardless of which row source was used.
    if (sheet) {
        const multMap = multipliersFromSheet(sheet)
        for (const r of rows) {
            const m = multMap.get(r.key)
            if (m != null) r.multiplier = m
        }
    }

    const ballots: CombinedBallot[] = usable.map((d, i) => ({
        label: label(d, i),
        scores: mapBallot(rows, d.ballot!),
    }))

    // Team codes / prosecution label: prefer the sheet, else the layout can't
    // carry them, so fall back to blanks (rows still render correctly).
    // The presider tiebreaker is taken from whichever ballot recorded one.
    const tiebreaker = usable.map(d => d.ballot?.tiebreaker).find(t => !!t) ?? null
    const prosLabel = sheet ? (sheet.isCriminal ? 'Prosecution' : 'Plaintiff') : 'Prosecution'
    const prosecutionCode = sheet?.prosecutionCode ?? ''
    const defenseCode = sheet?.defenseCode ?? ''

    const prosecutionId = sheet?.prosecutionId ?? ""
    const defenseId = sheet?.defenseId ?? ""
    // Compute the tournament's configured standings stats for this trial, when a
    // config is available and team codes are known (needed to key the engine).
    const statSummary = buildStatSummary(
        dsl,
        usablePairs.map(x => x.pts),
        prosecutionCode,
        defenseCode,
        tiebreaker,
    )

    return {
        rows,
        ballots,
        prosLabel,
        prosecutionCode,
        defenseCode,
        tiebreaker,
        statSummary,
        prosecutionId,
        defenseId
    }
}

/**
 * Runs the tournament's standings DSL over this trial's per-ballot points to
 * produce per-side stat values, using the same engine the standings page uses.
 * Returns null when there is no config or the team codes are unknown (the engine
 * keys teams by code).
 */
function buildStatSummary(
    dsl: string | null,
    points: BallotPoints[],
    prosecutionCode: string,
    defenseCode: string,
    tiebreaker: string | null,
): CombinedStat[] | null {
    if (!dsl || !prosecutionCode || !defenseCode || points.length === 0) return null
    let config: StandingsConfig
    try {
        config = parseDsl(dsl)
    } catch {
        return null
    }
    if (config.columns.length === 0) return null

    const pairingBallots: PairingBallot[] = points.map(p => ({
        p_points: p.p_points,
        d_points: p.d_points,
        presider_ballot: false,
        tiebreaker: null,
    }))
    const tbWinner: 'P' | 'D' | null =
        tiebreaker === prosecutionCode ? 'P' : tiebreaker === defenseCode ? 'D' : null

    const stats = computePairingStats(config, pairingBallots, prosecutionCode, defenseCode, tbWinner)
    return config.columns.map(c => ({
        label: c.label,
        prosecution: stats.prosecution.cells.find(x => x.stat === c.stat)?.value ?? NaN,
        defense: stats.defense.cells.find(x => x.stat === c.stat)?.value ?? NaN,
    }))
}
