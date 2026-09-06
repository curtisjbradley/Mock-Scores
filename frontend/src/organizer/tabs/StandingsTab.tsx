import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import * as Blockly from 'blockly'
import { apiFetch } from '../../auth/auth'
import { computeStandings } from '../blockly/standingsEngine'
import { extractStandingsConfig, parseColumnsFromXml } from '../blockly/standingsGenerator'
import { standingsBlockDefs } from '../blockly/standingsBlocks'
import { tiebreakerBlockDefs } from '../blockly/tiebreakerBlocks'
import type { IStandingsTeam, IIndividualAwardCategory } from '@mock-scores/shared'
import '../styles/standings.css'

interface NominationRow {
    award_category_id: string
    student_id: string
    student_name: string
    team_name: string
    team_code: string
    rank: number
    round_id: string
    side: 'P' | 'D'
}

interface AwardsDetailsPayload {
    nominations: NominationRow[]
    categories: IIndividualAwardCategory[]
}

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

async function downloadCsv(tournamentId: string, type: 'standings' | 'results') {
    if (type === 'results') {
        // Results CSV still uses the backend endpoint (raw ballot data)
        const res = await apiFetch(`/organizer/tournament/${tournamentId}/export/results`)
        if (!res.ok) return
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'results.csv'
        a.click()
        URL.revokeObjectURL(url)
    }
}

function downloadStandingsCsv(
    rows: Record<string, unknown>[],
    cols: { stat: string; label: string }[],
) {
    const header = ['#', 'Code', 'Team', ...cols.map(c => c.label || c.stat)]
    const csvRows = rows.map((team, i) => {
        const vals = cols.map(c => {
            const val = team[c.stat]
            const num = typeof val === 'number' ? val : NaN
            return isNaN(num) ? '' : Number.isInteger(num) ? String(num) : num.toFixed(3)
        })
        return [String(i + 1), escapeCsvField(String(team.code ?? '')), escapeCsvField(String(team.name ?? '')), ...vals]
    })
    const csv = [header.join(','), ...csvRows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'standings.csv'
    a.click()
    URL.revokeObjectURL(url)
}

function escapeCsvField(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
    }
    return value
}

export default function StandingsTab({ tournamentId }: { tournamentId: string }) {
    const [payload, setPayload] = useState<StandingsApiPayload | null>(null)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [error, setError] = useState<string | null>(null)
    const [awardsData, setAwardsData] = useState<AwardsDetailsPayload | null>(null)
    const [sideConstrained, setSideConstrained] = useState(false)

    // Single fetch on mount — all data comes back at once
    useEffect(() => {
        apiFetch(`/organizer/tournament/${tournamentId}/standings`)
            .then(r => r.ok ? r.json() : null)
            .then((data: StandingsApiPayload | null) => {
                if (!data) { setError('Failed to load standings.'); return }
                setPayload(data)
                setSelected(new Set(data.rounds.map(r => r.round_id)))
            })
            .catch(() => setError('Failed to load standings.'))

        apiFetch(`/organizer/tournament/${tournamentId}/awards/details`)
            .then(r => r.ok ? r.json() : null)
            .then((data: AwardsDetailsPayload | null) => setAwardsData(data))
            .catch(() => setAwardsData(null))
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
            <div className="st-section">
                <strong className="st-filter-label">Filter by round</strong>
                {rounds.length === 0
                    ? <p className="coach-empty">No rounds found.</p>
                    : (
                        <div className="st-checkbox-row">
                            <label className="st-checkbox">
                                <input
                                    type="checkbox"
                                    checked={selected.size === rounds.length}
                                    ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < rounds.length }}
                                    onChange={toggleAll}
                                />
                                All
                            </label>
                            {rounds.map(r => (
                                <label key={r.round_id} className="st-checkbox">
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

            {/* Export buttons */}
            {payload.ballots.length > 0 && (
                <div className="st-export-row">
                    <button
                        className="org-new-btn"
                        disabled={!result}
                        onClick={() => result && downloadStandingsCsv(result.rows, result.cols)}
                    >
                        Download Standings CSV
                    </button>
                    <button
                        className="org-new-btn"
                        onClick={() => downloadCsv(tournamentId, 'results')}
                    >
                        Download Results CSV
                    </button>
                </div>
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
                                        <td colSpan={3 + result.cols.length} className="st-empty-cell">
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
                        <div className="st-tiebreaker-wrap">
                            <TiebreakerViewer standingsXml={payload.config!.standingsXml} />
                        </div>
                    </Suspense>
                </>
            )}

            {/* Individual Award Summary */}
            {awardsData && awardsData.nominations.length > 0 && (
                <AwardsSummary
                    data={awardsData}
                    selectedRounds={selected}
                    sideConstrained={sideConstrained}
                    onToggleSideConstrained={() => setSideConstrained(s => !s)}
                />
            )}
        </div>
    )
}

interface AwardsSummaryProps {
    data: AwardsDetailsPayload
    selectedRounds: Set<string>
    sideConstrained: boolean
    onToggleSideConstrained: () => void
}

interface AggregatedNominee {
    student_id: string
    student_name: string
    team_name: string
    team_code: string
    side?: 'P' | 'D'
    average_rank: number
    num_rounds: number
}

function AwardsSummary({ data, selectedRounds, sideConstrained, onToggleSideConstrained }: AwardsSummaryProps) {
    const grouped = useMemo(() => {
        // Filter nominations by selected rounds
        const filtered = data.nominations.filter(n => selectedRounds.has(n.round_id))

        // Group by category, then by student (and optionally by side)
        const catMap = new Map<string, Map<string, { ranks: number[]; info: NominationRow }>>()

        for (const n of filtered) {
            const catKey = n.award_category_id
            const studentKey = sideConstrained ? `${n.student_id}:${n.side}` : n.student_id

            if (!catMap.has(catKey)) catMap.set(catKey, new Map())
            const students = catMap.get(catKey)!

            if (!students.has(studentKey)) {
                students.set(studentKey, { ranks: [], info: n })
            }
            students.get(studentKey)!.ranks.push(n.rank)
        }

        // Build result grouped by category
        const categoryNameMap = new Map(data.categories.map(c => [c.id, c.name]))

        const result: { categoryId: string; categoryName: string; nominees: AggregatedNominee[] }[] = []

        for (const [catId, students] of catMap) {
            const nominees: AggregatedNominee[] = []
            for (const [, { ranks, info }] of students) {
                nominees.push({
                    student_id: info.student_id,
                    student_name: info.student_name,
                    team_name: info.team_name,
                    team_code: info.team_code,
                    side: sideConstrained ? info.side : undefined,
                    average_rank: ranks.reduce((a, b) => a + b, 0) / ranks.length,
                    num_rounds: ranks.length,
                })
            }
            // Sort by num_rounds DESC, then average_rank ASC
            nominees.sort((a, b) => b.num_rounds - a.num_rounds || a.average_rank - b.average_rank)
            result.push({
                categoryId: catId,
                categoryName: categoryNameMap.get(catId) ?? 'Unknown Category',
                nominees,
            })
        }

        // Sort categories alphabetically
        result.sort((a, b) => a.categoryName.localeCompare(b.categoryName))
        return result
    }, [data, selectedRounds, sideConstrained])

    if (grouped.length === 0) return null

    return (
        <div className="st-section st-section--lg">
            <div className="st-awards-header">
                <strong className="st-awards-title">Individual Award Summary</strong>
                <label className="st-checkbox">
                    <input type="checkbox" checked={sideConstrained} onChange={onToggleSideConstrained} />
                    Side constrain awards
                </label>
            </div>

            {grouped.map(cat => (
                <div key={cat.categoryId} className="st-award-group">
                    <strong className="st-award-group-title">
                        {cat.categoryName}
                    </strong>
                    <div className="dash-table-scroll">
                        <table className="dash-standings-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Team</th>
                                    {sideConstrained && <th>Side</th>}
                                    <th>Avg Rank</th>
                                    <th># Rounds</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cat.nominees.map((n, i) => (
                                    <tr key={`${n.student_id}-${n.side ?? ''}-${i}`}>
                                        <td>{n.student_name}</td>
                                        <td>{n.team_name} ({n.team_code})</td>
                                        {sideConstrained && <td>{n.side}</td>}
                                        <td>{n.average_rank.toFixed(2)}</td>
                                        <td>{n.num_rounds}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    )
}
