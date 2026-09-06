import { lazy, useMemo } from 'react'
import * as Blockly from 'blockly'
import type { IStandingsTeam } from '@mock-scores/shared'
import { computeStandings } from '../../organizer/blockly/standingsEngine'
import { extractStandingsConfig, parseColumnsFromXml } from '../../organizer/blockly/standingsGenerator'
import { standingsBlockDefs } from '../../organizer/blockly/standingsBlocks'
import { tiebreakerBlockDefs } from '../../organizer/blockly/tiebreakerBlocks'
import { type StandingsApiPayload, useCoachContext } from '../CoachContext'
import '../styles/coach-pages.css'

const TiebreakerViewer = lazy(() => import('../../organizer/blockly/TiebreakerViewer'))

interface ComputedStandings {
    rows: ReturnType<typeof computeStandings>
    cols: { stat: string; label: string }[]
    standingsXml: string
}

/**
 * Pure computation: parses Blockly XML configs and ballot data from the API
 * payload into standings rows and column definitions.
 */
function computeStandingsFromData(data: StandingsApiPayload): ComputedStandings {
    try { Blockly.common.defineBlocks(standingsBlockDefs) } catch { /* already defined */ }
    try { Blockly.common.defineBlocks(tiebreakerBlockDefs) } catch { /* already defined */ }

    const statsWs = new Blockly.Workspace()
    const standingsWs = new Blockly.Workspace()
    Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(data.config.statsXml), statsWs)
    Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(data.config.standingsXml), standingsWs)
    const config = extractStandingsConfig(statsWs, standingsWs)
    statsWs.dispose()
    standingsWs.dispose()

    const teamMap = new Map<string, IStandingsTeam>()
    for (const t of data.teams)
        teamMap.set(t.id, { name: t.name, code: t.code, pairings: [] })

    const pairingMap = new Map<string, { p: string; d: string; pPts: number; dPts: number }>()
    for (const b of data.ballots) {
        const existing = pairingMap.get(b.pairing_id)
        if (existing) {
            existing.pPts += b.p_points
            existing.dPts += b.d_points
        } else {
            pairingMap.set(b.pairing_id, { p: b.p_team_id, d: b.d_team_id, pPts: b.p_points, dPts: b.d_points })
        }
    }

    for (const [, { p, d, pPts, dPts }] of pairingMap) {
        const pTeam = teamMap.get(p)
        const dTeam = teamMap.get(d)
        if (pTeam && dTeam) {
            pTeam.pairings.push({ opponent: dTeam.code, ballots: [{ pointsFor: pPts, pointsAgainst: dPts }], won_presider_tiebreaker: false })
            dTeam.pairings.push({ opponent: pTeam.code, ballots: [{ pointsFor: dPts, pointsAgainst: pPts }], won_presider_tiebreaker: false })
        }
    }

    return {
        rows: computeStandings([...teamMap.values()], config),
        cols: parseColumnsFromXml(data.config.statsXml),
        standingsXml: data.config.standingsXml,
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

    const { rows, cols, standingsXml } = computed

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
            {standingsXml && (
                <div className="coach-tiebreaker-viewer">
                    <TiebreakerViewer standingsXml={standingsXml} />
                </div>
            )}
        </>
    )
}
