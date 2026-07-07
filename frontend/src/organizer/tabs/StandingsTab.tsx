import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import * as Blockly from 'blockly'
import { apiFetch } from '../../auth/auth'
import { computeStandings } from '../blockly/standingsEngine'
import { extractStandingsConfig, parseColumnsFromXml } from '../blockly/standingsGenerator'
import { standingsBlockDefs } from '../blockly/standingsBlocks'
import { tiebreakerBlockDefs } from '../blockly/tiebreakerBlocks'
import type { IStandingsTeam } from '@mock-scores/shared'

const TiebreakerViewer = lazy(() => import('../blockly/TiebreakerViewer'))

interface Round { round_id: string; name: string }

interface Ballot {
    p_team_id: string
    d_team_id: string
    p_points: number
    d_points: number
    pairing_id: string
    round_id: string
}

interface StandingsApiPayload {
    config: { statsXml: string; standingsXml: string } | null
    teams: { id: string; name: string; code: string }[]
    ballots: Ballot[]
    rounds: Round[]
}

function computeFromBallots(
    ballots: Ballot[],
    teams: { id: string; name: string; code: string }[],
    config: { statsXml: string; standingsXml: string },
) {
    try { Blockly.common.defineBlocks(standingsBlockDefs) } catch { /* already defined */ }
    try { Blockly.common.defineBlocks(tiebreakerBlockDefs) } catch { /* already defined */ }

    const statsWs = new Blockly.Workspace()
    const standingsWs = new Blockly.Workspace()
    Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(config.statsXml), statsWs)
    Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(config.standingsXml), standingsWs)
    const standingsConfig = extractStandingsConfig(statsWs, standingsWs)
    statsWs.dispose()
    standingsWs.dispose()

    const teamMap = new Map<string, IStandingsTeam>()
    for (const t of teams)
        teamMap.set(t.id, { name: t.name, code: t.code, pairings: [] })

    const pairingMap = new Map<string, { p: string; d: string; pPts: number; dPts: number }>()
    for (const b of ballots) {
        const existing = pairingMap.get(b.pairing_id)
        if (existing) { existing.pPts += b.p_points; existing.dPts += b.d_points }
        else pairingMap.set(b.pairing_id, { p: b.p_team_id, d: b.d_team_id, pPts: b.p_points, dPts: b.d_points })
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
        rows: computeStandings([...teamMap.values()], standingsConfig),
        cols: parseColumnsFromXml(config.statsXml),
    }
}

export default function StandingsTab({ tournamentId }: { tournamentId: string }) {
    const [payload, setPayload] = useState<StandingsApiPayload | null>(null)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [error, setError] = useState<string | null>(null)

    // Single fetch on mount — all data comes back at once
    useEffect(() => {
        apiFetch(`/api/organizer/tournament/${tournamentId}/standings`)
            .then(r => r.ok ? r.json() : null)
            .then((data: StandingsApiPayload | null) => {
                if (!data) { setError('Failed to load standings.'); return }
                setPayload(data)
                setSelected(new Set(data.rounds.map(r => r.round_id)))
            })
            .catch(() => setError('Failed to load standings.'))
    }, [tournamentId])

    const toggleRound = (roundId: string) =>
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(roundId)) next.delete(roundId)
            else next.add(roundId)
            return next
        })

    const toggleAll = () =>
        setSelected(prev =>
            prev.size === (payload?.rounds.length ?? 0)
                ? new Set()
                : new Set((payload?.rounds ?? []).map(r => r.round_id))
        )

    // Filter ballots client-side and recompute — no extra requests
    const result = useMemo(() => {
        if (!payload?.config || selected.size === 0) return null
        const filtered = payload.ballots.filter(b => selected.has(b.round_id))
        return computeFromBallots(filtered, payload.teams, payload.config)
    }, [payload, selected])

    if (error) return <div className="dash-section"><p className="coach-empty">{error}</p></div>
    if (!payload) return <div className="dash-section"><p className="coach-empty">Loading…</p></div>

    const { rounds } = payload
    const noConfig = !payload.config

    return (
        <div className="dash-section">
            {/* Round filter checkboxes */}
            <div style={{ marginBottom: '1rem' }}>
                <strong style={{ display: 'block', marginBottom: '0.4rem' }}>Filter by round</strong>
                {rounds.length === 0
                    ? <p className="coach-empty">No rounds found.</p>
                    : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                                <input
                                    type="checkbox"
                                    checked={selected.size === rounds.length}
                                    ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < rounds.length }}
                                    onChange={toggleAll}
                                />
                                All
                            </label>
                            {rounds.map(r => (
                                <label key={r.round_id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={selected.has(r.round_id)}
                                        onChange={() => toggleRound(r.round_id)}
                                    />
                                    {r.name}
                                </label>
                            ))}
                        </div>
                    )
                }
            </div>

            {noConfig && (
                <p className="coach-empty">No standings configuration set. Configure one in the Tiebreakers tab.</p>
            )}

            {!noConfig && selected.size === 0 && (
                <p className="coach-empty">Select at least one round to see standings.</p>
            )}

            {!noConfig && selected.size > 0 && result && (
                <>
                    <div className="dash-table-scroll">
                        <table className="dash-standings-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Code</th>
                                    <th>Team</th>
                                    {result.cols.map(c => <th key={c.stat}>{c.label || c.stat}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {result.rows.length === 0 && (
                                    <tr>
                                        <td colSpan={3 + result.cols.length} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                            No ballots submitted yet for the selected rounds.
                                        </td>
                                    </tr>
                                )}
                                {result.rows.map((team, i) => (
                                    <tr key={team.code}>
                                        <td>{i + 1}</td>
                                        <td className="dash-team-code">{team.code}</td>
                                        <td>{team.name}</td>
                                        {result.cols.map(c => {
                                            const val = team[c.stat]
                                            const num = typeof val === 'number' ? val : NaN
                                            return <td key={c.stat}>{isNaN(num) ? '—' : Number.isInteger(num) ? num : num.toFixed(3)}</td>
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <Suspense fallback={null}>
                        <div style={{ marginTop: '1.5rem' }}>
                            <TiebreakerViewer standingsXml={payload.config!.standingsXml} />
                        </div>
                    </Suspense>
                </>
            )}
        </div>
    )
}
