import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import '../styles/organizer.css'
import '../styles/round-view.css'
import '../styles/pairings.css'
// TODO: fetch round pairings from GET /api/tournaments/:id/rounds/:round/pairings (replace dummyPairings)
// TODO: fetch teams from GET /api/tournaments/:id/teams (replace dummyTeams)
// TODO: fetch courtrooms from GET /api/tournaments/:id/courtrooms (replace dummyCourtrooms)
import { dummyTournaments, dummyPairings, dummyTeams, dummyCourtrooms, type IPairing } from '../data/dummyData'
import { fmt, fmtTime } from '../data/utils'
import PairingCard from '../components/PairingCard'
import { ConfirmRemoveModal } from '../components/modals'

const initDate = (id: string | undefined, round: number) =>
    dummyPairings.find(p => p.tournamentId === id && p.round === round)?.date ?? ''
const initTime = (id: string | undefined, round: number) =>
    dummyPairings.find(p => p.tournamentId === id && p.round === round)?.time ?? ''

const RoundView = () => {
    const { id, round: roundParam } = useParams<{ id: string; round: string }>()
    const navigate = useNavigate()
    const round = Number(roundParam)

    const tournament = dummyTournaments.find(t => t.id === id)
    const teams = dummyTeams.filter(t => t.tournamentId === id)
    const courtrooms = dummyCourtrooms.filter(c => c.tournamentId === id)

    const [pairings, setPairings] = useState<IPairing[]>(() =>
        dummyPairings.filter(p => p.tournamentId === id && p.round === round)
    )

    // Round details
    const [roundName, setRoundName] = useState(`Round ${round}`)
    const [editingName, setEditingName] = useState(false)
    const [nameValue, setNameValue] = useState('')
    const [roundDate, setRoundDate] = useState(() => initDate(id, round))
    const [roundTime, setRoundTime] = useState(() => initTime(id, round))
    const [editingDate, setEditingDate] = useState(false)
    const [editingTime, setEditingTime] = useState(false)
    const [savedDetails, setSavedDetails] = useState({
        name: `Round ${round}`,
        date: initDate(id, round),
        time: initTime(id, round),
    })
    const [detailsSubmitted, setDetailsSubmitted] = useState(false)

    const detailsDirty = roundName !== savedDetails.name || roundDate !== savedDetails.date || roundTime !== savedDetails.time
    const nameError = detailsSubmitted && !roundName.trim() ? 'Name is required' : ''
    const dateError = detailsSubmitted && !roundDate ? 'Date is required' : ''
    const timeError = detailsSubmitted && !roundTime ? 'Time is required' : ''
    const detailsValid = !!roundName.trim() && !!roundDate && !!roundTime

    const saveDetails = () => {
        setDetailsSubmitted(true)
        if (!detailsValid) return
        // TODO: PATCH /api/tournaments/:id/rounds/:round { name, date, time }
        setSavedDetails({ name: roundName, date: roundDate, time: roundTime })
        setDetailsSubmitted(false)
    }

    const saveName = (val: string) => { setRoundName(val.trim() || savedDetails.name); setEditingName(false) }

    // Add matchup form
    const [showAddForm, setShowAddForm] = useState(false)
    const [addPros, setAddPros] = useState('')
    const [addDef, setAddDef] = useState('')
    const [addCourtroom, setAddCourtroom] = useState(courtrooms[0]?.name ?? '')
    const [addSubmitted, setAddSubmitted] = useState(false)

    const addProsError = addSubmitted && !addPros ? 'Select prosecution team' : ''
    const addDefError = addSubmitted && !addDef ? 'Select defense team' : addSubmitted && addDef === addPros ? 'Must differ from prosecution' : ''
    const addCourtroomError = addSubmitted && !addCourtroom ? 'Select a courtroom' : ''

    const addMatchup = () => {
        setAddSubmitted(true)
        if (!addPros || !addDef || addPros === addDef || !addCourtroom) return
        // TODO: POST /api/tournaments/:id/rounds/:round/pairings { prosecutionTeamId, defenseTeamId, courtroom }
        setPairings(prev => [...prev, {
            id: `p-new-${Date.now()}`, tournamentId: id!, round,
            date: roundDate, courtroom: addCourtroom,
            prosecutionTeamId: addPros, defenseTeamId: addDef,
            scoresheets: [], isPublished: false,
        }])
        setAddPros(''); setAddDef(''); setAddSubmitted(false); setShowAddForm(false)
    }

    const updatePairing = (updated: IPairing) =>
        setPairings(prev => prev.map(p => p.id === updated.id ? updated : p))

    const [confirmRemove, setConfirmRemove] = useState<IPairing | null>(null)

    if (!tournament) {
        navigate(`/organizer/${id}`, { replace: true })
        return null
    }

    return (


            <main className="org-main">
                <div className="org-container">
                    <button className="org-back-btn" onClick={() => navigate(`/organizer/${id}`)}>← Back to dashboard</button>

                    <div className="rv-header">
                        <div className="rv-title-block">
                            {editingName ? (
                                <form onSubmit={e => { e.preventDefault(); saveName(nameValue) }}>
                                    <input autoFocus className="rv-name-input"
                                        value={nameValue} onChange={e => setNameValue(e.target.value)}
                                        onBlur={() => saveName(nameValue)}
                                        onKeyDown={e => e.key === 'Escape' && setEditingName(false)} />
                                </form>
                            ) : (
                                <button className="rv-name-btn"
                                    onClick={() => { setNameValue(roundName); setEditingName(true) }}>
                                    {roundName} <span className="rv-edit-icon">✎</span>
                                </button>
                            )}
                            {nameError && <span className="rv-field-error">{nameError}</span>}

                            <div className="rv-meta-row">
                                <span className="rv-meta">{tournament.name}</span>
                                <span className="rv-meta-sep">·</span>
                                {editingDate ? (
                                    <input autoFocus type="date" className="rv-date-input"
                                        value={roundDate} onChange={e => setRoundDate(e.target.value)}
                                        onBlur={() => setEditingDate(false)} />
                                ) : (
                                    <button className={`rv-date-btn${dateError ? ' rv-field-invalid' : ''}`} onClick={() => setEditingDate(true)}>
                                        {roundDate ? fmt(roundDate) : <span className="rv-placeholder">Set date</span>} <span className="rv-edit-icon">✎</span>
                                    </button>
                                )}
                                <span className="rv-meta-sep">·</span>
                                {editingTime ? (
                                    <input autoFocus type="time" className="rv-date-input"
                                        value={roundTime} onChange={e => setRoundTime(e.target.value)}
                                        onBlur={() => setEditingTime(false)}
                                        style={{ width: '7.5rem' }} />
                                ) : (
                                    <button className={`rv-date-btn${timeError ? ' rv-field-invalid' : ''}`} onClick={() => setEditingTime(true)}>
                                        {roundTime ? fmtTime(roundTime) : <span className="rv-placeholder">Set time</span>} <span className="rv-edit-icon">✎</span>
                                    </button>
                                )}
                            </div>
                            {(dateError || timeError) && (
                                <span className="rv-field-error">{dateError || timeError}</span>
                            )}

                            {detailsDirty && (
                                <button className="rv-save-btn" onClick={saveDetails}>
                                    Save round details
                                </button>
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
                                <div className="rv-field-group">
                                    <label className="rv-field-label">
                                        Prosecution
                                        <select className={`rv-select${addProsError ? ' rv-select-invalid' : ''}`}
                                            value={addPros}
                                            onChange={e => setAddPros(e.target.value)}>
                                            <option value="">Select team…</option>
                                            {teams.map(t => <option key={t.id} value={t.id}>{t.code} — {t.team}</option>)}
                                        </select>
                                    </label>
                                    {addProsError && <span className="rv-field-error">{addProsError}</span>}
                                </div>
                                <div className="rv-field-group">
                                    <label className="rv-field-label">
                                        Defense
                                        <select className={`rv-select${addDefError ? ' rv-select-invalid' : ''}`}
                                            value={addDef}
                                            onChange={e => setAddDef(e.target.value)}>
                                            <option value="">Select team…</option>
                                            {teams.map(t => <option key={t.id} value={t.id}>{t.code} — {t.team}</option>)}
                                        </select>
                                    </label>
                                    {addDefError && <span className="rv-field-error">{addDefError}</span>}
                                </div>
                                <div className="rv-field-group">
                                    <label className="rv-field-label">
                                        Courtroom
                                        <select className={`rv-select${addCourtroomError ? ' rv-select-invalid' : ''}`}
                                            value={addCourtroom} onChange={e => setAddCourtroom(e.target.value)}>
                                            <option value="">Select courtroom…</option>
                                            {courtrooms.map(c => <option key={c.id} value={c.name}>{c.name}{c.details ? ` (${c.details})` : ''}</option>)}
                                        </select>
                                    </label>
                                    {addCourtroomError && <span className="rv-field-error">{addCourtroomError}</span>}
                                </div>
                            </div>
                            <div className="rv-add-form-actions">
                                <button className="org-new-btn" onClick={addMatchup}>
                                    Add matchup
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="dash-pairings">
                        {pairings.length === 0 && !showAddForm && (
                            <p className="rv-empty">No matchups yet. Click "+ Add matchup" to get started.</p>
                        )}
                        {pairings.map(pairing => (
                            <PairingCard
                                key={pairing.id}
                                pairing={pairing}
                                teams={teams}
                                courtrooms={courtrooms}
                                onRemove={() => setConfirmRemove(pairing)}
                                onUpdate={updatePairing}
                            />
                        ))}
                    </div>
                </div>

                {confirmRemove && (
                    <ConfirmRemoveModal
                        message="Remove this matchup?"
                        onCancel={() => setConfirmRemove(null)}
                        onConfirm={() => { 
                        // TODO: DELETE /api/tournaments/:id/pairings/:pairingId
                        setPairings(prev => prev.filter(p => p.id !== confirmRemove.id)); setConfirmRemove(null) }}
                    />
                )}
            </main>

    )
}

export default RoundView
