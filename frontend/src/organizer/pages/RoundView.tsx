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
import AddButton from '../../shared/components/AddButton'
import StatusChip from '../../shared/components/StatusChip'
import { useRoundView } from '../hooks/useRoundView'
import { usePairingForm } from '../hooks/usePairingForm'
import type { IPairing } from '@mock-scores/shared'
import NotFound from '../../error/NotFound'
import { apiFetch } from '../../auth/auth'
import Tooltip from "../../shared/components/Tooltip"

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
        saveName, addMatchup, updatePairing, removePairing, setRoundLocked,
        setPairingsPublished, setResultsPublished,
        onScorerAssigned, onScorerRemoved, onPresiderChanged,
    } = useRoundView(id, roundId)

    const confirmRemove = useConfirmRemove<IPairing>()
    const [sending, setSending] = useState(false)
    const [sendMsg, setSendMsg] = useState<string | null>(null)
    const [linksSent, setLinksSent] = useState(false)
    const [showLockConfirm, setShowLockConfirm] = useState(false)

    const handleSendScoringLinks = () => {
        if (!id || !roundId || sending || linksSent) return
        setSending(true)
        setSendMsg(null)
        apiFetch(`/organizer/tournament/${id}/rounds/${roundId}/send-scoring-links`, { method: 'POST' })
            .then(r => r.ok ? r.json() : null)
            .then((data: { sent: number } | null) => {
                if (data) {
                    setLinksSent(true) // one-time bulk send — hide the button afterwards
                    setSendMsg(`Sent ${data.sent} link${data.sent !== 1 ? 's' : ''}`)
                } else {
                    setSendMsg('Failed to send')
                }
            })
            .catch(() => setSendMsg('Failed to send'))
            .finally(() => setSending(false))
    }


    const {
        showAddForm, addPros, addDef, addCourtroom,
        errors: formErrors, toggleForm, setAddPros, setAddDef,
        setAddCourtroom, reset, submit,
    } = usePairingForm(pairings)

    const handleAddMatchup = () => {
        submit()
        if (!addPros || !addDef || addPros === addDef) return
        if (pairings.some(p => p.p_team === addPros) || pairings.some(p => p.d_team === addDef)) return
        addMatchup(addPros, addDef, addCourtroom, reset)
    }

    // Courtroom IDs assigned to more than one pairing in this round — flagged as double-booked.
    const duplicateCourtrooms = new Set<string>()
    const seenCourtrooms = new Set<string>()
    for (const p of pairings) {
        if (!p.courtroom) continue
        if (seenCourtrooms.has(p.courtroom)) duplicateCourtrooms.add(p.courtroom)
        else seenCourtrooms.add(p.courtroom)
    }

    // Whether the one-time bulk send has already happened — derived from persisted
    // per-scorer email status so the button stays hidden across reloads/other clients,
    // OR from the local flag set right after a successful send this session.
    const linksAlreadySent = linksSent || Object.values(pairingScorers)
        .some(scorers => scorers.some(s => s.email_status != null))

    // Publishing/locking gates:
    // - a round can only be locked once its pairings are published
    // - scoring links can only be sent once the round is locked
    // - results can only be published once every expected ballot has been submitted
    const ballotStatuses = pairings.map(p => ballotStatus[p.pairing_id]).filter(Boolean)
    const totalScorers = ballotStatuses.reduce((sum, s) => sum + s.total_scorers, 0)
    const submittedScorers = ballotStatuses.reduce((sum, s) => sum + s.submitted, 0)
    const allBallotsIn = pairings.length > 0 && totalScorers > 0 && submittedScorers === totalScorers

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
                    <div className="rv-toolbar">
                        {round?.teams_public
                            ? <Tooltip content={"Coaches can view matchups and start making role assignments."}> <StatusChip label="Pairings published" variant="submitted" /> </Tooltip>
                            : <AddButton
                                disabled={!round || pairings.length === 0}
                                title={pairings.length === 0 ? 'Add at least one pairing before publishing' : 'Publish pairings so teams can see the matchups'}
                                onClick={() => setPairingsPublished(true)}
                              >
                                Publish pairings
                              </AddButton>
                        }

                        {round && (
                            round.locked
                                ? <Tooltip content={"Coaches can no longer make changes to their roster. Scorers can begin to input scores."}> <StatusChip label="Round Locked" variant="submitted" /> </Tooltip>
                                : <AddButton
                                    disabled={!round.teams_public}
                                    title={!round.teams_public
                                        ? 'Publish pairings before locking the round'
                                        : 'Lock the round to open scoring. This is permanent.'}
                                    onClick={() => setShowLockConfirm(true)}
                                  >
                                    Lock round
                                  </AddButton>
                        )}

                        {round?.locked && !linksAlreadySent && (
                            <AddButton
                                onClick={handleSendScoringLinks}
                                disabled={sending}
                                title="Email scoring links to assigned judges. This can only be done once."
                            >
                                {sending ? 'Sending…' : 'Send scoring links'}
                            </AddButton>
                        )}
                        {sendMsg && (
                            <StatusChip
                                label={sendMsg}
                                variant={sendMsg.startsWith('Sent') ? 'submitted' : 'danger'}
                            />
                        )}

                        {round?.results_public
                            ? <StatusChip label="Results published" variant="submitted" />
                            : allBallotsIn && (
                                <AddButton
                                    disabled={!round}
                                    title="Publish results so teams can see scores"
                                    onClick={() => setResultsPublished(true)}
                                >
                                    Publish results
                                </AddButton>
                            )
                        }
                    </div>
                </div>



                <div className="dash-pairings">
                    {pairings.length === 0 && !showAddForm && (
                        <div className="rv-generate-section">
                            <p className="rv-empty">No matchups yet. Add them manually.</p>
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
                            linksSent={linksAlreadySent}
                            tournamentId={id!}
                            roundId={roundId!}
                            round={round}
                            conflictSet={conflictSet}
                            courtroomInUse={!!pairing.courtroom && duplicateCourtrooms.has(pairing.courtroom)}
                            onRemove={() => confirmRemove.open(pairing)}
                            onUpdate={updatePairing}
                            onScorerAssigned={s => onScorerAssigned(pairing.pairing_id, s)}
                            onScorerRemoved={assignmentId => onScorerRemoved(pairing.pairing_id, assignmentId)}
                            onPresiderChanged={(assignmentId, onlyTiebreaker) => onPresiderChanged(pairing.pairing_id, assignmentId, onlyTiebreaker)}
                        />
                    ))}
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
                        onProsChange={setAddPros}
                        onDefChange={setAddDef}
                        onCourtroomChange={setAddCourtroom}
                        onSubmit={handleAddMatchup}
                    />
                )}
                <AddButton onClick={toggleForm}>
                    {showAddForm ? 'Cancel' : '+ Add Pairing'}
                </AddButton>

            </div>

            {confirmRemove.pending && (
                <ConfirmRemoveModal
                    message="Remove this pairing?"
                    onCancel={confirmRemove.clear}
                    onConfirm={() => { removePairing(confirmRemove.pending!); confirmRemove.clear() }}
                />
            )}

            {showLockConfirm && (
                <ConfirmRemoveModal
                    message="Locking opens scoring for this round and is permanent — the round cannot be unlocked. Coaches can no longer edit call orders or role assignments, and any team that left theirs unset will inherit its saved defaults."
                    confirmLabel="Lock round"
                    onCancel={() => setShowLockConfirm(false)}
                    onConfirm={() => { setRoundLocked(true); setShowLockConfirm(false) }}
                />
            )}


        </main>
    )
}

export default RoundView
