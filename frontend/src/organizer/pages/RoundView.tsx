import { useNavigate, useParams } from 'react-router-dom'
import '../styles/organizer.css'
import '../styles/round-view.css'
import '../styles/pairings.css'
import PairingCard from '../components/PairingCard'
import RoundNameEditor from '../components/RoundNameEditor'
import AddMatchupForm from '../components/AddMatchupForm'
import { ConfirmRemoveModal } from '../components/modals'
import { useConfirmRemove } from '../../shared/hooks/useConfirmRemove'
import { useRoundView } from '../hooks/useRoundView'
import { usePairingForm } from '../hooks/usePairingForm'
import type { IPairing } from '@mock-scores/shared'
import NotFound from '../../error/NotFound'

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
        round, teams, courtrooms, pairings, scorers, pairingScorers, conflictSet,
        error, notFound,
        saveName, addMatchup, updatePairing, removePairing,
        onScorerAssigned, onScorerRemoved, onPresiderChanged,
    } = useRoundView(id, roundId)

    const confirmRemove = useConfirmRemove<IPairing>()

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
                    <button className="org-new-btn" onClick={toggleForm}>
                        {showAddForm ? 'Cancel' : '+ Add matchup'}
                    </button>
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
                        <p className="rv-empty">No matchups yet. Click "+ Add matchup" to get started.</p>
                    )}
                    {pairings.map(pairing => (
                        <PairingCard
                            key={pairing.pairing_id}
                            pairing={pairing}
                            teams={teams}
                            courtrooms={courtrooms}
                            scorers={scorers}
                            assignedScorers={pairingScorers[pairing.pairing_id] ?? []}
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
