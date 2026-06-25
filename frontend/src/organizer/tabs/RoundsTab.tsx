import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { IRound } from '@mock-scores/shared'
import Section from './Section'
import { ConfirmRemoveModal } from '../components/modals'
import { useConfirmRemove } from '../../shared/hooks/useConfirmRemove'
import { apiFetch } from '../../auth/auth'
import '../styles/rounds.css'

function RoundRow({ round, tournamentId, onRemove, onSave }: {
    round: IRound
    tournamentId: string
    onRemove: (id: string) => void
    onSave: (updated: IRound) => void
}) {
    const navigate = useNavigate()
    // Convert a UTC ISO string to the "YYYY-MM-DDTHH:MM" local time string datetime-local expects
    const toLocalInput = (iso: string | null) => {
        if (!iso) return ''
        const d = new Date(iso)
        const pad = (n: number) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
    const [draftName, setDraftName] = useState(round.name)
    const [draftTime, setDraftTime] = useState(() => toLocalInput(round.round_time))
    const [tbd, setTbd] = useState(!round.round_time)
    const [draftPublish, setDraftPublish] = useState(round.teams_public)
    const [draftResults, setDraftResults] = useState(round.results_public)
    const dirty = draftName !== round.name || tbd !== !round.round_time ||
        (!tbd && draftTime !== toLocalInput(round.round_time)) ||
        draftPublish !== round.teams_public || draftResults !== round.results_public

    return (
        <div className="dash-round-summary">
            <input
                className="dash-round-name-input"
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                placeholder="Round name"
            />
            <input
                type="datetime-local"
                className="dash-round-time-input"
                value={tbd ? '' : draftTime}
                disabled={tbd}
                onChange={e => setDraftTime(e.target.value)}
            />
            <label className="dash-publish-checkbox">
                <input type="checkbox" checked={tbd} onChange={e => setTbd(e.target.checked)} />
                <span className="dash-publish-label">TBD</span>
            </label>
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
                    <button className="dash-round-save-btn" onClick={() => onSave({ ...round, name: draftName, round_time: tbd ? null : (draftTime ? new Date(draftTime).toISOString() : null), teams_public: draftPublish, results_public: draftResults })}>
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
    const confirmRemove = useConfirmRemove<string>()

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

        apiFetch(`/api/organizer/tournament/${tournamentId}/rounds`, {
            method: 'POST'
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
        confirmRemove.clear()
    }

    const confirmRound = rounds.find(r => r.round_id === confirmRemove.pending)
    const sorted = [...rounds].sort((a, b) => a.position - b.position)

    return (
        <>
            <Section title="Rounds">
                {error && <p className="org-error">{error}</p>}
                <button className="org-new-btn" onClick={handleAdd}>+ Add round</button>
                {sorted.map(round => (
                    <RoundRow key={round.round_id} round={round} tournamentId={tournamentId}
                        onRemove={id => confirmRemove.open(id)}
                        onSave={handleSave} />
                ))}
            </Section>
            {confirmRemove.pending !== null && (
                <ConfirmRemoveModal
                    message={`Remove ${confirmRound?.name ?? 'this round'} and all its matchups?`}
                    onCancel={confirmRemove.clear}
                    onConfirm={() => handleRemove(confirmRemove.pending!)}
                />
            )}
        </>
    )
}
