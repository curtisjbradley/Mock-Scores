import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { IBallotStatus, ICourtroom, IPairing, IPairingScorer, IScorer, ITeam } from '@mock-scores/shared'
import { apiFetch } from '../../auth/auth'
import TeamSelectOptions from '../../shared/components/TeamSelectOptions'

interface Props {
    pairing: IPairing
    teams: ITeam[]
    courtrooms: ICourtroom[]
    scorers: IScorer[]
    assignedScorers: IPairingScorer[]
    ballotStatus?: IBallotStatus
    tournamentId: string
    roundId: string
    conflictSet: Set<string>
    onRemove: () => void
    onUpdate: (updated: IPairing) => void
    onScorerAssigned: (scorer: IPairingScorer) => void
    onScorerRemoved: (assignmentId: string) => void
    onPresiderChanged: (assignmentId: string | null) => void
}

/**
 * Card that represents a single prosecution vs. defense pairing within a round.
 * Supports inline editing of courtroom and team assignments, and manages
 * scorer assignment / presider selection.
 */
export default function PairingCard({ pairing, teams, courtrooms, scorers, assignedScorers, ballotStatus, tournamentId, roundId, conflictSet, onRemove, onUpdate, onScorerAssigned, onScorerRemoved, onPresiderChanged }: Props) {
    const [editingCourtroom, setEditingCourtroom] = useState(false)
    const [courtroomDraft, setCourtroomDraft] = useState(pairing.courtroom ?? '')

    const [editingTeams, setEditingTeams] = useState(false)
    const [prosDraft, setProsDraft] = useState(pairing.p_team)
    const [defDraft, setDefDraft] = useState(pairing.d_team)

    const [showScorerAdd, setShowScorerAdd] = useState(false)
    const [scorerDraft, setScorerDraft] = useState('')
    const [paperMode, setPaperMode] = useState(false)
    const [paperName, setPaperName] = useState('')
    const [manualEntryScorer, setManualEntryScorer] = useState<{ name: string; assignmentId: string } | null>(null)
    const [removeScorerTarget, setRemoveScorerTarget] = useState<{ name: string; assignmentId: string } | null>(null)

    const [sentLinks, setSentLinks] = useState<Set<string>>(new Set<string>);

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
        apiFetch(`/organizer/tournament/${tournamentId}/rounds/${roundId}/pairings/${pairing.pairing_id}/scorers`, {
            method: 'POST', body: JSON.stringify({ scorer_id: scorerDraft }),
        }).then(r => r.json()).then((data: { assignment_id: string }) => {
            const scorer = scorers.find(s => s.scorer_id === scorerDraft)!
            const isFirst = assignedScorers.length === 0
            if (isFirst) {
                apiFetch(`/organizer/tournament/${tournamentId}/rounds/${roundId}/pairings/${pairing.pairing_id}/presider`, {
                    method: 'PUT', body: JSON.stringify({ assignment_id: data.assignment_id }),
                })
                onPresiderChanged(data.assignment_id)
            }
            onScorerAssigned({ assignment_id: data.assignment_id, type: 'registered', scorer_id: scorerDraft, name: `${scorer.first_name} ${scorer.last_name}`, is_presider: isFirst, conflict_reported: false, p_points: null, d_points: null })
            setScorerDraft('')
            setShowScorerAdd(false)
        })
    }

    const addPaperScorer = () => {
        if (!paperName.trim()) return
        apiFetch(`/organizer/tournament/${tournamentId}/rounds/${roundId}/pairings/${pairing.pairing_id}/scorers`, {
            method: 'POST', body: JSON.stringify({ paper_name: paperName.trim() }),
        }).then(r => r.json()).then((data: { assignment_id: string; scorer_id: string }) => {
            const isFirst = assignedScorers.length === 0
            if (isFirst) {
                apiFetch(`/organizer/tournament/${tournamentId}/rounds/${roundId}/pairings/${pairing.pairing_id}/presider`, {
                    method: 'PUT', body: JSON.stringify({ assignment_id: data.assignment_id }),
                })
                onPresiderChanged(data.assignment_id)
            }
            onScorerAssigned({ assignment_id: data.assignment_id, type: 'paper', scorer_id: data.scorer_id, name: paperName.trim(), is_presider: isFirst, conflict_reported: false, p_points: null, d_points: null })
            setPaperName('')
            setShowScorerAdd(false)
        })
    }

    const removeScorer = (assignmentId: string) => {
        const wasPresider = assignedScorers.find(s => s.assignment_id === assignmentId)?.is_presider
        apiFetch(`/organizer/tournament/${tournamentId}/rounds/${roundId}/pairings/${pairing.pairing_id}/scorers/${assignmentId}`, { method: 'DELETE' })
        if (wasPresider) onPresiderChanged(null)
        onScorerRemoved(assignmentId)
    }

    const setPresider = (assignmentId: string) => {
        const current = assignedScorers.find(s => s.is_presider)
        if (current?.assignment_id === assignmentId) {
            apiFetch(`/organizer/tournament/${tournamentId}/rounds/${roundId}/pairings/${pairing.pairing_id}/presider`, { method: 'DELETE' })
            onPresiderChanged(null)
        } else {
            apiFetch(`/organizer/tournament/${tournamentId}/rounds/${roundId}/pairings/${pairing.pairing_id}/presider`, {
                method: 'PUT', body: JSON.stringify({ assignment_id: assignmentId }),
            })
            onPresiderChanged(assignmentId)
        }
    }

    const sendLink = (assignmentId : string)=> {
        apiFetch(`/organizer/tournament/${tournamentId}/rounds/${roundId}/send-scoring-links/${assignmentId}`, {method: 'POST'})
        setSentLinks(new Set<string>(...sentLinks, [assignmentId]))
    }

    return (
        <>
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
                ) :
                   <span className={'pc-courtroom'}>  <button className="dash-courtroom-badge" onClick={() => { setCourtroomDraft(pairing.courtroom ?? ''); setEditingCourtroom(true) }}>
                       {courtroomName(pairing.courtroom)} ✎
                   </button>
                   </span>}

                <button className="dash-remove-btn" onClick={onRemove}>Remove</button>
            </div>

            {editingTeams ? (
                <div className="pc-edit-teams">
                    <label className="rv-field-label">
                        Prosecution
                        <select className="rv-select" value={prosDraft} onChange={e => setProsDraft(e.target.value)}>
                            <TeamSelectOptions teams={teams} />
                        </select>
                    </label>
                    <label className="rv-field-label">
                        Defense
                        <select className="rv-select" value={defDraft} onChange={e => setDefDraft(e.target.value)}>
                            <TeamSelectOptions teams={teams} />
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
                    {ballotStatus && ballotStatus.total_scorers > 0 && (
                        <span className={`pc-ballot-status ${
                            ballotStatus.submitted === ballotStatus.total_scorers
                                ? 'pc-ballot-status--complete'
                                : ballotStatus.submitted > 0
                                    ? 'pc-ballot-status--partial'
                                    : 'pc-ballot-status--none'
                        }`}>
                            {ballotStatus.submitted}/{ballotStatus.total_scorers} ballots
                        </span>
                    )}
                    {!showScorerAdd && (
                        <button className="pc-save-btn" onClick={() => { setShowScorerAdd(true); setPaperMode(false); setScorerDraft(''); setPaperName('') }}>+ Add</button>
                    )}
                </div>

                {assignedScorers.map(s => {
                    const hasConflict = s.type === 'registered' && (
                        conflictSet.has(`${s.scorer_id}:${pairing.p_team}`) ||
                        conflictSet.has(`${s.scorer_id}:${pairing.d_team}`)
                    )
                    const isOnlineScorer = s.type === 'registered';
                    const hasSubmitted = s.p_points != null && s.d_points != null
                    const diff = hasSubmitted ? s.p_points! - s.d_points! : 0
                    const diffLabel = hasSubmitted
                        ? diff > 0 ? `+${diff} P Win` : diff < 0 ? `${diff} D Win` : '0 Tie'
                        : null
                    const diffClass = hasSubmitted
                        ? diff > 0 ? 'pc-diff--p' : diff < 0 ? 'pc-diff--d' : 'pc-diff--tie'
                        : ''
                    return (
                    <div key={s.assignment_id} className="pc-scorer-add-row">
                        <label className="pc-presider-radio">
                            <input type="radio" name={`presider-${pairing.pairing_id}`}
                                checked={s.is_presider}
                                onChange={() => setPresider(s.assignment_id)} />
                            Presider
                        </label>
                        <span style={{ flex: 1, fontSize: '0.875rem' }}>
                            {s.name}
                            {s.type === 'paper'
                                ? <span className="pc-scorer-type pc-scorer-type--paper">Paper</span>
                                : <span className="pc-scorer-type pc-scorer-type--online">Online</span>
                            }
                            {hasConflict && (
                                <span style={{ marginLeft: 6, background: 'red', color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '1px 5px', borderRadius: 3 }}>CONFLICT</span>
                            )}
                            {s.conflict_reported && (
                                <span style={{ marginLeft: 6, background: '#c05000', color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '1px 5px', borderRadius: 3 }}>CONFLICT REPORTED</span>
                            )}
                            {isOnlineScorer && !hasSubmitted && (sentLinks.has(s.assignment_id) ?<span className={"pc-link-sent"}> Link Sent </span> :  <button className={'pc-send-link'} onClick={() => sendLink(s.assignment_id)}>
                                Send Scoring Link
                            </button>) }
                        </span>

                        {diffLabel && <span className={`pc-diff ${diffClass}`}>{diffLabel}</span>}
                        {hasSubmitted && <Link to={`/organizer/${tournamentId}/scoresheet/${pairing.pairing_id}/${s.assignment_id}`} className="pc-view-btn">View</Link>}
                        {s.type === 'paper' && !hasSubmitted && (
                            <button className="pc-save-btn" onClick={() => window.open(`/score/${s.assignment_id}`, '_blank')}>Input scores</button>
                        )}
                        {s.type === 'registered' && !hasSubmitted && (
                            <button className="pc-cancel-btn" onClick={() => setManualEntryScorer({ name: s.name, assignmentId: s.assignment_id })}>Manually enter</button>
                        )}
                        {hasSubmitted ? (<></>) : (
                            <button className="dash-remove-btn" onClick={() => setRemoveScorerTarget({ name: s.name, assignmentId: s.assignment_id })}>Remove</button>
                        )}
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

        {manualEntryScorer && (
            <div className="modal-backdrop" onClick={() => setManualEntryScorer(null)}>
                <div className="confirm-modal" onClick={e => e.stopPropagation()}>
                    <h2 style={{ margin: '0 0 0.75rem' }}>Manually Enter Scores</h2>
                    <p style={{ margin: '0 0 0.5rem', lineHeight: 1.6 }}>
                        You are about to manually enter scores for <strong>{manualEntryScorer.name}</strong>.
                    </p>
                    <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        This will open the scoring form. Once submitted, the scorer's original link will be permanently invalidated and they will no longer be able to submit online.
                    </p>
                    <div className="confirm-actions">
                        <button onClick={() => setManualEntryScorer(null)}>Cancel</button>
                        <button onClick={() => { window.open(`/score/${manualEntryScorer.assignmentId}`, '_blank'); setManualEntryScorer(null) }}>
                            Open Scoring Form
                        </button>
                    </div>
                </div>
            </div>
        )}


        {removeScorerTarget && (
            <div className="modal-backdrop" onClick={() => setRemoveScorerTarget(null)}>
                <div className="confirm-modal" onClick={e => e.stopPropagation()}>
                    <h2 style={{ margin: '0 0 0.75rem' }}>Remove Scorer</h2>
                    <p style={{ margin: '0 0 1rem', lineHeight: 1.6 }}>
                        Remove <strong>{removeScorerTarget.name}</strong> from this pairing?
                    </p>
                    <div className="confirm-actions">
                        <button onClick={() => setRemoveScorerTarget(null)}>Cancel</button>
                        <button onClick={() => { removeScorer(removeScorerTarget.assignmentId); setRemoveScorerTarget(null) }} style={{ backgroundColor: '#d32f2f', color: '#fff' }}>
                            Remove
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    )
}
