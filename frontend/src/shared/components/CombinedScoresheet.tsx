import './combined-scoresheet.css'

/** One scorer's ballot: a display label plus a map of `${assignmentKey}:${side}` → score. */
export interface CombinedBallot {
    /** Column header for this scorer (e.g. real name, or "Scorer 1"). */
    label: string
    /** Score lookup keyed by `${assignmentKey}:${side}`. Missing keys = unscored. */
    scores: Map<string, number>
}

/** A single segment (assignment) row within the combined grid. */
export interface SegmentRow {
    /** Stable key matching the `${key}:${side}` entries in each ballot's score map. */
    key: string
    label: string
    /** Whether this assignment is scored on the prosecution side. */
    hasP: boolean
    /** Whether this assignment is scored on the defense side. */
    hasD: boolean
    /** Student name associated with the row, if any (shown in the rightmost column). */
    student: string | null
    /**
     * Per-field score multiplier applied to this row's scores when totaling.
     * Defaults to 1 when unknown. Score cells display the raw entered value; the
     * Total row multiplies by this so totals match the tabulated point totals.
     */
    multiplier: number
}

/** A single tournament-configured stat, computed for this trial, per side. */
export interface CombinedStat {
    /** Column label from the tournament's standings config. */
    label: string
    /** Value for the prosecution/plaintiff side. */
    prosecution: number
    /** Value for the defense side. */
    defense: number
}

interface Props {
    rows: SegmentRow[]
    ballots: CombinedBallot[]
    prosLabel: string
    prosecutionCode: string
    defenseCode: string
    prosecutionId: string
    defenseId: string
    /** Round name/number, e.g. "Round 1". */
    roundLabel?: string | null
    /** Trial date shown in the header. */
    dateLabel?: string | null
    /**
     * Presider tiebreaker selection, when submitted: the winning side's team code
     * (matches `prosecutionCode` or `defenseCode`), or '' / null if none.
     */
    tiebreaker?: string | null
    /**
     * The tournament's configured standings stats, computed for this trial only.
     * When provided, they are shown alongside the raw point percentages so the
     * sheet reflects how the tournament actually tabulates (ballots won, point
     * differential, custom stats, …) rather than points alone. Empty/omitted →
     * only the point split is shown.
     */
    statSummary?: CombinedStat[] | null
}

/**
 * Combined per-trial scoresheet, modeled after the tabulation spreadsheet coaches
 * and organizers use by hand: every scoring segment is a row, each scorer gets a
 * Prosecution/Defense column pair, and the sheet totals each column and shows the
 * grand totals, percentages, presider tiebreaker, and the winner.
 *
 * Purely presentational — the caller supplies the ordered {@link SegmentRow}s and
 * resolves ballots into {@link CombinedBallot} score maps keyed by the same row
 * keys (labelling scorers however the viewer's role permits).
 */
export default function CombinedScoresheet({
    rows, ballots, prosLabel, prosecutionCode, defenseCode, roundLabel, dateLabel, tiebreaker, statSummary, prosecutionId, defenseId
}: Props) {
    // Per-scorer column totals (sum of that scorer's scores on each side),
    // weighting each row by its field multiplier so the totals match how the
    // tournament tabulates points.
    const scorerTotals = ballots.map(b => {
        let p = 0
        let d = 0
        for (const row of rows) {
            const mult = Number(row.multiplier ?? 1) || 1
            if (row.hasP) p += (b.scores.get(`${row.key}:P`) ?? 0) * mult
            if (row.hasD) d += (b.scores.get(`${row.key}:D`) ?? 0) * mult
        }
        return { p, d }
    })

    const [pTotal, dTotal] = scorerTotals.reduce(([p,d],curr) => {
        return [p+curr.p, d+curr.d];
    }, [0,0]);

    // Resolve the presider tiebreaker (a team code) to a readable side + code.
    const tiebreakerText = tiebreaker
        ? tiebreaker === prosecutionId ? `${prosLabel} (${prosecutionCode})`
        : tiebreaker === defenseId ? `Defense (${defenseCode})`
        : tiebreaker
        : null

    return (
        <div className="cs-sheet">
            {/* Header: round + date + matchup */}
            <div className="cs-header">
                <span className="cs-header-meta">
                    {roundLabel && <span className="cs-round">{roundLabel}</span>}
                    {dateLabel && <span className="cs-date">{dateLabel}</span>}
                </span>
                <span className="cs-matchup">
                    <span className="cs-team">{prosecutionCode}</span>
                    <span className="cs-vs">v.</span>
                    <span className="cs-team">{defenseCode}</span>
                </span>
            </div>

            <div className="cs-table-scroll">
                <table className="cs-table">
                    <thead>
                        <tr>
                            <th className="cs-seg-col" rowSpan={2}>
                                <span className="cs-scorer-count">{ballots.length} scorer{ballots.length !== 1 ? 's' : ''}</span>
                            </th>
                            <th className="cs-mult-col" rowSpan={2}>Mult</th>
                            {ballots.map((b, i) => (
                                <th key={i} className="cs-scorer-head" colSpan={2}>{b.label}</th>
                            ))}
                            <th className="cs-student-col" rowSpan={2}></th>
                        </tr>
                        <tr>
                            {ballots.map((_, i) => (
                                <SideHeaders key={i} prosLabel={prosLabel} />
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(row => (
                            <tr key={row.key}>
                                <td className="cs-seg-col">{row.label}</td>
                                <td className="cs-mult-col">{fmtMultiplier(row.multiplier)}</td>
                                {ballots.map((b, i) => (
                                    <SideCells
                                        key={i}
                                        p={row.hasP ? (b.scores.get(`${row.key}:P`) ?? null) : null}
                                        d={row.hasD ? (b.scores.get(`${row.key}:D`) ?? null) : null}
                                    />
                                ))}
                                <td className="cs-student-col">{row.student ?? ''}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="cs-total-row">
                            <td className="cs-seg-col">Total</td>
                            <td className="cs-mult-col"></td>
                            {scorerTotals.map((t, i) => (
                                <SideCells key={i} p={t.p} d={t.d} />
                            ))}
                            <td className="cs-student-col"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Summary: percentages + tiebreaker + winner */}
            {(pTotal === dTotal) && tiebreakerText && (
                <div className="cs-tiebreaker">
                    <span className="cs-tiebreaker-label">Presider tiebreaker:</span>
                    <span className="cs-tiebreaker-value">{tiebreakerText}</span>
                </div>
            )}

            {/* Tournament-configured stats for this trial, when available. Mirrors
                the coach results view: shows how the tournament actually tabulates,
                not just raw points. */}
            {statSummary && statSummary.length > 0 && (
                <div className="cs-stats">
                    <div className="cs-stats-title">Tournament stats - this trial</div>
                    <table className="cs-stats-table">
                        <thead>
                            <tr>
                                <th className="cs-stats-label-col">Stat</th>
                                <th className="cs-side-p">{prosLabel === 'Prosecution' ? 'Pros' : 'Pl'} ({prosecutionCode})</th>
                                <th className="cs-side-d">Def ({defenseCode})</th>
                            </tr>
                        </thead>
                        <tbody>
                            {statSummary.map((s, i) => {
                                const pLead = s.prosecution > s.defense
                                const dLead = s.defense > s.prosecution
                                return (
                                    <tr key={i}>
                                        <td className="cs-stats-label-col">{s.label}</td>
                                        <td className={`cs-side-p${pLead ? ' cs-stat-lead' : ''}`}>{fmtStat(s.prosecution)}</td>
                                        <td className={`cs-side-d${dLead ? ' cs-stat-lead' : ''}`}>{fmtStat(s.defense)}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

/** Formats a computed stat value (integers plain, else 3 dp, NaN as —). */
function fmtStat(value: number): string {
    if (Number.isNaN(value)) return '—'
    return Number.isInteger(value) ? String(value) : value.toFixed(3)
}

/** Formats a per-row multiplier as `×N` (integers plain, else trimmed decimals). */
function fmtMultiplier(value: number): string {
    // pg `numeric` columns can arrive as strings, so coerce before formatting.
    const m = Number(value ?? 1)
    if (Number.isNaN(m)) return '×1'
    return `×${Number.isInteger(m) ? String(m) : String(Number(m.toFixed(2)))}`
}

/** The paired "Pros / Def" sub-header cells under a scorer column. */
function SideHeaders({ prosLabel }: { prosLabel: string }) {
    return (
        <>
            <th className="cs-scorer-sub cs-side-p">{prosLabel === 'Prosecution' ? 'Pros' : 'Pl'}</th>
            <th className="cs-scorer-sub cs-side-d">Def</th>
        </>
    )
}

/** A paired Pros/Def data cell. `null` renders a blank (side not scored). */
function SideCells({ p, d }: { p: number | string | null; d: number | string | null }) {
    return (
        <>
            <td className="cs-score-cell cs-side-p">{p ?? ''}</td>
            <td className="cs-score-cell cs-side-d">{d ?? ''}</td>
        </>
    )
}
