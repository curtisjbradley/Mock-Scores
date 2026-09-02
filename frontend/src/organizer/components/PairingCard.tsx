import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { IBallotStatus, ICourtroom, IPairing, IPairingScorer, IRound, IScorer, IScoreSheetFormat, ITeam } from '@mock-scores/shared'
import { apiFetch } from '../../auth/auth'
import TeamSelectOptions from '../../shared/components/TeamSelectOptions'
import { downloadBallot } from '../utils/ballotPdf'

interface Props {
    pairing: IPairing
    teams: ITeam[]
    courtrooms: ICourtroom[]
    scorers: IScorer[]
    assignedScorers: IPairingScorer[]
    ballotStatus?: IBallotStatus
    tournamentId: string
    roundId: string
    round: IRound | null
    conflictSet: Set<string>
    courtroomInUse: boolean
    onRemove: () => void
    onUpdate: (updated: IPairing) => void
    onScorerAssigned: (scorer: IPairingScorer) => void
    onScorerRemoved: (assignmentId: string) => void
    onPresiderChanged: (assignmentId: string | null, onlyTiebreaker?: boolean) => void
}

/**
 * Card that represents a single prosecution vs. defense pairing within a round.
 * Supports inline editing of courtroom and team assignments, and manages
 * scorer assignment / presider selection.
 */
export default function PairingCard({ pairing, teams, courtrooms, scorers, assignedScorers, ballotStatus, tournamentId, roundId, round, conflictSet, courtroomInUse, onRemove, onUpdate, onScorerAssigned, onScorerRemoved, onPresiderChanged }: Props) {
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

    const [downloadingBallot, setDownloadingBallot] = useState(false)
    const [ballotError, setBallotError] = useState<string | null>(null)

    const [showPresiderModal, setShowPresiderModal] = useState(false)
    const [presiderDraft, setPresiderDraft] = useState('')
    const [onlyTiebreakerDraft, setOnlyTiebreakerDraft] = useState(false)

    const teamName = (tid: string) => {
        const t = teams.find(t => t.id === tid)
        return t ? `${t.code} — ${t.name}` : '—'
    }

    const courtroomName = (id: string | null) => {
        if (!id) return 'No courtroom'
        const c = courtrooms.find(c => c.id === id)
        return c ? c.name + (c.location ? ` (${c.location})` : '') : id
    }

    const downloadBallotPdf = () => {
        if (downloadingBallot) return
        setDownloadingBallot(true)
        setBallotError(null)
        apiFetch(`/organizer/tournament/${tournamentId}/rounds/${roundId}/pairings/${pairing.pairing_id}/ballot-format`)
            .then(r => {
                if (!r.ok) throw new Error('Failed to load ballot')
                return r.json() as Promise<IScoreSheetFormat>
            })
            .then(fmt => {
                const opened = downloadBallot(fmt, {
                    prosecutionCode: teams.find(t => t.id === pairing.p_team)?.code,
                    defenseCode: teams.find(t => t.id === pairing.d_team)?.code,
                    courtroom: pairing.courtroom ? courtroomName(pairing.courtroom) : '',
                    roundName: round?.name,
                    roundTime: round?.round_time ?? null,
                })
                if (!opened) setBallotError('Popup blocked — allow popups to download the ballot.')
            })
            .catch(() => setBallotError('Could not generate ballot.'))
            .finally(() => setDownloadingBallot(false))
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
            onScorerAssigned({ assignment_id: data.assignment_id, type: 'registered', scorer_id: scorerDraft, name: `${scorer.first_name} ${scorer.last_name}`, is_presider: isFirst, presider_only_tiebreaker: false, conflict_reported: false, p_points: null, d_points: null })
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
            onScorerAssigned({ assignment_id: data.assignment_id, type: 'paper', scorer_id: data.scorer_id, name: paperName.trim(), is_presider: isFirst, presider_only_tiebreaker: false, conflict_reported: false, p_points: null, d_points: null })
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

    const openPresiderModal = () => {
        const current = assignedScorers.find(s => s.is_presider)
        setPresiderDraft(current?.assignment_id ?? '')
        setOnlyTiebreakerDraft(current?.presider_only_tiebreaker ?? false)
        setShowPresiderModal(true)
    }

    const savePresider = () => {
        if (!presiderDraft) return
        apiFetch(`/organizer/tournament/${tournamentId}/rounds/${roundId}/pairings/${pairing.pairing_id}/presider`, {
            method: 'PUT', body: JSON.stringify({ assignment_id: presiderDraft, only_tiebreaker: onlyTiebreakerDraft }),
        })
        onPresiderChanged(presiderDraft, onlyTiebreakerDraft)
        setShowPresiderModal(false)
    }

    const sendLink = (assignmentId : string)=> {
        apiFetch(`/organizer/tournament/${tournamentId}/rounds/${roundId}/send-scoring-links/${assignmentId}`, {method: 'POST'})
        setSentLinks(new Set<string>(...sentLinks, [assignmentId]))
    }

    return (
        <>
        <div className="dash-pairing-card">
            <div className="dash-pairing-topbar">
                <div className="pc-topbar-actions">
                    <button className="pc-download-ballot-btn" onClick={downloadBallotPdf} disabled={downloadingBallot}>
                        {downloadingBallot ? 'Preparing…' : '⬇ Download ballot'}
                    </button>
                    {!assignedScorers.some(s => s.is_presider) && (
                        <button className="dash-remove-btn" onClick={onRemove}>Remove</button>
                    )}
                </div>
            </div>
            {ballotError && <p className="pc-ballot-error">{ballotError}</p>}

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
                <div className="pc-matchup-grid">
                    <button className="pc-matchup-col" onClick={() => { setProsDraft(pairing.p_team); setDefDraft(pairing.d_team); setEditingTeams(true) }}>
                        <span className="dash-side-label">Prosecution</span>
                        <span className="dash-team-name">{teamName(pairing.p_team)}</span>
                        <span className="pc-col-edit-hint">✎</span>
                    </button>
                    <button className="pc-matchup-col" onClick={() => { setProsDraft(pairing.p_team); setDefDraft(pairing.d_team); setEditingTeams(true) }}>
                        <span className="dash-side-label">Defense</span>
                        <span className="dash-team-name">{teamName(pairing.d_team)}</span>
                        <span className="pc-col-edit-hint">✎</span>
                    </button>
                    {editingCourtroom ? (
                        <div className="pc-matchup-col pc-inline-edit">
                            <span className="dash-side-label">Courtroom</span>
                            <select className="rv-select" autoFocus
                                value={courtroomDraft}
                                onChange={e => setCourtroomDraft(e.target.value)}>
                                <option value="" >No courtroom</option>
                                {courtrooms.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}{c.location ? ` (${c.location})` : ''}</option>
                                ))}
                            </select>
                            <div className="pc-edit-actions">
                                <button className="pc-save-btn" onClick={saveCourtroomEdit}>Save</button>
                                <button className="pc-cancel-btn" onClick={() => setEditingCourtroom(false)}>Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <button className="pc-matchup-col" onClick={() => { setCourtroomDraft(pairing.courtroom ?? ''); setEditingCourtroom(true) }}>
                            <span className="dash-side-label">Courtroom</span>
                            {pairing.courtroom ?  <span className="dash-team-name">{courtroomName(pairing.courtroom)}</span> : <span className={"pc-no-courtroom"}> No Courtroom</span> }
                            {courtroomInUse && (
                                <span className="pc-courtroom-warning" title="This courtroom is assigned to another trial in the same round.">
                                    ⚠ Double-booked
                                </span>
                            )}
                            <span className="pc-col-edit-hint">✎</span>
                        </button>
                    )}
                </div>
            )}

            <div className="pc-scorers-section">
                <div className="pc-scorers-header">
                    <span className="pc-scorers-label">Scorers</span>
                    {assignedScorers.length > 0 && (
                        <button className="pc-cancel-btn" onClick={openPresiderModal}>Change presider</button>
                    )}
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
                        {s.is_presider && (
                            <span className="pc-presider-badge">
                                Presider{s.presider_only_tiebreaker ? ' (tiebreaker only)' : ''}
                            </span>
                        )}
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
            {!showScorerAdd && (
                <button className="pc-save-btn" onClick={() => { setShowScorerAdd(true); setPaperMode(false); setScorerDraft(''); setPaperName('') }}>+ Add Scorer</button>
            )}
        </div>

        {showPresiderModal && (
            <div className="modal-backdrop" onClick={() => setShowPresiderModal(false)}>
                <div className="confirm-modal" onClick={e => e.stopPropagation()}>
                    <h2 style={{ margin: '0 0 0.75rem' }}>Change Presider</h2>
                    <label className="rv-field-label" style={{ display: 'block', marginBottom: '0.75rem' }}>
                        Presider
                        <select className="rv-select" value={presiderDraft} onChange={e => setPresiderDraft(e.target.value)}>
                            <option value="">Select presider…</option>
                            {assignedScorers.map(s => (
                                <option key={s.assignment_id} value={s.assignment_id}>{s.name}</option>
                            ))}
                        </select>
                    </label>
                    <label className="pc-presider-checkbox">
                        <input type="checkbox" checked={onlyTiebreakerDraft} onChange={e => setOnlyTiebreakerDraft(e.target.checked)} />
                        Only Score Tiebreaker
                    </label>
                    <div className="confirm-actions">
                        <button onClick={() => setShowPresiderModal(false)}>Cancel</button>
                        <button disabled={!presiderDraft} onClick={savePresider}>Save</button>
                    </div>
                </div>
            </div>
        )}

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
