import { useNavigate } from 'react-router-dom'
import { fmt, fmtTime } from '../data/utils'
import type { IPairing } from '../data/dummyData'

interface Props {
    tournamentId: string
    rounds: number[]
    pairings: IPairing[]
    roundNames: Record<number, string>
    onRemoveRound: (round: number) => void
}

export default function RoundsTab({ tournamentId, rounds, pairings, roundNames, onRemoveRound }: Props) {
    const navigate = useNavigate()
    return (
        <div className="dash-section">
            <div className="dash-round-cards">
                {rounds.map(round => {
                    const roundPairings = pairings.filter(p => p.round === round)
                    const roundSheets = roundPairings.flatMap(p => p.scoresheets)
                    const roundSubmitted = roundSheets.filter(s => s.status === 'submitted').length
                    const roundMissing = roundSheets.filter(s => s.status === 'missing').length
                    const isPublished = roundPairings.every(p => p.isPublished)
                    const resultsPublished = roundPairings.every(p => p.resultsPublished)
                    const displayName = roundNames[round] ?? `Round ${round}`
                    const pct = roundSheets.length > 0 ? Math.round((roundSubmitted / roundSheets.length) * 100) : 0
                    return (
                        <div key={round} className="dash-round-card-wrapper">
                            <button className="dash-round-card"
                                onClick={() => navigate(`/organizer/${tournamentId}/round/${round}`)}>
                                <div className="dash-round-card-top">
                                    <span className="dash-round-card-name">{displayName}</span>
                                    <div className="dash-round-card-badges">
                                        {isPublished && <span className="dash-round-card-badge dash-round-card-badge--published">Published</span>}
                                        {resultsPublished && <span className="dash-round-card-badge dash-round-card-badge--results">Results live</span>}
                                    </div>
                                </div>
                                <div className="dash-round-card-meta">
                                    <span>{fmt(roundPairings[0].date)}{roundPairings[0].time ? ` · ${fmtTime(roundPairings[0].time)}` : ''}</span>
                                    <span>{roundPairings.length} matchup{roundPairings.length !== 1 ? 's' : ''}</span>
                                </div>
                                <div className="dash-round-card-progress">
                                    <div className="dash-round-card-bar">
                                        <div className="dash-round-card-bar-fill" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="dash-round-card-progress-label">
                                        {roundSubmitted}/{roundSheets.length} submitted
                                        {roundMissing > 0 && <span className="dash-round-card-missing"> · {roundMissing} missing</span>}
                                    </span>
                                </div>
                            </button>
                            <button className="dash-remove-btn dash-round-card-remove" onClick={() => onRemoveRound(round)}>
                                Remove
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
