import type { StandingsConfig } from '../organizer/blockly/standingsGenerator'
import { computeStandings } from '../organizer/blockly/standingsEngine'

/** A single scorer's ballot within a pairing, from the standings payload. */
export interface PairingBallot {
    p_points: number
    d_points: number
    presider_ballot: boolean
    tiebreaker: string | null
}

/** One display column's computed value for a side of a pairing. */
export interface PairingStatCell {
    stat: string
    label: string
    value: number
}

/** Per-side computed stats for a single pairing (trial). */
export interface PairingSideStats {
    /** The tournament's standings columns, computed for this trial only. */
    cells: PairingStatCell[]
    /** Whether this side won the presider tiebreaker on this pairing. */
    wonTiebreaker: boolean
}

export interface PairingStats {
    prosecution: PairingSideStats
    defense: PairingSideStats
}

/**
 * Computes the tournament's standings columns for a single pairing (trial),
 * from each competing team's perspective.
 *
 * Rather than showing only raw P/D points — which are meaningless when a
 * tournament tabulates on ballots won, point differential, or a custom stat —
 * this feeds the pairing's ballots through the same {@link computeStandings}
 * engine the standings page uses, but scoped to a single trial. The result is
 * the exact set of stats (and labels) the tournament actually cares about,
 * evaluated for just this matchup.
 *
 * `tiebreakerWinner` is `'P'`/`'D'` when the presider ballot recorded a
 * tiebreaker for that side, or `null` when none was recorded.
 */
export function computePairingStats(
    config: StandingsConfig,
    ballots: PairingBallot[],
    prosecutionCode: string,
    defenseCode: string,
    tiebreakerWinner: 'P' | 'D' | null,
): PairingStats {
    const pWonTb = tiebreakerWinner === 'P'
    const dWonTb = tiebreakerWinner === 'D'

    // Build two single-pairing teams — one per side — each holding this trial's
    // ballots from that side's perspective. The engine aggregates per team.
    const pBallots = ballots.map(b => ({ pointsFor: b.p_points, pointsAgainst: b.d_points }))
    const dBallots = ballots.map(b => ({ pointsFor: b.d_points, pointsAgainst: b.p_points }))
    const numScorers = ballots.length

    const teams = [
        {
            name: prosecutionCode,
            code: prosecutionCode,
            pairings: [{
                opponent: defenseCode,
                ballots: pBallots,
                won_presider_tiebreaker: pWonTb,
                num_scorers: numScorers,
            }],
        },
        {
            name: defenseCode,
            code: defenseCode,
            pairings: [{
                opponent: prosecutionCode,
                ballots: dBallots,
                won_presider_tiebreaker: dWonTb,
                num_scorers: numScorers,
            }],
        },
    ]

    const rows = computeStandings(teams, config)
    const byCode = new Map(rows.map(r => [r.code, r]))

    const sideStats = (code: string, wonTiebreaker: boolean): PairingSideStats => {
        const row = byCode.get(code)
        const cells: PairingStatCell[] = config.columns.map(c => {
            const val = row?.[c.stat]
            return { stat: c.stat, label: c.label, value: typeof val === 'number' ? val : NaN }
        })
        return { cells, wonTiebreaker }
    }

    return {
        prosecution: sideStats(prosecutionCode, pWonTb),
        defense: sideStats(defenseCode, dWonTb),
    }
}

/** Formats a computed stat value for display (integers plain, else 3 dp, NaN as —). */
export function formatStatValue(value: number): string {
    if (Number.isNaN(value)) return '—'
    return Number.isInteger(value) ? String(value) : value.toFixed(3)
}
