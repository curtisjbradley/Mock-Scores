import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../../auth/auth'
import type { IScoreSheetFormat, ScorecardPayload, BallotLayoutSegment, IPairingScorer } from '@mock-scores/shared'
import CombinedScoresheet, { type CombinedBallot, type CombinedStat, type SegmentRow } from './CombinedScoresheet'
import { downloadCombinedXlsx } from './combinedScoresheetXls'
import { resolveCoachTournament } from '../../coach/coachApi'
import { parseDsl } from '../../organizer/blockly/standingsDsl'
import type { StandingsConfig } from '../../organizer/blockly/standingsGenerator'
import { computePairingStats, type PairingBallot } from '../../coach/pairingStats'
import './combined-scoresheet.css'

type StoredBallotRecord = {
    scorer_assignment_id: string
    ballot_json: ScorecardPayload
    tiebreaker?: string | null
    presider_ballot?: boolean
    p_points?: number
    d_points?: number
}

type DirectBallotPayload = ScorecardPayload & {
    tiebreaker?: string | null
}

type BallotDetail = {
    sheet: IScoreSheetFormat | null
    // Organizer returns a DB ballot record containing ballot_json; coach returns
    // the ScorecardPayload directly. Normalize both shapes through the helpers below.
    ballot: StoredBallotRecord | DirectBallotPayload | null
}

function isStoredBallotRecord(ballot: NonNullable<BallotDetail['ballot']>): ballot is StoredBallotRecord {
    return 'ballot_json' in ballot
}

function ballotPayload(detail: BallotDetail): ScorecardPayload | null {
    const ballot = detail.ballot
    if (!ballot) return null
    return isStoredBallotRecord(ballot) ? ballot.ballot_json : ballot
}

function ballotTiebreaker(detail: BallotDetail): string | null {
    const ballot = detail.ballot
    if (!ballot) return null
    if (isStoredBallotRecord(ballot)) {
        return ballot.tiebreaker ?? (ballot.ballot_json as DirectBallotPayload).tiebreaker ?? null
    }
    return ballot.tiebreaker ?? null
}

function ballotPresider(detail: BallotDetail): boolean {
    const ballot = detail.ballot
    return !!ballot && isStoredBallotRecord(ballot) ? (ballot.presider_ballot ?? false) : false
}

function ballotPoints(detail: BallotDetail): Pick<BallotPoints, 'p_points' | 'd_points'> {
    const ballot = detail.ballot
    if (!ballot || !isStoredBallotRecord(ballot)) return { p_points: 0, d_points: 0 }
    return { p_points: ballot.p_points ?? 0, d_points: ballot.d_points ?? 0 }
}

function scorerAssignmentId(detail: BallotDetail): string | null {
    const ballot = detail.ballot
    return ballot && isStoredBallotRecord(ballot) ? ballot.scorer_assignment_id : null
}

/** A scorer's ballot point totals for the pairing, used to compute per-trial stats. */
type BallotPoints = {
    p_points: number
    d_points: number
    presider_ballot?: boolean
    tiebreaker?: string | null
}

/** Formats an ISO date-time string as a localized date + time, or null when absent/invalid. */
function formatRoundTime(iso: string | null): string | null {
    if (!iso) return null
    const d = new Date(iso)
    if (isNaN(d.getTime())) return null
    return d.toLocaleString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
    })
}

interface LoadedData {
    rows: SegmentRow[]
    ballots: CombinedBallot[]
    prosLabel: string
    prosecutionCode: string
    defenseCode: string
    prosecutionId: string
    defenseId: string
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
        pStudent: seg.pStudentName,
        dStudent: seg.dStudentName,
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
                pStudent: pName,
                dStudent: dName,
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
    const cells = cellsOf(rows)
    const rowKeys = new Set(cells.map(c => `${c.key}:${c.side}`))
    const mapped = new Map<string, number>()
    const usedScores = new Set<number>()

    // 1) Exact mapping for ballots whose assignment keys still match the sheet.
    ballot.scores.forEach((score, index) => {
        const key = `${score.assignmentKey}:${score.side}`
        if (rowKeys.has(key)) {
            mapped.set(key, score.score)
            usedScores.add(index)
        }
    })

    if (ballot.scores.length > 0 && usedScores.size >= ballot.scores.length * 0.9) {
        return mapped
    }

    // 2) Legacy non-witness fields. Their category/assignment ids can be regenerated,
    // but their side ordering is stable, so align unmatched non-witness cells by side.
    for (const side of ['P', 'D'] as const) {
        const targetCells = cells.filter(c => c.witness == null && c.side === side && !mapped.has(`${c.key}:${c.side}`))
        const candidates = ballot.scores
            .map((score, index) => ({ score, index }))
            .filter(({ score, index }) => !usedScores.has(index) && witnessOf(score.assignmentKey) == null && score.side === side)

        const count = Math.min(targetCells.length, candidates.length)
        for (let i = 0; i < count; i++) {
            mapped.set(`${targetCells[i].key}:${side}`, candidates[i].score.score)
            usedScores.add(candidates[i].index)
        }
    }

    // 3) Witness fields. Old ballots may have completely different category,
    // assignment, and witness UUIDs from the current sheet. Group both sides by
    // witness encounter order, pair groups with the same P/D signature, then map
    // within each paired group by side + ordinal position.
    type SheetWitnessGroup = {
        witness: string
        cells: ReturnType<typeof cellsOf>
        signature: string
    }
    type BallotWitnessEntry = { score: ScorecardPayload['scores'][number]; index: number }
    type BallotWitnessGroup = {
        id: string
        scores: BallotWitnessEntry[]
        signature: string
    }

    const sheetGroupsByWitness = new Map<string, ReturnType<typeof cellsOf>>()
    const sheetWitnessOrder: string[] = []
    for (const cell of cells) {
        if (!cell.witness || mapped.has(`${cell.key}:${cell.side}`)) continue
        if (!sheetGroupsByWitness.has(cell.witness)) {
            sheetGroupsByWitness.set(cell.witness, [])
            sheetWitnessOrder.push(cell.witness)
        }
        sheetGroupsByWitness.get(cell.witness)!.push(cell)
    }
    const sheetGroups: SheetWitnessGroup[] = sheetWitnessOrder.map(witness => {
        const groupCells = sheetGroupsByWitness.get(witness) ?? []
        return {
            witness,
            cells: groupCells,
            signature: groupCells.map(c => c.side).join(','),
        }
    })

    const ballotGroupsById = new Map<string, BallotWitnessEntry[]>()
    const ballotGroupOrder: string[] = []
    ballot.scores.forEach((score, index) => {
        if (usedScores.has(index)) return
        const witness = witnessOf(score.assignmentKey)
        if (!witness) return
        // categoryId is the best historical witness-group key when present; the
        // trailing witness UUID is a safe fallback.
        const groupId = score.categoryId ?? witness
        if (!ballotGroupsById.has(groupId)) {
            ballotGroupsById.set(groupId, [])
            ballotGroupOrder.push(groupId)
        }
        ballotGroupsById.get(groupId)!.push({ score, index })
    })
    const ballotGroups: BallotWitnessGroup[] = ballotGroupOrder.map(id => {
        const scores = ballotGroupsById.get(id) ?? []
        return {
            id,
            scores,
            signature: scores.map(entry => entry.score.side).join(','),
        }
    })

    const consumedBallotGroups = new Set<string>()
    for (const sheetGroup of sheetGroups) {
        const ballotGroup = ballotGroups.find(group =>
            !consumedBallotGroups.has(group.id) && group.signature === sheetGroup.signature
        )
        if (!ballotGroup) continue
        consumedBallotGroups.add(ballotGroup.id)

        const bySide: Record<'P' | 'D', BallotWitnessEntry[]> = { P: [], D: [] }
        for (const entry of ballotGroup.scores) bySide[entry.score.side].push(entry)
        const offsets: Record<'P' | 'D', number> = { P: 0, D: 0 }

        for (const cell of sheetGroup.cells) {
            const candidate = bySide[cell.side][offsets[cell.side]++]
            if (!candidate || usedScores.has(candidate.index)) continue
            mapped.set(`${cell.key}:${cell.side}`, candidate.score.score)
            usedScores.add(candidate.index)
        }
    }

    return mapped
}

/**
 * Fetches every submitted ballot for a pairing and renders the combined
 * scoresheet (see {@link CombinedScoresheet}). Works for both roles:
 *
 * - Coach route `/coach/:teamId/pairing/:pairingId/scoresheet` — resolves the
 *   tournament from the team, then uses the coach ballots endpoints. Scorer
 *   identities are redacted server-side, so columns are labelled "Scorer 1..N".
 * - Organizer route `/organizer/:id/pairing/:pairingId/scoresheet`
 *   — uses the round scorers list + per-assignment scoresheet endpoint, so
 *   columns are labelled with the real scorer names.
 */
export default function CombinedScoresheetPage() {
    // Organizer routes use `:id` (tournament id); coach routes use `:teamId`.
    const { id, teamId, pairingId } = useParams<{ id: string; teamId: string; pairingId: string }>()
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

            // Coach ballot endpoints are scoped by team id, while standings are
            // scoped by the resolved tournament id. This mirrors ScorecardViewer.
            const coachTeamId = info.teamId || routeId
            const [listRes, standingsRes] = await Promise.all([
                apiFetch(`/coach/tournaments/${coachTeamId}/pairings/${pairingId}/ballots`),
                apiFetch(`/coach/tournaments/${tid}/standings`).catch(() => null),
            ])
            if (!listRes.ok) throw new Error('Failed to load ballots')
            const list = await listRes.json() as { assignment_id: string; p_points: number; d_points: number; ballot_id: string }[]
            const details = await Promise.all(list.map(b =>
                apiFetch(`/coach/tournaments/${coachTeamId}/pairings/${pairingId}/ballots/${b.ballot_id}`)
                    .then(r => r.ok ? r.json() as Promise<BallotDetail> : null)
            ))
            const points: BallotPoints[] = list.map((b, i) => ({
                p_points: b.p_points,
                d_points: b.d_points,
                presider_ballot: details[i] ? ballotPresider(details[i]!) : false,
                tiebreaker: details[i] ? ballotTiebreaker(details[i]!) : null,
            }))
            const dsl = standingsRes?.ok
                ? (await standingsRes.json().catch(() => null) as { config?: { dsl?: string } } | null)?.config?.dsl ?? null
                : null
            return buildData(details, (_d, i) => `Scorer ${i + 1}`, points, dsl)
        }

        const loadOrganizer = async (): Promise<LoadedData | null> => {
            if (!pairingId) throw new Error('Missing pairing')
            const [scorersRes, configRes] = await Promise.all([
                apiFetch(`/organizer/tournament/${routeId}/pairings/${pairingId}/scorers`),
                apiFetch(`/organizer/tournament/${routeId}/standings-config`).catch(() => null),
            ])
            if (!scorersRes.ok) throw new Error('Failed to fetch scorers list')
            const scorers = await scorersRes.json() as IPairingScorer[]


            // Only scorers who have actually submitted a ballot contribute columns.
            // The explicit type guard keeps ballot_id narrowed to string below.
            const submitted = scorers.filter(
                (s): s is IPairingScorer & { ballot_id: string } =>
                    typeof s.ballot_id === 'string' && s.ballot_id.length > 0,
            )

            const details = await Promise.all(submitted.map(s =>
                apiFetch(`/organizer/tournament/${routeId}/pairings/${pairingId}/scoresheets/${s.ballot_id}`)
                    .then(r => r.ok ? r.json() as Promise<BallotDetail> : null)
            ))

            const dsl = configRes?.ok
                ? (await configRes.json().catch(() => null) as { dsl?: string } | null)?.dsl ?? null
                : null

            const points: BallotPoints[] = details.map(d => {
                if (!d) return { p_points: 0, d_points: 0, presider_ballot: false, tiebreaker: null }
                const totals = ballotPoints(d)
                return {
                    ...totals,
                    presider_ballot: ballotPresider(d),
                    tiebreaker: ballotTiebreaker(d),
                }
            })


            // Ballot details identify the scorer by assignment id. Key names by that
            // stable id rather than relying on scorer/ballot array ordering.
            const scorerNameByAssignment = new Map(
                submitted.map(s => [s.assignment_id, s.name] as const),
            )

            return buildData(
                details,
                (d, i) => scorerNameByAssignment.get(scorerAssignmentId(d) ?? '') ?? `Scorer ${i + 1}`,
                points,
                dsl,
            )
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
    }, [routeId, pairingId, isCoachView])

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
                            prosecutionId: data.prosecutionId,
                            defenseId: data.defenseId,
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
    // Keep each detail paired with both its normalized ScorecardPayload and point
    // totals. Coach responses expose the payload directly; organizer responses wrap
    // it in ballot_json.
    const paired = details.map((d, i) => ({
        d,
        payload: d ? ballotPayload(d) : null,
        pts: points[i],
    }))
    const usablePairs = paired.filter(
        (x): x is { d: BallotDetail; payload: ScorecardPayload; pts: BallotPoints } =>
            !!x.d && !!x.payload,
    )
    if (usablePairs.length === 0) return null

    const sheet = usablePairs.find(x => x.d.sheet)?.d.sheet ?? null
    const layout = usablePairs
            .map(x => x.payload.layout)
            .find((candidate): candidate is BallotLayoutSegment[] => Array.isArray(candidate) && candidate.length > 0)
        ?? null
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

    const ballots: CombinedBallot[] = usablePairs.map((x, i) => ({
        label: label(x.d, i),
        scores: mapBallot(rows, x.payload),
    }))

    // Team codes / prosecution label: prefer the sheet, else the layout can't
    // carry them, so fall back to blanks (rows still render correctly).
    // The presider tiebreaker is taken from whichever ballot recorded one.
    const tiebreaker = usablePairs.map(x => ballotTiebreaker(x.d)).find(t => !!t) ?? null
    const prosLabel = sheet ? (sheet.isCriminal ? 'Prosecution' : 'Plaintiff') : 'Prosecution'
    const prosecutionCode = sheet?.prosecutionCode ?? ''
    const defenseCode = sheet?.defenseCode ?? ''

    const prosecutionId = sheet?.prosecutionId ?? ''
    const defenseId = sheet?.defenseId ?? ''
    // Compute the tournament's configured standings stats for this trial, when a
    // config is available and team codes are known (needed to key the engine).
    const statSummary = buildStatSummary(
        dsl,
        usablePairs.map(x => x.pts),
        prosecutionCode,
        defenseCode,
        prosecutionId,
        defenseId,
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
    prosecutionId: string,
    defenseId: string,
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
        presider_ballot: p.presider_ballot ?? false,
        tiebreaker: p.tiebreaker ?? null,
    }))
    const tbWinner: 'P' | 'D' | null =
        tiebreaker === prosecutionId || tiebreaker === prosecutionCode
            ? 'P'
            : tiebreaker === defenseId || tiebreaker === defenseCode
                ? 'D'
                : null

    const stats = computePairingStats(config, pairingBallots, prosecutionCode, defenseCode, tbWinner)
    return config.columns.map(c => ({
        label: c.label,
        prosecution: stats.prosecution.cells.find(x => x.stat === c.stat)?.value ?? NaN,
        defense: stats.defense.cells.find(x => x.stat === c.stat)?.value ?? NaN,
    }))
}
