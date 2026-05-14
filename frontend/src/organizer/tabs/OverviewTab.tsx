import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmt, fmtTime } from '../data/utils'
import type { IPairing } from '../data/dummyData'

interface IOverviewProps {
    tournamentId: string
    rounds: number[]
    pairings: IPairing[]
    roundNames: Record<number, string>
    onAddRound: () => void
    onRemoveRound: (round: number) => void
    onTogglePublish: (round: number, isPublished: boolean) => void
    onToggleResults: (round: number, resultsPublished: boolean) => void
}

function RoundRow({ round, rp, displayName, tournamentId, onRemoveRound, onTogglePublish, onToggleResults, navigate }: {
    round: number
    rp: IPairing[]
    displayName: string
    tournamentId: string
    onRemoveRound: (r: number) => void
    onTogglePublish: (r: number, v: boolean) => void
    onToggleResults: (r: number, v: boolean) => void
    navigate: (path: string) => void
}) {
    const savedPublish = rp.every(p => p.isPublished)
    const savedResults = rp.every(p => p.resultsPublished)
    const [draftPublish, setDraftPublish] = useState(savedPublish)
    const [draftResults, setDraftResults] = useState(savedResults)
    const dirty = draftPublish !== savedPublish || draftResults !== savedResults

    const rs = rp.flatMap(p => p.scoresheets)
    const rsub = rs.filter(s => s.status === 'submitted').length
    const rmis = rs.filter(s => s.status === 'missing').length

    const save = () => {
        if (draftPublish !== savedPublish) onTogglePublish(round, savedPublish)
        if (draftResults !== savedResults) onToggleResults(round, savedResults)
    }

    return (
        <div className="dash-round-summary">
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
                    <input type="checkbox" checked={draftPublish}
                        onChange={e => setDraftPublish(e.target.checked)} />
                    <span className="dash-publish-label">Publish round</span>
                </label>
                <label className="dash-publish-checkbox">
                    <input type="checkbox" checked={draftResults}
                        onChange={e => setDraftResults(e.target.checked)} />
                    <span className="dash-publish-label">Publish results</span>
                </label>
                {dirty && (
                    <button className="rv-save-btn" onClick={save}>Save</button>
                )}
            </div>
            <button className="dash-open-round-btn"
                onClick={() => navigate(`/organizer/${tournamentId}/round/${round}`)}>
                Open →
            </button>
            <button className="dash-remove-btn" onClick={() => onRemoveRound(round)}>
                Remove
            </button>
        </div>
    )
}

export default function OverviewTab({
    tournamentId, rounds, pairings, roundNames,
    onAddRound, onRemoveRound, onTogglePublish, onToggleResults,
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
                const displayName = roundNames[round] ?? `Round ${round}`
                return (
                    <RoundRow key={round} round={round} rp={rp} displayName={displayName}
                        tournamentId={tournamentId} onRemoveRound={onRemoveRound}
                        onTogglePublish={onTogglePublish} onToggleResults={onToggleResults}
                        navigate={navigate} />
                )
            })}
        </div>
    )
}
