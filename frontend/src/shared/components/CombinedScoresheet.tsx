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
}

interface Props {
    rows: SegmentRow[]
    ballots: CombinedBallot[]
    prosLabel: string
    prosecutionCode: string
    defenseCode: string
    /** Round name/number, e.g. "Round 1". */
    roundLabel?: string | null
    /** Trial date shown in the header. */
    dateLabel?: string | null
    /**
     * Presider tiebreaker selection, when submitted: the winning side's team code
     * (matches `prosecutionCode` or `defenseCode`), or '' / null if none.
     */
    tiebreaker?: string | null
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
    rows, ballots, prosLabel, prosecutionCode, defenseCode, roundLabel, dateLabel, tiebreaker,
}: Props) {
    // Per-scorer column totals (sum of that scorer's scores on each side).
    const scorerTotals = ballots.map(b => {
        let p = 0
        let d = 0
        for (const row of rows) {
            if (row.hasP) p += b.scores.get(`${row.key}:P`) ?? 0
            if (row.hasD) d += b.scores.get(`${row.key}:D`) ?? 0
        }
        return { p, d }
    })

    // Grand totals across all scorers, per side.
    const totalP = scorerTotals.reduce((a, t) => a + t.p, 0)
    const totalD = scorerTotals.reduce((a, t) => a + t.d, 0)

    // Percentages: each side's share of the combined points (mirrors the sheet's
    // "Pros % / Def %" split used to determine the winner on points).
    const combined = totalP + totalD
    const prosPct = combined ? totalP / combined : 0
    const defPct = combined ? totalD / combined : 0
    const winner =
        totalP > totalD ? `${prosLabel} (${prosecutionCode})`
        : totalD > totalP ? `Defense (${defenseCode})`
        : 'Tie'

    // Resolve the presider tiebreaker (a team code) to a readable side + code.
    const tiebreakerText = tiebreaker
        ? tiebreaker === prosecutionCode ? `${prosLabel} (${prosecutionCode})`
        : tiebreaker === defenseCode ? `Defense (${defenseCode})`
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
                            {scorerTotals.map((t, i) => (
                                <SideCells key={i} p={t.p} d={t.d} />
                            ))}
                            <td className="cs-student-col"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Summary: percentages + tiebreaker + winner */}
            <div className="cs-summary">
                <div className="cs-summary-pcts">
                    <div className="cs-pct">
                        <span className="cs-pct-label">{prosLabel} ({prosecutionCode})</span>
                        <span className="cs-pct-points">{totalP}</span>
                        <span className="cs-pct-value">{(prosPct * 100).toFixed(2)}%</span>
                    </div>
                    <div className="cs-pct">
                        <span className="cs-pct-label">Defense ({defenseCode})</span>
                        <span className="cs-pct-points">{totalD}</span>
                        <span className="cs-pct-value">{(defPct * 100).toFixed(2)}%</span>
                    </div>
                </div>
                <div className="cs-summary-right">
                    {tiebreakerText && (
                        <div className="cs-tiebreaker">
                            <span className="cs-tiebreaker-label">Presider tiebreaker:</span>
                            <span className="cs-tiebreaker-value">{tiebreakerText}</span>
                        </div>
                    )}
                    <div className="cs-winner">
                        <span className="cs-winner-label">Winner:</span>
                        <span className="cs-winner-value">{winner}</span>
                    </div>
                </div>
            </div>
        </div>
    )
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
