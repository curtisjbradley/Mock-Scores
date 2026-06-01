import { useState } from 'react'
import type { ICourtroom, IPairing, IPairingScorer, IScorer, ITeam } from '@mock-scores/shared'
import { apiFetch } from '../../auth/auth'

interface Props {
    pairing: IPairing
    teams: ITeam[]
    courtrooms: ICourtroom[]
    scorers: IScorer[]
    assignedScorers: IPairingScorer[]
    tournamentId: string
    roundId: string
    conflictSet: Set<string>
    onRemove: () => void
    onUpdate: (updated: IPairing) => void
    onScorerAssigned: (scorer: IPairingScorer) => void
    onScorerRemoved: (assignmentId: string) => void
    onPresiderChanged: (assignmentId: string | null) => void
}

export default function PairingCard({ pairing, teams, courtrooms, scorers, assignedScorers, tournamentId, roundId, conflictSet, onRemove, onUpdate, onScorerAssigned, onScorerRemoved, onPresiderChanged }: Props) {
    const [editingCourtroom, setEditingCourtroom] = useState(false)
    const [courtroomDraft, setCourtroomDraft] = useState(pairing.courtroom ?? '')

    const [editingTeams, setEditingTeams] = useState(false)
    const [prosDraft, setProsDraft] = useState(pairing.p_team)
    const [defDraft, setDefDraft] = useState(pairing.d_team)

    const [showScorerAdd, setShowScorerAdd] = useState(false)
    const [scorerDraft, setScorerDraft] = useState('')
    const [paperMode, setPaperMode] = useState(false)
    const [paperName, setPaperName] = useState('')

    const teamName = (tid: string) => {
        const t = teams.find(t => t.id === tid)
        return t ? `${t.code} — ${t.name}` : '—'
    }

    const courtroomName = (id: string | null) => {
        if (!id) return 'No courtroom'
        const c = courtrooms.find(c => c.id === id)
        return c ? c.name + (c.location ? ` (${c.location})` : '') : id
    }

    const saveCourtroomEdit = () => {
        onUpdate({ ...pairing, courtroom: courtroomDraft || null })
        setEditingCourtroom(false)
    }

    const saveTeamsEdit = () => {
        onUpdate({ ...pairing, p_team: prosDraft, d_team: defDraft })
        setEditingTeams(false)
    }

    const assignedIds = new Set(assignedScorers.filter(s => s.type === 'registered').map(s => s.scorer_id))
    const availableScorers = scorers.filter(s => !assignedIds.has(s.scorer_id))

    const addRegisteredScorer = () => {
        if (!scorerDraft) return
        apiFetch(`/api/organizer/tournament/${tournamentId}/rounds/${roundId}/pairings/${pairing.pairing_id}/scorers`, {
            method: 'POST', body: JSON.stringify({ scorer_id: scorerDraft }),
        }).then(r => r.json()).then((data: { assignment_id: string }) => {
            const scorer = scorers.find(s => s.scorer_id === scorerDraft)!
            const isFirst = assignedScorers.length === 0
            if (isFirst) {
                apiFetch(`/api/organizer/tournament/${tournamentId}/rounds/${roundId}/pairings/${pairing.pairing_id}/presider`, {
                    method: 'PUT', body: JSON.stringify({ assignment_id: data.assignment_id }),
                })
                onPresiderChanged(data.assignment_id)
            }
            onScorerAssigned({ assignment_id: data.assignment_id, type: 'registered', scorer_id: scorerDraft, name: `${scorer.first_name} ${scorer.last_name}`, is_presider: isFirst })
            setScorerDraft('')
            setShowScorerAdd(false)
        })
    }

    const addPaperScorer = () => {
        if (!paperName.trim()) return
        apiFetch(`/api/organizer/tournament/${tournamentId}/rounds/${roundId}/pairings/${pairing.pairing_id}/scorers`, {
            method: 'POST', body: JSON.stringify({ paper_name: paperName.trim() }),
        }).then(r => r.json()).then((data: { assignment_id: string; scorer_id: string }) => {
            const isFirst = assignedScorers.length === 0
            if (isFirst) {
                apiFetch(`/api/organizer/tournament/${tournamentId}/rounds/${roundId}/pairings/${pairing.pairing_id}/presider`, {
                    method: 'PUT', body: JSON.stringify({ assignment_id: data.assignment_id }),
                })
                onPresiderChanged(data.assignment_id)
            }
            onScorerAssigned({ assignment_id: data.assignment_id, type: 'paper', scorer_id: data.scorer_id, name: paperName.trim(), is_presider: isFirst })
            setPaperName('')
            setShowScorerAdd(false)
        })
    }

    const removeScorer = (assignmentId: string) => {
        const wasPresider = assignedScorers.find(s => s.assignment_id === assignmentId)?.is_presider
        apiFetch(`/api/organizer/tournament/${tournamentId}/rounds/${roundId}/pairings/${pairing.pairing_id}/scorers/${assignmentId}`, { method: 'DELETE' })
        if (wasPresider) onPresiderChanged(null)
        onScorerRemoved(assignmentId)
    }

    const setPresider = (assignmentId: string) => {
        const current = assignedScorers.find(s => s.is_presider)
        if (current?.assignment_id === assignmentId) {
            apiFetch(`/api/organizer/tournament/${tournamentId}/rounds/${roundId}/pairings/${pairing.pairing_id}/presider`, { method: 'DELETE' })
            onPresiderChanged(null)
        } else {
            apiFetch(`/api/organizer/tournament/${tournamentId}/rounds/${roundId}/pairings/${pairing.pairing_id}/presider`, {
                method: 'PUT', body: JSON.stringify({ assignment_id: assignmentId }),
            })
            onPresiderChanged(assignmentId)
        }
    }

    return (
        <div className="dash-pairing-card">
            <div className="dash-pairing-topbar">
                {editingCourtroom ? (
                    <div className="pc-inline-edit">
                        <select className="rv-select" autoFocus
                            value={courtroomDraft}
                            onChange={e => setCourtroomDraft(e.target.value)}>
                            <option value="">No courtroom</option>
                            {courtrooms.map(c => (
                                <option key={c.id} value={c.id}>{c.name}{c.location ? ` (${c.location})` : ''}</option>
                            ))}
                        </select>
                        <button className="pc-save-btn" onClick={saveCourtroomEdit}>Save</button>
                        <button className="pc-cancel-btn" onClick={() => setEditingCourtroom(false)}>Cancel</button>
                    </div>
                ) : (
                    <button className="dash-courtroom-badge" onClick={() => { setCourtroomDraft(pairing.courtroom ?? ''); setEditingCourtroom(true) }}>
                        🏛 {courtroomName(pairing.courtroom)} ✎
                    </button>
                )}
                <button className="dash-remove-btn" onClick={onRemove}>Remove</button>
            </div>

            {editingTeams ? (
                <div className="pc-edit-teams">
                    <label className="rv-field-label">
                        Prosecution
                        <select className="rv-select" value={prosDraft} onChange={e => setProsDraft(e.target.value)}>
                            <option value="">Select team…</option>
                            {teams.map(t => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
                        </select>
                    </label>
                    <label className="rv-field-label">
                        Defense
                        <select className="rv-select" value={defDraft} onChange={e => setDefDraft(e.target.value)}>
                            <option value="">Select team…</option>
                            {teams.map(t => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
                        </select>
                    </label>
                    <div className="pc-edit-actions">
                        <button className="pc-save-btn" onClick={saveTeamsEdit}>Save</button>
                        <button className="pc-cancel-btn" onClick={() => setEditingTeams(false)}>Cancel</button>
                    </div>
                </div>
            ) : (
                <button className="dash-matchup-grid pc-matchup-btn" onClick={() => { setProsDraft(pairing.p_team); setDefDraft(pairing.d_team); setEditingTeams(true) }}>
                    <div className="dash-matchup-side">
                        <span className="dash-side-label">Prosecution</span>
                        <span className="dash-team-name">{teamName(pairing.p_team)}</span>
                    </div>
                    <span className="dash-vs">v.</span>
                    <div className="dash-matchup-side dash-matchup-side--right">
                        <span className="dash-side-label">Defense</span>
                        <span className="dash-team-name">{teamName(pairing.d_team)}</span>
                    </div>
                    <span className="pc-edit-hint">✎</span>
                </button>
            )}

            <div className="pc-scorers-section">
                <div className="pc-scorers-header">
                    <span className="pc-scorers-label">Scorers</span>
                    {!showScorerAdd && (
                        <button className="pc-save-btn" onClick={() => { setShowScorerAdd(true); setPaperMode(false); setScorerDraft(''); setPaperName('') }}>+ Add</button>
                    )}
                </div>

                {assignedScorers.map(s => {
                    const hasConflict = s.type === 'registered' && (
                        conflictSet.has(`${s.scorer_id}:${pairing.p_team}`) ||
                        conflictSet.has(`${s.scorer_id}:${pairing.d_team}`)
                    )
                    return (
                    <div key={s.assignment_id} className="pc-scorer-add-row">
                        <label className="pc-presider-radio">
                            <input type="radio" name={`presider-${pairing.pairing_id}`}
                                checked={s.is_presider}
                                onChange={() => setPresider(s.assignment_id)} />
                            Presider
                        </label>
                        <span style={{ flex: 1, fontSize: '0.875rem' }}>
                            {s.name}{s.type === 'paper' ? ' (paper)' : ''}
                            {hasConflict && (
                                <span style={{ marginLeft: 6, background: 'red', color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '1px 5px', borderRadius: 3 }}>CONFLICT</span>
                            )}
                        </span>
                        {s.type === 'paper' && (
                            // TODO: open score input for paper scorer
                            <button className="pc-save-btn" onClick={() => {}}>Input scores</button>
                        )}
                        <button className="dash-remove-btn" onClick={() => removeScorer(s.assignment_id)}>Remove</button>
                    </div>
                    )
                })}

                {showScorerAdd && (
                    <div className="pc-scorer-add-row">
                        <label className="pc-presider-radio">
                            <input type="radio" checked={!paperMode} onChange={() => setPaperMode(false)} /> Registered
                        </label>
                        <label className="pc-presider-radio">
                            <input type="radio" checked={paperMode} onChange={() => setPaperMode(true)} /> Paper
                        </label>
                        {paperMode ? (
                            <>
                                <input className="pc-paper-input" autoFocus placeholder="Scorer name"
                                    value={paperName} onChange={e => setPaperName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addPaperScorer()} />
                                <button className="pc-paper-add" disabled={!paperName.trim()} onClick={addPaperScorer}>Add</button>
                            </>
                        ) : (
                            <>
                                <select className="rv-select" autoFocus value={scorerDraft} onChange={e => setScorerDraft(e.target.value)}>
                                    <option value="">Select scorer…</option>
                                    {availableScorers.map(s => <option key={s.scorer_id} value={s.scorer_id}>{s.first_name} {s.last_name}</option>)}
                                </select>
                                <button className="pc-paper-add" disabled={!scorerDraft} onClick={addRegisteredScorer}>Add</button>
                            </>
                        )}
                        <button className="pc-paper-cancel" onClick={() => setShowScorerAdd(false)}>✕</button>
                    </div>
                )}
            </div>
        </div>
    )
}
