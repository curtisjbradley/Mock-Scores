import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { IRound } from '@mock-scores/shared'
import Section from './Section'
import { ConfirmRemoveModal } from '../components/modals'
import { apiFetch } from '../../auth/auth'

function RoundRow({ round, tournamentId, onRemove, onSave }: {
    round: IRound
    tournamentId: string
    onRemove: (id: string) => void
    onSave: (updated: IRound) => void
}) {
    const navigate = useNavigate()
    const [draftPublish, setDraftPublish] = useState(round.teams_public)
    const [draftResults, setDraftResults] = useState(round.results_public)
    const dirty = draftPublish !== round.teams_public || draftResults !== round.results_public

    return (
        <div className="dash-round-summary">
            <span className="dash-round-label">{round.name}</span>
            {round.round_time && <span className="dash-round-date">{new Date(round.round_time).toLocaleString()}</span>}
            <div className="dash-round-checks">
                <label className="dash-publish-checkbox">
                    <input type="checkbox" checked={draftPublish} onChange={e => setDraftPublish(e.target.checked)} />
                    <span className="dash-publish-label">Publish round</span>
                </label>
                <label className="dash-publish-checkbox">
                    <input type="checkbox" checked={draftResults} onChange={e => setDraftResults(e.target.checked)} />
                    <span className="dash-publish-label">Publish results</span>
                </label>
                {dirty && (
                    <button className="rv-save-btn" onClick={() => onSave({ ...round, teams_public: draftPublish, results_public: draftResults })}>
                        Save
                    </button>
                )}
            </div>
            <button className="dash-open-round-btn" onClick={() => navigate(`/organizer/${tournamentId}/round/${round.round_id}`)}>
                Open →
            </button>
            <button className="dash-remove-btn" onClick={() => onRemove(round.round_id)}>
                Remove
            </button>
        </div>
    )
}

export default function RoundsTab({ tournamentId }: { tournamentId: string }) {
    const [rounds, setRounds] = useState<IRound[]>([])
    const [error, setError] = useState<string | null>(null)
    const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

    useEffect(() => {
        apiFetch(`/api/organizer/tournament/${tournamentId}/rounds`)
            .then(res => {
                if (!res.ok) throw new Error()
                return res.json()
            })
            .then((data: IRound[]) => setRounds(data))
            .catch(() => setError('Failed to load rounds.'))
    }, [tournamentId])

    const handleAdd = () => {
        const nextPos = rounds.length > 0 ? Math.max(...rounds.map(r => r.position)) + 1 : 1
        const newRound: IRound = {
            round_id: '',
            results_public: false,
            teams_public: false,
            position: nextPos,
            name: `Round ${nextPos}`,
            round_time: null,
        }
        apiFetch(`/api/organizer/tournament/${tournamentId}/rounds`, {
            method: 'POST',
            body: JSON.stringify(newRound),
        }).then(res => {
            if (!res.ok) throw new Error()
            return res.json()
        }).then((created: IRound) => {
            setRounds(prev => [...prev, created])
        }).catch(() => setError('Failed to add round.'))
    }

    const handleSave = (updated: IRound) => {
        apiFetch(`/api/organizer/tournament/${tournamentId}/rounds/${updated.round_id}`, {
            method: 'PATCH',
            body: JSON.stringify(updated),
        }).then(res => {
            if (!res.ok) throw new Error()
        }).catch(() => setError('Failed to save round.'))
        setRounds(prev => prev.map(r => r.round_id === updated.round_id ? updated : r))
    }

    const handleRemove = (id: string) => {
        apiFetch(`/api/organizer/tournament/${tournamentId}/rounds/${id}`, { method: 'DELETE' })
            .then(res => { if (!res.ok) throw new Error() })
            .catch(() => setError('Failed to remove round.'))
        setRounds(prev => prev.filter(r => r.round_id !== id))
        setConfirmRemove(null)
    }

    const confirmRound = rounds.find(r => r.round_id === confirmRemove)
    const sorted = [...rounds].sort((a, b) => a.position - b.position)

    return (
        <>
            <Section title="Rounds">
                {error && <p className="org-error">{error}</p>}
                <button className="org-new-btn" onClick={handleAdd}>+ Add round</button>
                {sorted.map(round => (
                    <RoundRow key={round.round_id} round={round} tournamentId={tournamentId}
                        onRemove={id => setConfirmRemove(id)}
                        onSave={handleSave} />
                ))}
            </Section>
            {confirmRemove !== null && (
                <ConfirmRemoveModal
                    message={`Remove ${confirmRound?.name ?? 'this round'} and all its matchups?`}
                    onCancel={() => setConfirmRemove(null)}
                    onConfirm={() => handleRemove(confirmRemove)}
                />
            )}
        </>
    )
}
