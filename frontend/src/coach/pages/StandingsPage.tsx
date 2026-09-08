import { lazy, useMemo } from 'react'
import type { IStandingsTeam } from '@mock-scores/shared'
import { computeStandings } from '../../organizer/blockly/standingsEngine'
import { parseDsl } from '../../organizer/blockly/standingsDsl'
import { type StandingsApiPayload, useCoachContext } from '../CoachContext'
import '../styles/standings.css'

const TiebreakerViewer = lazy(() => import('../../organizer/blockly/TiebreakerViewer'))

interface ComputedStandings {
    rows: ReturnType<typeof computeStandings>
    cols: { stat: string; label: string }[]
    dsl: string
}

/**
 * Pure computation: parses the DSL standings config and ballot data from the
 * API payload into standings rows and column definitions. No Blockly.
 */
function computeStandingsFromData(data: StandingsApiPayload): ComputedStandings {
    const config = parseDsl(data.config.dsl)

    const teamMap = new Map<string, IStandingsTeam>()
    for (const t of data.teams)
        teamMap.set(t.id, { name: t.name, code: t.code, pairings: [] })

    const pairingMap = new Map<string, { p: string; d: string; pPts: number; dPts: number; tiebreakerWinner: string | null; scorers: number }>()
    for (const b of data.ballots) {
        const existing = pairingMap.get(b.pairing_id)
        if (existing) {
            existing.pPts += b.p_points
            existing.dPts += b.d_points
            existing.scorers += 1
            // The presider ballot carries the pairing's tiebreaker (winning team id).
            if (b.presider_ballot && b.tiebreaker) existing.tiebreakerWinner = b.tiebreaker
        } else {
            pairingMap.set(b.pairing_id, {
                p: b.p_team_id, d: b.d_team_id, pPts: b.p_points, dPts: b.d_points,
                tiebreakerWinner: b.presider_ballot ? b.tiebreaker : null,
                scorers: 1,
            })
        }
    }

    for (const [, { p, d, pPts, dPts, tiebreakerWinner, scorers }] of pairingMap) {
        const pTeam = teamMap.get(p)
        const dTeam = teamMap.get(d)
        if (pTeam && dTeam) {
            pTeam.pairings.push({ opponent: dTeam.code, ballots: [{ pointsFor: pPts, pointsAgainst: dPts }], won_presider_tiebreaker: tiebreakerWinner === p, num_scorers: scorers })
            dTeam.pairings.push({ opponent: pTeam.code, ballots: [{ pointsFor: dPts, pointsAgainst: pPts }], won_presider_tiebreaker: tiebreakerWinner === d, num_scorers: scorers })
        }
    }

    return {
        rows: computeStandings([...teamMap.values()], config),
        cols: config.columns,
        dsl: data.config.dsl,
    }
}

/**
 * Standings page. Reads the raw standings payload from the shared `CoachLayout`
 * context and runs the Blockly-based computation on it.
 */
export default function StandingsPage() {
    const { standings } = useCoachContext()

    const computed = useMemo<ComputedStandings | null>(() => {
        if (!standings?.config) return null
        try {
            return computeStandingsFromData(standings)
        } catch (e) {
            console.error('Standings computation failed:', e)
            return null
        }
    }, [standings])

    if (!computed || computed.rows.length === 0) return <p className="coach-empty">No standings available yet.</p>

    const { rows, cols, dsl } = computed

    return (
        <>
            <table className="dash-standings-table">
                <thead><tr>
                    <th>#</th><th>Code</th><th>Team</th>
                    {cols.map(c => <th key={c.stat}>{c.label}</th>)}
                </tr></thead>
                <tbody>{rows.map((row, i) => (
                    <tr key={row.code}>
                        <td>{i + 1}</td>
                        <td className="dash-team-code">{row.code}</td>
                        <td>{row.name}</td>
                        {cols.map(c => {
                            const val = row[c.stat]
                            const num = typeof val === 'number' ? val : NaN
                            return <td key={c.stat}>{isNaN(num) ? '—' : Number.isInteger(num) ? num : num.toFixed(3)}</td>
                        })}
                    </tr>
                ))}</tbody>
            </table>
            {dsl && (
                <div className="coach-tiebreaker-viewer">
                    <TiebreakerViewer dsl={dsl} />
                </div>
            )}
        </>
    )
}
