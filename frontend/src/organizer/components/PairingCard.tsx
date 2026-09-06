import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { IBallotStatus, ICourtroom, IPairing, IPairingScorer, IRound, IScorer, ITeam } from '@mock-scores/shared'
import { apiFetch } from '../../auth/auth'
import TeamSelectOptions from '../../shared/components/TeamSelectOptions'
import DangerButton from '../../shared/components/DangerButton'
import ModalBackdrop from '../../shared/components/ModalBackdrop'
import { useAutoFocus } from '../../shared/hooks/useAutoFocus'

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
    const [scorerQuery, setScorerQuery] = useState('')
    const [manualEntryScorer, setManualEntryScorer] = useState<{ name: string; assignmentId: string } | null>(null)
    const [removeScorerTarget, setRemoveScorerTarget] = useState<{ name: string; assignmentId: string } | null>(null)

    const [sentLinks, setSentLinks] = useState<Set<string>>(new Set<string>);

    const [showPresiderModal, setShowPresiderModal] = useState(false)
    const [presiderDraft, setPresiderDraft] = useState('')
    const [onlyTiebreakerDraft, setOnlyTiebreakerDraft] = useState(false)

    // Programmatic focus (accessible replacement for the autoFocus attribute).
    const courtroomSelectRef = useAutoFocus<HTMLSelectElement>(editingCourtroom)
    const scorerSearchRef = useAutoFocus<HTMLInputElement>(showScorerAdd)

    const teamName = (tid: string) => {
        const t = teams.find(t => t.id === tid)
        return t ? `${t.code} — ${t.name}` : '—'
    }

    const courtroomName = (id: string | null) => {
        if (!id) return 'No courtroom'
        const c = courtrooms.find(c => c.id === id)
        return c ? c.name + (c.location ? ` (${c.location})` : '') : id
    }

    const openBallot = () => {
        const qs = new URLSearchParams()
        if (pairing.courtroom) qs.set('courtroom', courtroomName(pairing.courtroom))
        if (round?.name) qs.set('roundName', round.name)
        if (round?.round_time) qs.set('roundTime', round.round_time)
        const query = qs.toString()
        window.open(
            `/organizer/${tournamentId}/round/${roundId}/ballot/${pairing.pairing_id}${query ? `?${query}` : ''}`,
            '_blank',
        )
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
            setScorerQuery('')
            setShowScorerAdd(false)
        })
    }

    const addPaperScorer = () => {
        const name = scorerQuery.trim()
        if (!name) return
        apiFetch(`/organizer/tournament/${tournamentId}/rounds/${roundId}/pairings/${pairing.pairing_id}/scorers`, {
            method: 'POST', body: JSON.stringify({ paper_name: name }),
        }).then(r => r.json()).then((data: { assignment_id: string; scorer_id: string }) => {
            const isFirst = assignedScorers.length === 0
            if (isFirst) {
                apiFetch(`/organizer/tournament/${tournamentId}/rounds/${roundId}/pairings/${pairing.pairing_id}/presider`, {
                    method: 'PUT', body: JSON.stringify({ assignment_id: data.assignment_id }),
                })
                onPresiderChanged(data.assignment_id)
            }
            onScorerAssigned({ assignment_id: data.assignment_id, type: 'paper', scorer_id: data.scorer_id, name, is_presider: isFirst, presider_only_tiebreaker: false, conflict_reported: false, p_points: null, d_points: null })
            setScorerQuery('')
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
                    <button className="pc-download-ballot-btn" onClick={openBallot}>
                        <img src="/icons/Download.svg" alt="" aria-hidden="true" className="pc-btn-icon" />
                        Download ballot
                    </button>
                    {!assignedScorers.some(s => s.is_presider) && (
                        <DangerButton onClick={onRemove}>Remove</DangerButton>
                    )}
                </div>
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
                            <select className="rv-select" ref={courtroomSelectRef}
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
                    {assignedScorers.some(s => s.p_points != null || s.d_points != null) && (
                        <Link
                            to={`/organizer/${tournamentId}/round/${roundId}/pairing/${pairing.pairing_id}/scoresheet${
                                round ? `?roundName=${encodeURIComponent(round.name)}${round.round_time ? `&roundTime=${encodeURIComponent(round.round_time)}` : ''}` : ''
                            }`}
                            className="pc-view-btn"
                        >
                            Combined scoresheet
                        </Link>
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
                            <DangerButton onClick={() => setRemoveScorerTarget({ name: s.name, assignmentId: s.assignment_id })}>Remove</DangerButton>
                        )}
                    </div>
                    )
                })}

            </div>
            <button className="pc-save-btn" onClick={() => { setShowScorerAdd(true); setScorerDraft(''); setScorerQuery('') }}>+ Add Scorer</button>
        </div>

        {showScorerAdd && (
            <ModalBackdrop onClose={() => setShowScorerAdd(false)}>
                <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="add-scorer-title">
                    <h2 id="add-scorer-title" style={{ margin: '0 0 0.75rem' }}>Add Scorer</h2>
                    <label className="rv-field-label" style={{ display: 'block', marginBottom: '0.75rem' }}>
                        Scorer
                        <div className="pc-scorer-typeahead">
                            <input
                                className="rv-select pc-scorer-search"
                                ref={scorerSearchRef}
                                placeholder="Search scorers or type a name…"
                                value={scorerQuery}
                                onChange={e => { setScorerQuery(e.target.value); setScorerDraft('') }}
                            />
                            <div className="pc-scorer-results">
                                {(() => {
                                    const q = scorerQuery.trim().toLowerCase()
                                    const matches = q === '' || scorerDraft
                                        ? availableScorers
                                        : availableScorers.filter(s =>
                                            `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)
                                        )
                                    if (matches.length === 0) {
                                        return <p className="pc-scorer-results-empty">No matching scorers</p>
                                    }
                                    return (
                                        <ul className="pc-scorer-options pc-scorer-options--inline">
                                            {matches.map(s => {
                                                const selected = s.scorer_id === scorerDraft
                                                return (
                                                    <li key={s.scorer_id}>
                                                        <button
                                                            type="button"
                                                            className={`pc-scorer-option${selected ? ' pc-scorer-option--selected' : ''}`}
                                                            onClick={() => { setScorerDraft(s.scorer_id); setScorerQuery(`${s.first_name} ${s.last_name}`) }}
                                                        >
                                                            {s.first_name} {s.last_name}
                                                        </button>
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    )
                                })()}
                            </div>
                        </div>
                    </label>

                    <button
                        className="pc-create-offline-btn"
                        disabled={!scorerQuery.trim() || !!scorerDraft}
                        onClick={addPaperScorer}
                    >
                        + Create offline scorer{scorerQuery.trim() ? ` "${scorerQuery.trim()}"` : ''}
                    </button>

                    <div className="confirm-actions">
                        <button onClick={() => setShowScorerAdd(false)}>Cancel</button>
                        <button disabled={!scorerDraft} onClick={addRegisteredScorer}>Add</button>
                    </div>
                </div>
            </ModalBackdrop>
        )}

        {showPresiderModal && (
            <ModalBackdrop onClose={() => setShowPresiderModal(false)}>
                <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="presider-title">
                    <h2 id="presider-title" style={{ margin: '0 0 0.75rem' }}>Change Presider</h2>
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
            </ModalBackdrop>
        )}

        {manualEntryScorer && (
            <ModalBackdrop onClose={() => setManualEntryScorer(null)}>
                <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="manual-entry-title">
                    <h2 id="manual-entry-title" style={{ margin: '0 0 0.75rem' }}>Manually Enter Scores</h2>
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
            </ModalBackdrop>
        )}


        {removeScorerTarget && (
            <ModalBackdrop onClose={() => setRemoveScorerTarget(null)}>
                <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="remove-scorer-title">
                    <h2 id="remove-scorer-title" style={{ margin: '0 0 0.75rem' }}>Remove Scorer</h2>
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
            </ModalBackdrop>
        )}
        </>
    )
}
