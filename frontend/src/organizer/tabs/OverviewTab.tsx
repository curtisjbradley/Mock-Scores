import { useNavigate } from 'react-router-dom'
import { fmt, fmtTime } from '../data/utils'
import type { IPairing } from '../data/dummyData'

interface IOverviewProps {
    tournamentId: string
    rounds: number[]
    pairings: IPairing[]
    roundNames: Record<number, string>
    onAddRound: () => void
    onTogglePublish: (round: number, isPublished: boolean) => void
    onToggleResults: (round: number, resultsPublished: boolean) => void
}

export default function OverviewTab({
    tournamentId, rounds, pairings, roundNames,
     onAddRound, onTogglePublish, onToggleResults,
}: IOverviewProps) {
    const navigate = useNavigate()
    return (
        <div className="dash-section">
            <div className="dash-invites-header">
                <h2>Rounds</h2>
                <button className="org-new-btn" onClick={onAddRound}>+ Add round</button>
            </div>
            {rounds.map(round => {
                const rp = pairings.filter(p => p.round === round)
                const rs = rp.flatMap(p => p.scoresheets)
                const rsub = rs.filter(s => s.status === 'submitted').length
                const rmis = rs.filter(s => s.status === 'missing').length
                const isPublished = rp.every(p => p.isPublished)
                const resultsPublished = rp.every(p => p.resultsPublished)
                const displayName = roundNames[round] ?? `Round ${round}`
                return (
                    <div key={round} className="dash-round-summary">
                        <span className="dash-round-label">{displayName}</span>
                        <span className="dash-round-date">
                            {fmt(rp[0].date)}{rp[0].time ? ` · ${fmtTime(rp[0].time)}` : ''}
                        </span>
                        <span className="dash-round-progress">
                            {rsub}/{rs.length} submitted
                            {rmis > 0 && <span className="dash-missing"> · {rmis} missing</span>}
                        </span>
                        <div className="dash-round-checks">
                            <label className="dash-publish-checkbox">
                                <input type="checkbox" checked={isPublished}
                                    onChange={() => onTogglePublish(round, isPublished)} />
                                <span className="dash-publish-label">Publish round</span>
                            </label>
                            <label className="dash-publish-checkbox">
                                <input type="checkbox" checked={resultsPublished}
                                    onChange={() => onToggleResults(round, resultsPublished)} />
                                <span className="dash-publish-label">Publish results</span>
                            </label>
                        </div>
                        <button className="dash-open-round-btn"
                            onClick={() => navigate(`/organizer/${tournamentId}/round/${round}`)}>
                            Open →
                        </button>
                    </div>
                )
            })}
        </div>
    )
}
