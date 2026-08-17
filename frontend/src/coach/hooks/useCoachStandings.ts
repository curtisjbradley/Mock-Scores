import { useEffect, useState } from 'react'
import * as Blockly from 'blockly'
import { apiFetch } from '../../auth/auth'
import { computeStandings } from '../../organizer/blockly/standingsEngine'
import { extractStandingsConfig, parseColumnsFromXml } from '../../organizer/blockly/standingsGenerator'
import { standingsBlockDefs } from '../../organizer/blockly/standingsBlocks'
import { tiebreakerBlockDefs } from '../../organizer/blockly/tiebreakerBlocks'
import type { ICoachTournament, IStandingsTeam } from '@mock-scores/shared'

interface CoachStandingsData {
    standingsRows: ReturnType<typeof computeStandings>
    standingsCols: { stat: string; label: string }[]
    standingsXml: string | null
}

interface StandingsApiPayload {
    config: { statsXml: string; standingsXml: string }
    teams: { id: string; name: string; code: string }[]
    ballots: { p_team_id: string; d_team_id: string; p_points: number; d_points: number; pairing_id: string }[]
}

interface ComputedStandings {
    rows: ReturnType<typeof computeStandings>
    cols: { stat: string; label: string }[]
    standingsXml: string
}

/**
 * Pure computation: parses Blockly XML configs and ballot data from the API
 * payload into standings rows and column definitions.
 *
 * Extracted from the `useCoachStandings` effect callback to keep the hook
 * under the cognitive complexity threshold and to make this computation
 * independently testable.
 *
 * @param data - Raw API response from `/coach/tournaments/:id/standings`
 */
function computeStandingsFromData(data: StandingsApiPayload): ComputedStandings {
    // Register Blockly blocks (safe to call multiple times)
    try { Blockly.common.defineBlocks(standingsBlockDefs) } catch { /* already defined */ }
    try { Blockly.common.defineBlocks(tiebreakerBlockDefs) } catch { /* already defined */ }

    // Parse XML configs into temporary workspaces
    const statsWs = new Blockly.Workspace()
    const standingsWs = new Blockly.Workspace()
    Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(data.config.statsXml), statsWs)
    Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(data.config.standingsXml), standingsWs)
    const config = extractStandingsConfig(statsWs, standingsWs)
    statsWs.dispose()
    standingsWs.dispose()

    // Build team map from roster data
    const teamMap = new Map<string, IStandingsTeam>()
    for (const t of data.teams)
        teamMap.set(t.id, { name: t.name, code: t.code, pairings: [] })

    // Aggregate per-pairing ballot totals (multiple ballots per pairing)
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

    // Push pairing records onto each team
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
 * Lazily fetches and computes standings data for the coach dashboard's
 * Standings tab. Only runs the Blockly workspace computation when the
 * standings tab is first opened.
 *
 * @param id - Tournament ID from the route param
 * @param tab - Currently active tab; computation is deferred until 'standings'
 * @param tournament - Resolved tournament object (computation skips if null)
 */
export function useCoachStandings(
    id: string | undefined,
    tab: string,
    tournament: ICoachTournament | null,
): CoachStandingsData {
    const [standingsRows, setStandingsRows] = useState<ReturnType<typeof computeStandings>>([])
    const [standingsCols, setStandingsCols] = useState<{ stat: string; label: string }[]>([])
    const [standingsXml, setStandingsXml] = useState<string | null>(null)

    useEffect(() => {
        if (!id || !tournament || tab !== 'standings' || standingsRows.length > 0) return

        apiFetch(`/coach/tournaments/${id}/standings`)
            .then(r => r.ok ? r.json() : null)
            .then((data: StandingsApiPayload | null) => {
                if (!data?.config) return
                const result = computeStandingsFromData(data)
                setStandingsCols(result.cols)
                setStandingsRows(result.rows)
                setStandingsXml(result.standingsXml)
            })
            .catch((e) => { console.error('Standings computation failed:', e) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, id, tournament])

    return { standingsRows, standingsCols, standingsXml }
}
