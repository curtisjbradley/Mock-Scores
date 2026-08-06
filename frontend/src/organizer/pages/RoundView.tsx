import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import '../styles/organizer.css'
import '../styles/round-view.css'
import '../styles/pairings.css'
import '../../judges/styles/modal.css'
import PairingCard from '../components/PairingCard'
import RoundNameEditor from '../components/RoundNameEditor'
import AddMatchupForm from '../components/AddMatchupForm'
import { ConfirmRemoveModal } from '../components/modals'
import { useConfirmRemove } from '../../shared/hooks/useConfirmRemove'
import { useRoundView } from '../hooks/useRoundView'
import { usePairingForm } from '../hooks/usePairingForm'
import type { IPairing } from '@mock-scores/shared'
import NotFound from '../../error/NotFound'
import { apiFetch } from '../../auth/auth'

/**
 * Displays all pairings for a single round and allows the organizer to
 * add/remove matchups and manage scorer assignments.
 *
 * Sub-components:
 * - {@link RoundNameEditor} — inline editable round name
 * - {@link AddMatchupForm} — team + courtroom selection form
 * - {@link PairingCard} — per-pairing management card
 */
const RoundView = () => {
    const { id, round: roundId } = useParams<{ id: string; round: string }>()
    const navigate = useNavigate()

    const {
        round, teams, courtrooms, pairings, scorers, pairingScorers, ballotStatus, conflictSet,
        error, notFound,
        saveName, addMatchup, updatePairing, removePairing, setPairings,
        onScorerAssigned, onScorerRemoved, onPresiderChanged,
    } = useRoundView(id, roundId)

    const confirmRemove = useConfirmRemove<IPairing>()
    const [sending, setSending] = useState(false)
    const [sendMsg, setSendMsg] = useState<string | null>(null)
    const [generating, setGenerating] = useState(false)
    const [generateMethod, setGenerateMethod] = useState<'power' | 'random'>('power')
    const [generateError, setGenerateError] = useState<string | null>(null)

    const handleSendScoringLinks = () => {
        if (!id || !roundId || sending) return
        setSending(true)
        setSendMsg(null)
        apiFetch(`/api/organizer/tournament/${id}/rounds/${roundId}/send-scoring-links`, { method: 'POST' })
            .then(r => r.ok ? r.json() : null)
            .then((data: { sent: number } | null) => {
                setSendMsg(data ? `Sent ${data.sent} link${data.sent !== 1 ? 's' : ''}` : 'Failed to send')
            })
            .catch(() => setSendMsg('Failed to send'))
            .finally(() => setSending(false))
    }

    const handleGeneratePairings = () => {
        if (!id || !roundId || generating) return
        setGenerating(true)
        setGenerateError(null)
        apiFetch(`/api/organizer/tournament/${id}/rounds/${roundId}/generate-pairings`, {
            method: 'POST',
            body: JSON.stringify({ method: generateMethod }),
        })
            .then(async r => {
                const data = await r.json()
                if (!r.ok) throw new Error(data.message ?? 'Failed to generate pairings')
                return data as IPairing[]
            })
            .then((created) => {
                setPairings(created)
            })
            .catch((e: Error) => setGenerateError(e.message))
            .finally(() => setGenerating(false))
    }

    const {
        showAddForm, addPros, addDef, addCourtroom,
        errors: formErrors, toggleForm, setAddPros, setAddDef,
        setAddCourtroom, reset, submit,
    } = usePairingForm(pairings)

    const handleAddMatchup = () => {
        submit()
        if (!addPros || !addDef || addPros === addDef || !addCourtroom) return
        if (pairings.some(p => p.p_team === addPros) || pairings.some(p => p.d_team === addDef)) return
        addMatchup(addPros, addDef, addCourtroom, reset)
    }

    if (notFound) return <NotFound />

    return (
        <main className="org-main">
            <div className="org-container">
                <button className="org-back-btn" onClick={() => navigate(`/organizer/${id}?page=rounds`)}>
                    ← Back to rounds
                </button>

                {error && <p className="org-error">{error}</p>}

                <div className="rv-header">
                    <div className="rv-title-block">
                        <RoundNameEditor round={round} onSave={saveName} />
                        {round?.round_time && (
                            <div className="rv-meta-row">
                                <span className="rv-meta">{new Date(round.round_time).toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button className="org-new-btn" onClick={handleSendScoringLinks} disabled={sending}>
                            {sending ? 'Sending…' : '✉ Send scoring links'}
                        </button>
                        {sendMsg && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{sendMsg}</span>}
                        <button className="org-new-btn" onClick={toggleForm}>
                            {showAddForm ? 'Cancel' : '+ Add matchup'}
                        </button>
                    </div>
                </div>

                {showAddForm && (
                    <AddMatchupForm
                        teams={teams}
                        courtrooms={courtrooms}
                        addPros={addPros}
                        addDef={addDef}
                        addCourtroom={addCourtroom}
                        prosError={formErrors.prosError}
                        defError={formErrors.defError}
                        courtroomError={formErrors.courtroomError}
                        onProsChange={setAddPros}
                        onDefChange={setAddDef}
                        onCourtroomChange={setAddCourtroom}
                        onSubmit={handleAddMatchup}
                    />
                )}

                <div className="dash-pairings">
                    {pairings.length === 0 && !showAddForm && (
                        <div className="rv-generate-section">
                            <p className="rv-empty">No matchups yet. Add them manually or generate automatically.</p>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                                <select
                                    value={generateMethod}
                                    onChange={e => setGenerateMethod(e.target.value as 'power' | 'random')}
                                    aria-label="Pairing method"
                                    style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border-color, #ccc)' }}
                                >
                                    <option value="power">Power Match</option>
                                    <option value="random">Random</option>
                                </select>
                                <button className="org-new-btn" onClick={handleGeneratePairings} disabled={generating}>
                                    {generating ? 'Generating…' : '⚡ Generate Pairings'}
                                </button>
                            </div>
                            {generateError && <p className="org-error" style={{ marginTop: '0.5rem' }}>{generateError}</p>}
                        </div>
                    )}
                    {pairings.map(pairing => (
                        <PairingCard
                            key={pairing.pairing_id}
                            pairing={pairing}
                            teams={teams}
                            courtrooms={courtrooms}
                            scorers={scorers}
                            assignedScorers={pairingScorers[pairing.pairing_id] ?? []}
                            ballotStatus={ballotStatus[pairing.pairing_id]}
                            tournamentId={id!}
                            roundId={roundId!}
                            conflictSet={conflictSet}
                            onRemove={() => confirmRemove.open(pairing)}
                            onUpdate={updatePairing}
                            onScorerAssigned={s => onScorerAssigned(pairing.pairing_id, s)}
                            onScorerRemoved={assignmentId => onScorerRemoved(pairing.pairing_id, assignmentId)}
                            onPresiderChanged={assignmentId => onPresiderChanged(pairing.pairing_id, assignmentId)}
                        />
                    ))}
                </div>
            </div>

            {confirmRemove.pending && (
                <ConfirmRemoveModal
                    message="Remove this matchup?"
                    onCancel={confirmRemove.clear}
                    onConfirm={() => { removePairing(confirmRemove.pending!); confirmRemove.clear() }}
                />
            )}
        </main>
    )
}

export default RoundView
