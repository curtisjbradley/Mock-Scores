import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import '../styles/organizer.css'
import '../styles/round-view.css'
import '../styles/pairings.css'
import PairingCard from '../components/PairingCard'
import { ConfirmRemoveModal } from '../components/modals'
import { useConfirmRemove } from '../../shared/hooks/useConfirmRemove'
import { useRoundView } from '../hooks/useRoundView'
import type { IPairing } from '@mock-scores/shared'
import NotFound from '../../error/NotFound'

const RoundView = () => {
    const { id, round: roundId } = useParams<{ id: string; round: string }>()
    const navigate = useNavigate()
    const {
        round, teams, courtrooms, pairings, scorers, pairingScorers, conflictSet,
        error, notFound,
        saveName, addMatchup, updatePairing, removePairing,
        onScorerAssigned, onScorerRemoved, onPresiderChanged,
    } = useRoundView(id, roundId)

    const [editingName, setEditingName] = useState(false)
    const [nameValue, setNameValue] = useState('')

    const [showAddForm, setShowAddForm] = useState(false)
    const [addPros, setAddPros] = useState('')
    const [addDef, setAddDef] = useState('')
    const [addCourtroom, setAddCourtroom] = useState('')
    const [addSubmitted, setAddSubmitted] = useState(false)
    const confirmRemove = useConfirmRemove<IPairing>()

    const prosAlreadyPros = addSubmitted && addPros && pairings.some(p => p.p_team === addPros)
    const defAlreadyDef = addSubmitted && addDef && pairings.some(p => p.d_team === addDef)
    const addProsError = addSubmitted && !addPros ? 'Select prosecution team' : prosAlreadyPros ? 'Team already prosecuting this round' : ''
    const addDefError = addSubmitted && !addDef ? 'Select defense team'
        : addSubmitted && addDef === addPros ? 'Must differ from prosecution'
        : defAlreadyDef ? 'Team already defending this round' : ''
    const addCourtroomError = addSubmitted && !addCourtroom ? 'Select a courtroom' : ''

    const handleAddMatchup = () => {
        setAddSubmitted(true)
        if (!addPros || !addDef || addPros === addDef || !addCourtroom) return
        if (pairings.some(p => p.p_team === addPros) || pairings.some(p => p.d_team === addDef)) return
        addMatchup(addPros, addDef, addCourtroom, () => {
            setAddPros(''); setAddDef(''); setAddCourtroom(''); setAddSubmitted(false); setShowAddForm(false)
        })
    }

    if (notFound) return <NotFound />

    return (
        <main className="org-main">
            <div className="org-container">
                <button className="org-back-btn" onClick={() => navigate(`/organizer/${id}?page=rounds`)}>← Back to rounds</button>
                {error && <p className="org-error">{error}</p>}

                <div className="rv-header">
                    <div className="rv-title-block">
                        {editingName ? (
                            <form onSubmit={e => { e.preventDefault(); saveName(nameValue); setEditingName(false) }}>
                                <input autoFocus className="rv-name-input"
                                    value={nameValue} onChange={e => setNameValue(e.target.value)}
                                    onBlur={() => { saveName(nameValue); setEditingName(false) }}
                                    onKeyDown={e => e.key === 'Escape' && setEditingName(false)} />
                            </form>
                        ) : (
                            <button className="rv-name-btn" onClick={() => { setNameValue(round?.name ?? ''); setEditingName(true) }}>
                                {round?.name ?? '…'} <span className="rv-edit-icon">✎</span>
                            </button>
                        )}
                        {round?.round_time && (
                            <div className="rv-meta-row">
                                <span className="rv-meta">{new Date(round.round_time).toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                    <button className="org-new-btn" onClick={() => { setShowAddForm(v => !v); setAddSubmitted(false) }}>
                        {showAddForm ? 'Cancel' : '+ Add matchup'}
                    </button>
                </div>

                {showAddForm && (
                    <div className="rv-add-form">
                        <h2 className="rv-add-form-title">New matchup</h2>
                        <div className="rv-add-form-fields">
                            {([
                                { label: 'Prosecution', value: addPros, onChange: setAddPros, error: addProsError },
                                { label: 'Defense',     value: addDef,  onChange: setAddDef,  error: addDefError },
                            ] as const).map(f => (
                                <div key={f.label} className="rv-field-group">
                                    <label className="rv-field-label">
                                        {f.label}
                                        <select className={`rv-select${f.error ? ' rv-select-invalid' : ''}`}
                                            value={f.value} onChange={e => f.onChange(e.target.value)}>
                                            <option value="">Select team…</option>
                                            {teams.map(t => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
                                        </select>
                                    </label>
                                    {f.error && <span className="rv-field-error">{f.error}</span>}
                                </div>
                            ))}
                            <div className="rv-field-group">
                                <label className="rv-field-label">
                                    Courtroom
                                    <select className={`rv-select${addCourtroomError ? ' rv-select-invalid' : ''}`}
                                        value={addCourtroom} onChange={e => setAddCourtroom(e.target.value)}>
                                        <option value="">Select courtroom…</option>
                                        {courtrooms.map(c => <option key={c.id} value={c.id}>{c.name}{c.location ? ` (${c.location})` : ''}</option>)}
                                    </select>
                                </label>
                                {addCourtroomError && <span className="rv-field-error">{addCourtroomError}</span>}
                            </div>
                        </div>
                        <div className="rv-add-form-actions">
                            <button className="org-new-btn" onClick={handleAddMatchup}>Add matchup</button>
                        </div>
                    </div>
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
