import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import '../styles/organizer.css'
import '../styles/round-view.css'
import '../styles/pairings.css'
import { apiFetch } from '../../auth/auth'
import PairingCard from '../components/PairingCard'
import { ConfirmRemoveModal } from '../components/modals'
import type {ICourtroom, IPairing, IPairingScorer, IRound, IScorer, ITeam} from '@mock-scores/shared'
import NotFound from '../../error/NotFound'

const RoundView = () => {
    const { id, round: roundId } = useParams<{ id: string; round: string }>()
    const navigate = useNavigate()

    const [round, setRound] = useState<IRound | null>(null)
    const [teams, setTeams] = useState<ITeam[]>([])
    const [courtrooms, setCourtrooms] = useState<ICourtroom[]>([])
    const [pairings, setPairings] = useState<IPairing[]>([])
    const [scorers, setScorers] = useState<IScorer[]>([])
    const [pairingScorers, setPairingScorers] = useState<Record<string, IPairingScorer[]>>({})
    const [conflictSet, setConflictSet] = useState<Set<string>>(new Set())
    const [error, setError] = useState('')
    const [notFound, setNotFound] = useState(false)

    useEffect(() => {
        if (!id || !roundId) { navigate('/'); return }
        Promise.all([
            apiFetch(`/api/organizer/tournament/${id}/rounds/${roundId}`).then(r => { if (r.status === 404) { setNotFound(true); throw new Error('not found') } if (!r.ok) throw new Error('Round not found'); return r.json() }),
            apiFetch(`/api/organizer/tournament/${id}/teams`).then(r => r.json()),
            apiFetch(`/api/organizer/tournament/${id}/courtrooms`).then(r => r.json()),
            apiFetch(`/api/organizer/tournament/${id}/rounds/${roundId}/pairings`).then(r => r.json()),
            apiFetch(`/api/organizer/tournament/${id}/scorers`).then(r => r.json()),
        ]).then(([roundData, teamsData, courtroomsData, pairingsData, scorersData]) => {
            setRound(roundData)
            setTeams(teamsData)
            setCourtrooms(courtroomsData)
            setPairings(pairingsData)
            setScorers(Array.isArray(scorersData) ? scorersData : [])
            return Promise.all([
                Promise.all((pairingsData as IPairing[]).map((p: IPairing) =>
                    apiFetch(`/api/organizer/tournament/${id}/rounds/${roundId}/pairings/${p.pairing_id}/scorers`)
                        .then(r => r.json())
                        .then((s: IPairingScorer[]) => [p.pairing_id, s] as [string, IPairingScorer[]])
                )),
                apiFetch(`/api/organizer/tournament/${id}/scorer-conflicts`).then(r => r.ok ? r.json() : []),
            ])
        }).then(([entries, conflicts]) => {
            setPairingScorers(Object.fromEntries(entries as [string, IPairingScorer[]][]))
            setConflictSet(new Set((conflicts as { scorer_id: string; team_id: string }[]).map(c => `${c.scorer_id}:${c.team_id}`)))
        }).catch(() => setError('Failed to load round data.'))
    }, [id, roundId, navigate])

    // Round detail editing
    const [editingName, setEditingName] = useState(false)
    const [nameValue, setNameValue] = useState('')
    const saveName = (val: string) => {
        const name = val.trim() || round?.name || ''
        setEditingName(false)
        if (!round || name === round.name) return
        const updated = { ...round, name }
        setRound(updated)
        apiFetch(`/api/organizer/tournament/${id}/rounds/${roundId}`, {
            method: 'PATCH', body: JSON.stringify(updated),
        }).catch(() => setError('Failed to save name.'))
    }

    // Add matchup form
    const [showAddForm, setShowAddForm] = useState(false)
    const [addPros, setAddPros] = useState('')
    const [addDef, setAddDef] = useState('')
    const [addCourtroom, setAddCourtroom] = useState('')
    const [addSubmitted, setAddSubmitted] = useState(false)

    const prosAlreadyPros = addSubmitted && addPros && pairings.some(p => p.p_team === addPros)
    const defAlreadyDef = addSubmitted && addDef && pairings.some(p => p.d_team === addDef)

    const addProsError = addSubmitted && !addPros ? 'Select prosecution team'
        : prosAlreadyPros ? 'Team already prosecuting this round' : ''
    const addDefError = addSubmitted && !addDef ? 'Select defense team'
        : addSubmitted && addDef === addPros ? 'Must differ from prosecution'
        : defAlreadyDef ? 'Team already defending this round' : ''
    const addCourtroomError = addSubmitted && !addCourtroom ? 'Select a courtroom' : ''

    const addMatchup = () => {
        setAddSubmitted(true)
        if (!addPros || !addDef || addPros === addDef || !addCourtroom) return
        if (pairings.some(p => p.p_team === addPros) || pairings.some(p => p.d_team === addDef)) return

        apiFetch(`/api/organizer/tournament/${id}/rounds/${roundId}/pairings`, {
            method: 'POST',
            body: JSON.stringify({ prosectionID: addPros, defenseID: addDef, courtroomID: addCourtroom }),
        }).then(async r => {
            const data = await r.json()
            if (!r.ok) throw new Error(data.message ?? 'Failed to add matchup.')
            return data
        }).then((created: IPairing) => {
            setPairings(prev => [...prev, created])
            setAddPros(''); setAddDef(''); setAddCourtroom(''); setAddSubmitted(false); setShowAddForm(false)
        }).catch((e: Error) => setError(e.message))
    }

    const updatePairing = (updated: IPairing) =>
        setPairings(prev => prev.map(p => p.pairing_id === updated.pairing_id ? updated : p))

    const [confirmRemove, setConfirmRemove] = useState<IPairing | null>(null)
    const removePairing = (pairing: IPairing) => {
        apiFetch(`/api/organizer/tournament/${id}/rounds/${roundId}/pairings/${pairing.pairing_id}`, { method: 'DELETE' })
            .catch(() => setError('Failed to remove matchup.'))
        setPairings(prev => prev.filter(p => p.pairing_id !== pairing.pairing_id))
        setConfirmRemove(null)
    }

    const onScorerAssigned = (pairingId: string, scorer: IPairingScorer) =>
        setPairingScorers(prev => ({ ...prev, [pairingId]: [...(prev[pairingId] ?? []), scorer] }))

    const onScorerRemoved = (pairingId: string, assignmentId: string) =>
        setPairingScorers(prev => ({ ...prev, [pairingId]: (prev[pairingId] ?? []).filter(s => s.assignment_id !== assignmentId) }))

    const onPresiderChanged = (pairingId: string, assignmentId: string | null) =>
        setPairingScorers(prev => ({
            ...prev,
            [pairingId]: (prev[pairingId] ?? []).map(s => ({ ...s, is_presider: s.assignment_id === assignmentId })),
        }))

    if (notFound) return <NotFound />

    return (
        <main className="org-main">
            <div className="org-container">
                <button className="org-back-btn" onClick={() => navigate(`/organizer/${id}?page=rounds`)}>← Back to rounds</button>
                {error && <p className="org-error">{error}</p>}

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
                                onClick={() => { setNameValue(round?.name ?? ''); setEditingName(true) }}>
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
                            <div className="rv-field-group">
                                <label className="rv-field-label">
                                    Prosecution
                                    <select className={`rv-select${addProsError ? ' rv-select-invalid' : ''}`}
                                        value={addPros} onChange={e => setAddPros(e.target.value)}>
                                        <option value="">Select team…</option>
                                        {teams.map(t => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
                                    </select>
                                </label>
                                {addProsError && <span className="rv-field-error">{addProsError}</span>}
                            </div>
                            <div className="rv-field-group">
                                <label className="rv-field-label">
                                    Defense
                                    <select className={`rv-select${addDefError ? ' rv-select-invalid' : ''}`}
                                        value={addDef} onChange={e => setAddDef(e.target.value)}>
                                        <option value="">Select team…</option>
                                        {teams.map(t => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
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
                                        {courtrooms.map(c => <option key={c.id} value={c.id}>{c.name}{c.location ? ` (${c.location})` : ''}</option>)}
                                    </select>
                                </label>
                                {addCourtroomError && <span className="rv-field-error">{addCourtroomError}</span>}
                            </div>
                        </div>
                        <div className="rv-add-form-actions">
                            <button className="org-new-btn" onClick={addMatchup}>Add matchup</button>
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
                            onRemove={() => setConfirmRemove(pairing)}
                            onUpdate={updatePairing}
                            onScorerAssigned={s => onScorerAssigned(pairing.pairing_id, s)}
                            onScorerRemoved={assignmentId => onScorerRemoved(pairing.pairing_id, assignmentId)}
                            onPresiderChanged={assignmentId => onPresiderChanged(pairing.pairing_id, assignmentId)}
                        />
                    ))}
                </div>
            </div>

            {confirmRemove && (
                <ConfirmRemoveModal
                    message="Remove this matchup?"
                    onCancel={() => setConfirmRemove(null)}
                    onConfirm={() => removePairing(confirmRemove)}
                />
            )}
        </main>
    )
}

export default RoundView
