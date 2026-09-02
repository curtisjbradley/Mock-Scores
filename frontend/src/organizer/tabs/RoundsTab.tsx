import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { IBallotStatus, IRound } from '@mock-scores/shared'
import Section from './Section'
import { ConfirmRemoveModal } from '../components/modals'
import { useConfirmRemove } from '../../shared/hooks/useConfirmRemove'
import DangerButton from '../../shared/components/DangerButton'
import AddButton from '../../shared/components/AddButton'
import { apiFetch } from '../../auth/auth'
import '../styles/rounds.css'

function RoundRow({ round, tournamentId, ballotSummary, onRemove, onSave }: {
    round: IRound
    tournamentId: string
    ballotSummary: { total: number; submitted: number } | null
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
    const dirty = draftName !== round.name || tbd !== !round.round_time ||
        (!tbd && draftTime !== toLocalInput(round.round_time))

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
                {round.teams_public
                    ? <span className="dash-publish-label dash-publish-label--active">✓ Pairings published</span>
                    : <button className="dash-round-save-btn" onClick={() => onSave({ ...round, name: draftName, round_time: tbd ? null : (draftTime ? new Date(draftTime).toISOString() : null), teams_public: true, results_public: round.results_public })}>
                        Publish pairings
                      </button>
                }
                {round.results_public
                    ? <span className="dash-publish-label dash-publish-label--active">✓ Results published</span>
                    : <button className="dash-round-save-btn" onClick={() => onSave({ ...round, name: draftName, round_time: tbd ? null : (draftTime ? new Date(draftTime).toISOString() : null), teams_public: round.teams_public, results_public: true })}>
                        Publish results
                      </button>
                }
                {dirty && (
                    <button className="dash-round-save-btn" onClick={() => onSave({ ...round, name: draftName, round_time: tbd ? null : (draftTime ? new Date(draftTime).toISOString() : null), teams_public: round.teams_public, results_public: round.results_public })}>
                        Save
                    </button>
                )}
            </div>
            <button className="dash-open-round-btn" onClick={() => navigate(`/organizer/${tournamentId}/round/${round.round_id}`)}>
                Open →
            </button>
            {ballotSummary && ballotSummary.total > 0 && (
                <span className={`pc-ballot-status ${
                    ballotSummary.submitted === ballotSummary.total
                        ? 'pc-ballot-status--complete'
                        : ballotSummary.submitted > 0
                            ? 'pc-ballot-status--partial'
                            : 'pc-ballot-status--none'
                }`}>
                    {ballotSummary.submitted}/{ballotSummary.total} ballots
                </span>
            )}
            <DangerButton onClick={() => onRemove(round.round_id)}>
                Remove
            </DangerButton>
        </div>
    )
}

export default function RoundsTab({ tournamentId }: { tournamentId: string }) {
    const [rounds, setRounds] = useState<IRound[]>([])
    const [error, setError] = useState<string | null>(null)
    const [ballotStatusByRound, setBallotStatusByRound] = useState<Record<string, { total: number; submitted: number }>>({})
    const confirmRemove = useConfirmRemove<string>()

    useEffect(() => {
        apiFetch(`/organizer/tournament/${tournamentId}/rounds`)
            .then(res => {
                if (!res.ok) throw new Error()
                return res.json()
            })
            .then((data: IRound[]) => {
                setRounds(data)
                // Fetch ballot status for each round
                Promise.all(data.map(r =>
                    apiFetch(`/organizer/tournament/${tournamentId}/rounds/${r.round_id}/ballot-status`)
                        .then(res => res.ok ? res.json() : [])
                        .then((statuses: IBallotStatus[]) => ({
                            roundId: r.round_id,
                            total: statuses.reduce((sum, s) => sum + s.total_scorers, 0),
                            submitted: statuses.reduce((sum, s) => sum + s.submitted, 0),
                        }))
                )).then(results => {
                    const map: Record<string, { total: number; submitted: number }> = {}
                    for (const r of results) map[r.roundId] = { total: r.total, submitted: r.submitted }
                    setBallotStatusByRound(map)
                })
            })
            .catch(() => setError('Failed to load rounds.'))
    }, [tournamentId])

    const handleAdd = () => {

        apiFetch(`/organizer/tournament/${tournamentId}/rounds`, {
            method: 'POST'
        }).then(res => {
            if (!res.ok) throw new Error()
            return res.json()
        }).then((created: IRound) => {
            setRounds(prev => [...prev, created])
        }).catch(() => setError('Failed to add round.'))
    }

    const handleSave = (updated: IRound) => {
        apiFetch(`/organizer/tournament/${tournamentId}/rounds/${updated.round_id}`, {
            method: 'PATCH',
            body: JSON.stringify(updated),
        }).then(res => {
            if (!res.ok) throw new Error()
        }).catch(() => setError('Failed to save round.'))
        setRounds(prev => prev.map(r => r.round_id === updated.round_id ? updated : r))
    }

    const handleRemove = (id: string) => {
        apiFetch(`/organizer/tournament/${tournamentId}/rounds/${id}`, { method: 'DELETE' })
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
                <AddButton onClick={handleAdd}>+ Add round</AddButton>
                {sorted.map(round => (
                    <RoundRow key={round.round_id} round={round} tournamentId={tournamentId}
                        ballotSummary={ballotStatusByRound[round.round_id] ?? null}
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
