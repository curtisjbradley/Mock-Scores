import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../auth/auth'
import { computeStandings } from '../blockly/standingsEngine'
import { parseDsl } from '../blockly/standingsDsl'
import type { IAwardNomination, IStandingsTeam } from '@mock-scores/shared'
import AddButton from '../../shared/components/AddButton'
import '../styles/standings.css'

const TiebreakerViewer = lazy(() => import('../blockly/TiebreakerViewer'))

interface Round {
    round_id: string
    name: string
}

interface Ballot {
    p_team_id: string
    d_team_id: string
    p_points: number
    d_points: number
    pairing_id: string
    round_id: string
    tiebreaker: string | null
    presider_ballot: boolean
}

interface StandingsApiPayload {
    config: { dsl: string } | null
    teams: { id: string; name: string; code: string }[]
    ballots: Ballot[]
    rounds: Round[]
}

interface AwardsSummaryProps {
    data: IAwardNomination[]
    selectedRounds: Set<string>
}

interface AwardCategoryGroup {
    categoryId: string
    categoryName: string
    nominations: IAwardNomination[]
}

function computeFromBallots(
    ballots: Ballot[],
    teams: { id: string; name: string; code: string }[],
    config: { dsl: string },
) {
    const standingsConfig = parseDsl(config.dsl)

    const teamMap = new Map<string, IStandingsTeam>()
    for (const t of teams) {
        teamMap.set(t.id, {
            name: t.name,
            code: t.code,
            pairings: [],
        })
    }

    const pairingMap = new Map<
        string,
        {
            p: string
            d: string
            pPts: number
            dPts: number
            tiebreakerWinner: string | null
            scorers: number
        }
    >()

    for (const b of ballots) {
        const existing = pairingMap.get(b.pairing_id)

        if (existing) {
            existing.pPts += b.p_points
            existing.dPts += b.d_points
            existing.scorers += 1

            // The presider ballot carries the pairing's tiebreaker (winning team id).
            if (b.presider_ballot && b.tiebreaker) {
                existing.tiebreakerWinner = b.tiebreaker
            }
        } else {
            pairingMap.set(b.pairing_id, {
                p: b.p_team_id,
                d: b.d_team_id,
                pPts: b.p_points,
                dPts: b.d_points,
                tiebreakerWinner: b.presider_ballot ? b.tiebreaker : null,
                scorers: 1,
            })
        }
    }

    for (const [, { p, d, pPts, dPts, tiebreakerWinner, scorers }] of pairingMap) {
        const pTeam = teamMap.get(p)
        const dTeam = teamMap.get(d)

        if (pTeam && dTeam) {
            pTeam.pairings.push({
                opponent: dTeam.code,
                ballots: [{ pointsFor: pPts, pointsAgainst: dPts }],
                won_presider_tiebreaker: tiebreakerWinner === p,
                num_scorers: scorers,
            })

            dTeam.pairings.push({
                opponent: pTeam.code,
                ballots: [{ pointsFor: dPts, pointsAgainst: pPts }],
                won_presider_tiebreaker: tiebreakerWinner === d,
                num_scorers: scorers,
            })
        }
    }

    return {
        rows: computeStandings([...teamMap.values()], standingsConfig),
        cols: standingsConfig.columns,
    }
}

async function downloadCsv(tournamentId: string, type: 'standings' | 'results') {
    if (type !== 'results') return

    // Results CSV still uses the backend endpoint (raw ballot data).
    const res = await apiFetch(`/organizer/tournament/${tournamentId}/export/results`)
    if (!res.ok) return

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = 'results.csv'
    link.click()

    URL.revokeObjectURL(url)
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

            if (isNaN(num)) return ''
            return Number.isInteger(num) ? String(num) : num.toFixed(3)
        })

        return [
            String(i + 1),
            escapeCsvField(String(team.code ?? '')),
            escapeCsvField(String(team.name ?? '')),
            ...vals,
        ]
    })

    const csv = [header.join(','), ...csvRows.map(row => row.join(','))].join('\n')
    downloadTextCsv(csv, 'standings.csv')
}

function downloadAwardsCsv(nominations: IAwardNomination[]) {
    const sorted = [...nominations].sort((a, b) => {
        const categoryCompare = a.award_name.localeCompare(b.award_name, undefined, {
            numeric: true,
            sensitivity: 'base',
        })
        if (categoryCompare !== 0) return categoryCompare

        const roundCompare = a.round_name.localeCompare(b.round_name, undefined, {
            numeric: true,
            sensitivity: 'base',
        })
        if (roundCompare !== 0) return roundCompare

        if (a.rank !== b.rank) return a.rank - b.rank

        const teamCompare = a.team_code.localeCompare(b.team_code)
        if (teamCompare !== 0) return teamCompare

        return a.student_name.localeCompare(b.student_name)
    })

    const header = [
        'Round',
        'Category',
        'Name',
        'Team',
        'Team Code',
        'Side',
        'Rank',
        'Scorer',
    ]

    const rows = sorted.map(nomination => [
        nomination.round_name,
        nomination.award_name,
        nomination.student_name,
        nomination.team_name,
        nomination.team_code,
        formatSide(nomination.side),
        String(nomination.rank),
        nomination.scorer_name,
    ])

    const csv = [header, ...rows]
        .map(row => row.map(value => escapeCsvField(String(value ?? ''))).join(','))
        .join('\n')

    // BOM helps Excel recognize UTF-8 correctly.
    downloadTextCsv(`\uFEFF${csv}`, 'award-nominations.csv')
}

function downloadTextCsv(csv: string, filename: string) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = filename

    document.body.appendChild(link)
    link.click()
    link.remove()

    URL.revokeObjectURL(url)
}

function escapeCsvField(value: string): string {
    if (
        value.includes(',') ||
        value.includes('"') ||
        value.includes('\n') ||
        value.includes('\r')
    ) {
        return `"${value.replace(/"/g, '""')}"`
    }

    return value
}

export default function StandingsTab({ tournamentId }: { tournamentId: string }) {
    const [payload, setPayload] = useState<StandingsApiPayload | null>(null)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [error, setError] = useState<string | null>(null)
    const [awardsData, setAwardsData] = useState<IAwardNomination[]>([])

    useEffect(() => {
        apiFetch(`/organizer/tournament/${tournamentId}/standings`)
            .then(r => (r.ok ? r.json() : null))
            .then((data: StandingsApiPayload | null) => {
                if (!data) {
                    setError('Failed to load standings.')
                    return
                }

                setPayload(data)
                setSelected(new Set(data.rounds.map(r => r.round_id)))
            })
            .catch(() => setError('Failed to load standings.'))

        apiFetch(`/organizer/tournament/${tournamentId}/awards`)
            .then(r => (r.ok ? r.json() : null))
            .then((data: unknown) => {
                setAwardsData(Array.isArray(data) ? data as IAwardNomination[] : [])
            })
            .catch(() => setAwardsData([]))
    }, [tournamentId])

    const toggleRound = (roundId: string) => {
        setSelected(prev => {
            const next = new Set(prev)

            if (next.has(roundId)) next.delete(roundId)
            else next.add(roundId)

            return next
        })
    }

    const toggleAll = () => {
        setSelected(prev =>
            prev.size === (payload?.rounds.length ?? 0)
                ? new Set()
                : new Set((payload?.rounds ?? []).map(r => r.round_id)),
        )
    }

    // Filter ballots client-side and recompute -- no extra requests.
    const result = useMemo(() => {
        if (!payload?.config || selected.size === 0) return null

        const filtered = payload.ballots.filter(b => selected.has(b.round_id))
        return computeFromBallots(filtered, payload.teams, payload.config)
    }, [payload, selected])

    if (error) {
        return (
            <div className="dash-section">
                <p className="coach-empty">{error}</p>
            </div>
        )
    }

    if (!payload) {
        return (
            <div className="dash-section">
                <p className="coach-empty">Loading...</p>
            </div>
        )
    }

    const { rounds } = payload
    const noConfig = !payload.config

    return (
        <div className="dash-section">
            {/* Round filter checkboxes */}
            <div className="st-section">
                <strong className="st-filter-label">Filter by round</strong>

                {rounds.length === 0 ? (
                    <p className="coach-empty">No rounds found.</p>
                ) : (
                    <div className="st-checkbox-row">
                        <label className="st-checkbox">
                            <input
                                type="checkbox"
                                checked={selected.size === rounds.length}
                                ref={el => {
                                    if (el) {
                                        el.indeterminate =
                                            selected.size > 0 && selected.size < rounds.length
                                    }
                                }}
                                onChange={toggleAll}
                            />
                            All
                        </label>

                        {rounds.map(round => (
                            <label key={round.round_id} className="st-checkbox">
                                <input
                                    type="checkbox"
                                    checked={selected.has(round.round_id)}
                                    onChange={() => toggleRound(round.round_id)}
                                />
                                {round.name}
                            </label>
                        ))}
                    </div>
                )}
            </div>

            {noConfig && (
                <p className="coach-empty">
                    No standings configuration set. Configure one in the Tiebreakers tab.
                </p>
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
                        onClick={() => void downloadCsv(tournamentId, 'results')}
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
                                {result.cols.map(c => (
                                    <th key={c.stat}>{c.label || c.stat}</th>
                                ))}
                            </tr>
                            </thead>

                            <tbody>
                            {result.rows.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={3 + result.cols.length}
                                        className="st-empty-cell"
                                    >
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

                                        return (
                                            <td key={c.stat}>
                                                {isNaN(num)
                                                    ? '-'
                                                    : Number.isInteger(num)
                                                        ? num
                                                        : num.toFixed(3)}
                                            </td>
                                        )
                                    })}
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>

                    <Suspense fallback={null}>
                        <div className="st-tiebreaker-wrap">
                            <TiebreakerViewer dsl={payload.config?.dsl ?? ""} />
                        </div>
                    </Suspense>
                </>
            )}

            {/* Individual award nominations */}
            {awardsData.length > 0 && (
                <AwardsSummary data={awardsData} selectedRounds={selected} />
            )}
        </div>
    )
}

function AwardsSummary({ data, selectedRounds }: AwardsSummaryProps) {
    const safeData = Array.isArray(data) ? data : []

    const filteredNominations = useMemo(() => {
        if (!(selectedRounds instanceof Set)) return []

        return safeData.filter((nomination): nomination is IAwardNomination => {
            if (!nomination || typeof nomination !== 'object') return false
            if (typeof nomination.round_id !== 'string') return false
            return selectedRounds.has(nomination.round_id)
        })
    }, [safeData, selectedRounds])

    const grouped = useMemo<AwardCategoryGroup[]>(() => {
        const categoryMap = new Map<string, IAwardNomination[]>()

        for (const nomination of filteredNominations) {
            const existing = categoryMap.get(nomination.award_category_id)

            if (existing) {
                existing.push(nomination)
            } else {
                categoryMap.set(nomination.award_category_id, [nomination])
            }
        }

        const groups: AwardCategoryGroup[] = []

        for (const [categoryId, nominations] of categoryMap) {
            const sorted = [...nominations].sort((a, b) => {
                const roundCompare = a.round_name.localeCompare(b.round_name, undefined, {
                    numeric: true,
                    sensitivity: 'base',
                })
                if (roundCompare !== 0) return roundCompare

                if (a.rank !== b.rank) return a.rank - b.rank

                const teamCompare = a.team_code.localeCompare(b.team_code)
                if (teamCompare !== 0) return teamCompare

                return a.student_name.localeCompare(b.student_name)
            })

            groups.push({
                categoryId,
                categoryName: nominations[0]?.award_name ?? 'Unknown Category',
                nominations: sorted,
            })
        }

        groups.sort((a, b) =>
            a.categoryName.localeCompare(b.categoryName, undefined, {
                numeric: true,
                sensitivity: 'base',
            }),
        )

        return groups
    }, [filteredNominations])

    if (grouped.length === 0) return null

    return (
        <div className="st-section st-section--lg">
            <div className="st-awards-header">
                <strong className="st-awards-title">Individual Award Nominations</strong>

                <AddButton onClick={() => downloadAwardsCsv(filteredNominations)}>
                    Export Awards CSV
                </AddButton>
            </div>

            {grouped.map(category => (
                <div key={category.categoryId} className="st-award-group">
                    <strong className="st-award-group-title">{category.categoryName}</strong>

                    <div className="dash-table-scroll">
                        <table className="dash-standings-table">
                            <thead>
                            <tr>
                                <th>Round</th>
                                <th>Category</th>
                                <th>Name</th>
                                <th>Team</th>
                                <th>Side</th>
                                <th>Rank</th>
                                <th>Scorer</th>
                            </tr>
                            </thead>

                            <tbody>
                            {category.nominations.map((nomination, index) => (
                                <tr
                                    key={[
                                        nomination.round_id,
                                        nomination.award_category_id,
                                        nomination.student_id,
                                        nomination.scorer_id,
                                        nomination.side,
                                        nomination.rank,
                                        index,
                                    ].join('-')}
                                >
                                    <td>{nomination.round_name}</td>
                                    <td>{nomination.award_name}</td>
                                    <td>{nomination.student_name}</td>
                                    <td>
                                        {formatTeam(
                                            nomination.team_name,
                                            nomination.team_code,
                                        )}
                                    </td>
                                    <td>{formatSide(nomination.side)}</td>
                                    <td>{nomination.rank}</td>
                                    <td>{nomination.scorer_name}</td>
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

function formatTeam(name: string, code: string): string {
    if (name && code) return `${name} (${code})`
    return name || code || '-'
}

function formatSide(side: IAwardNomination['side']): string {
    return side === 'P' ? 'Prosecution' : 'Defense'
}
