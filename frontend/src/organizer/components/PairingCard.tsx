import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { IBallotStatus, ICourtroom, IPairing, IPairingRosterStatus, IPairingScorer, IRound, IScorer, ITeam } from '@mock-scores/shared'
import { apiFetch } from '../../auth/auth'
import { isValidEmail } from '../../utils/validation'
import TeamSelectOptions from '../../shared/components/TeamSelectOptions'
import DangerButton from '../../shared/components/DangerButton'
import Icon from '../../shared/components/Icon'
import EmailStatusBadge from '../../shared/components/EmailStatusBadge'
import StatusChip from '../../shared/components/StatusChip'
import ModalBackdrop from '../../shared/components/ModalBackdrop'
import { useAutoFocus } from '../../shared/hooks/useAutoFocus'
import { v4 as randomUUID } from 'uuid'

interface Props {
    pairing: IPairing
    pairingNumber: number
    teams: ITeam[]
    courtrooms: ICourtroom[]
    scorers: IScorer[]
    assignedScorers: IPairingScorer[]
    ballotStatus?: IBallotStatus
    rosterStatuses: Record<string, IPairingRosterStatus>
    /** True once the round's one-time bulk scoring-link send has happened. Per-scorer
     *  resend buttons only appear afterwards. */
    linksSent: boolean
    tournamentId: string
    roundId: string
    round: IRound | null
    conflictSet: Set<string>
    courtroomInUse: boolean
    onRemove: () => void
    onUpdate: (updated: IPairing) => void
    onScorerAssigned: (scorer: IPairingScorer) => void
    onScorerCreated: (scorer: IScorer) => void
    onCourtroomCreated: (courtroom: ICourtroom) => void
    onScorerRemoved: (assignmentId: string) => void
    onPresiderChanged: (assignmentId: string | null, onlyTiebreaker?: boolean) => void
}

/**
 * Card that represents a single prosecution vs. defense pairing within a round.
 * Supports inline editing of courtroom and team assignments, and manages
 * scorer assignment / presider selection.
 */
export default function PairingCard({ pairing, pairingNumber, teams, courtrooms, scorers, assignedScorers, ballotStatus, rosterStatuses, linksSent, tournamentId, roundId, round, conflictSet, courtroomInUse, onRemove, onUpdate, onScorerAssigned, onScorerCreated, onCourtroomCreated, onScorerRemoved, onPresiderChanged }: Props) {
    const [expanded, setExpanded] = useState(false)
    const [editingCourtroom, setEditingCourtroom] = useState(false)
    const [courtroomDraft, setCourtroomDraft] = useState(pairing.courtroom ?? '')
    const [courtroomQuery, setCourtroomQuery] = useState('')
    const [creatingCourtroom, setCreatingCourtroom] = useState(false)

    const [editingTeams, setEditingTeams] = useState(false)
    const [prosDraft, setProsDraft] = useState(pairing.p_team)
    const [defDraft, setDefDraft] = useState(pairing.d_team)

    const [showScorerAdd, setShowScorerAdd] = useState(false)
    const [scorerAddMode, setScorerAddMode] = useState<'existing' | 'create'>('existing')
    const [scorerDraft, setScorerDraft] = useState('')
    const [scorerQuery, setScorerQuery] = useState('')
    const [newScorerIsPaper, setNewScorerIsPaper] = useState(false)
    const [newScorerEmail, setNewScorerEmail] = useState('')
    const [manualEntryScorer, setManualEntryScorer] = useState<{ name: string; assignmentId: string } | null>(null)
    const [removeScorerTarget, setRemoveScorerTarget] = useState<{ name: string; assignmentId: string } | null>(null)

    const [sentLinks, setSentLinks] = useState<Set<string>>(new Set<string>);

    const [showPresiderModal, setShowPresiderModal] = useState(false)
    const [presiderDraft, setPresiderDraft] = useState('')
    const [onlyTiebreakerDraft, setOnlyTiebreakerDraft] = useState(false)

    // Programmatic focus (accessible replacement for the autoFocus attribute).
    const courtroomSelectRef = useAutoFocus<HTMLInputElement>(editingCourtroom)
    const scorerSearchRef = useAutoFocus<HTMLInputElement>(showScorerAdd)

    const teamName = (tid: string) => {
        const t = teams.find(t => t.id === tid)
        return t ? `${t.code} - ${t.name}` : 'Unassigned'
    }

    const isTeamUnassigned = (tid: string) => !teams.some(t => t.id === tid)

    const courtroomName = (id: string | null) => {
        if (!id) return 'Unassigned'
        const c = courtrooms.find(c => c.id === id)
        return c ? c.name + (c.location ? ` (${c.location})` : '') : id
    }

    const prosecutionUnassigned = isTeamUnassigned(pairing.p_team)
    const defenseUnassigned = isTeamUnassigned(pairing.d_team)
    const courtroomUnassigned = !pairing.courtroom

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
    const hasPresider = assignedScorers.some(scorer => scorer.is_presider)
    const teamReadinessChips = (teamId: string) => {
        const status = rosterStatuses[teamId]
        return (
            <span className="pc-summary-issues">
                {status?.roster_status === 'none' && <StatusChip label="No roster" variant="danger" />}
                {status?.call_order_status === 'none' && <StatusChip label="No call order" variant="danger" />}
            </span>
        )
    }
    const hasScorerConflict = assignedScorers.some(scorer => scorer.type === 'registered' && (
        conflictSet.has(`${scorer.scorer_id}:${pairing.p_team}`) ||
        conflictSet.has(`${scorer.scorer_id}:${pairing.d_team}`) ||
        scorer.conflict_reported
    ))
    const addRegisteredScorer = (scorerId = scorerDraft, scorerToAssign = scorers.find(s => s.scorer_id === scorerId)) => {
        if (!scorerId || !scorerToAssign) return
        apiFetch(`/organizer/tournament/${tournamentId}/pairings/${pairing.pairing_id}/scorers`, {
            method: 'POST', body: JSON.stringify({ scorer_id: scorerId }),
        }).then(r => r.json()).then((data: { assignment_id: string }) => {
            const isFirst = assignedScorers.length === 0
            if (isFirst) {
                apiFetch(`/organizer/tournament/${tournamentId}/pairings/${pairing.pairing_id}/presider`, {
                    method: 'PUT', body: JSON.stringify({ assignment_id: data.assignment_id }),
                })
                onPresiderChanged(data.assignment_id)
            }
            onScorerAssigned({ assignment_id: data.assignment_id, type: scorerToAssign.is_paper ? 'paper' : 'registered', scorer_id: scorerId, name: scorerToAssign.name, is_presider: isFirst, presider_only_tiebreaker: false, conflict_reported: false, p_points: null, d_points: null, ballot_id: null})
            setScorerDraft('')
            setScorerQuery('')
            setShowScorerAdd(false)
        })
    }

    const createScorer = () => {
        const name = scorerQuery.trim()
        if (!name || (!newScorerIsPaper && !isValidEmail(newScorerEmail))) return
        const scorer: IScorer = {
            scorer_id: randomUUID(),
            name,
            email: newScorerIsPaper ? null : newScorerEmail.trim(),
            is_paper: newScorerIsPaper,
            willing_to_preside: true,
            notes: '',
            prefers_to_score_with: [],
        }
        apiFetch(`/organizer/tournament/${tournamentId}/scorers`, {
            method: 'POST', body: JSON.stringify(scorer),
        }).then(r => {
            if (!r.ok) throw new Error('Unable to create scorer.')
            onScorerCreated(scorer)
            addRegisteredScorer(scorer.scorer_id, scorer)
        })
    }

    const resetScorerAdd = () => {
        setScorerDraft('')
        setScorerQuery('')
        setNewScorerIsPaper(false)
        setNewScorerEmail('')
        setScorerAddMode('existing')
    }

    const openScorerAdd = () => {
        resetScorerAdd()
        setShowScorerAdd(true)
    }

    const beginCourtroomEdit = () => {
        setCourtroomDraft(pairing.courtroom ?? '')
        setCourtroomQuery(pairing.courtroom ? courtroomName(pairing.courtroom) : '')
        setEditingCourtroom(true)
    }

    const matchingCourtrooms = courtrooms.filter(c => {
        const label = `${c.name}${c.location ? ` (${c.location})` : ''}`.toLowerCase()
        return label.includes(courtroomQuery.trim().toLowerCase())
    })
    const hasExactCourtroomName = courtrooms.some(c => c.name.toLowerCase() === courtroomQuery.trim().toLowerCase())

    const createCourtroom = async () => {
        const name = courtroomQuery.trim()
        if (!name || creatingCourtroom) return
        setCreatingCourtroom(true)
        const courtroom: ICourtroom = { id: randomUUID(), name, location: '' }
        try {
            const response = await apiFetch(`/organizer/tournament/${tournamentId}/courtrooms`, {
                method: 'POST', body: JSON.stringify(courtroom),
            })
            if (!response.ok) throw new Error()
            onCourtroomCreated(courtroom)
            setCourtroomDraft(courtroom.id)
        } finally {
            setCreatingCourtroom(false)
        }
    }

    const beginTeamsEdit = () => {
        setProsDraft(pairing.p_team)
        setDefDraft(pairing.d_team)
        setEditingTeams(true)
    }

    const removeScorer = (assignmentId: string) => {
        const wasPresider = assignedScorers.find(s => s.assignment_id === assignmentId)?.is_presider
        apiFetch(`/organizer/tournament/${tournamentId}/pairings/${pairing.pairing_id}/scorers/${assignmentId}`, { method: 'DELETE' })
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
        apiFetch(`/organizer/tournament/${tournamentId}/pairings/${pairing.pairing_id}/presider`, {
            method: 'PUT', body: JSON.stringify({ assignment_id: presiderDraft, only_tiebreaker: onlyTiebreakerDraft }),
        })
        onPresiderChanged(presiderDraft, onlyTiebreakerDraft)
        setShowPresiderModal(false)
    }

    const sendLink = (assignmentId : string)=> {
        apiFetch(`/organizer/tournament/${tournamentId}/rounds/${roundId}/send-scoring-links/${assignmentId}`, {method: 'POST'})
        setSentLinks(new Set(sentLinks).add(assignmentId))
    }

    return (
        <>
        <div className="dash-pairing-card">
            <div className="pc-summary">
                <div className="pc-summary-matchup">
                    <span className="pc-pairing-label" aria-label={`Pairing ${pairingNumber}`}>{pairingNumber}</span>
                    <button type="button" className={`pc-summary-edit-target${prosecutionUnassigned ? ' pc-summary-edit-target--unassigned' : ''}`} aria-label="Edit matchup teams" onClick={beginTeamsEdit}>
                        <span className="dash-side-label">Prosecution</span>
                        <span className={`pc-summary-team${prosecutionUnassigned ? ' pc-summary-value--unassigned' : ''}`}>{teamName(pairing.p_team)}</span>
                        {teamReadinessChips(pairing.p_team)}
                        <span className="pc-summary-edit-hint">{prosecutionUnassigned ? 'Assign team' : 'Edit teams'}</span>
                    </button>
                    <button type="button" className={`pc-summary-edit-target${defenseUnassigned ? ' pc-summary-edit-target--unassigned' : ''}`} aria-label="Edit matchup teams" onClick={beginTeamsEdit}>
                        <span className="dash-side-label">Defense</span>
                        <span className={`pc-summary-team${defenseUnassigned ? ' pc-summary-value--unassigned' : ''}`}>{teamName(pairing.d_team)}</span>
                        {teamReadinessChips(pairing.d_team)}
                        <span className="pc-summary-edit-hint">{defenseUnassigned ? 'Assign team' : 'Edit teams'}</span>
                    </button>
                    <button type="button" className={`pc-summary-edit-target pc-summary-courtroom${courtroomUnassigned ? ' pc-summary-edit-target--unassigned' : ''}`} aria-label="Edit courtroom" onClick={beginCourtroomEdit}>
                        <span className="dash-side-label">Courtroom</span>
                        <span className={courtroomUnassigned ? 'pc-summary-value--unassigned' : undefined}>{courtroomName(pairing.courtroom)}</span>
                        {courtroomInUse && <span className="pc-courtroom-warning">Double-booked</span>}
                        <span className="pc-summary-edit-hint">{courtroomUnassigned ? 'Assign courtroom' : 'Edit courtroom'}</span>
                    </button>
                </div>
                <button
                    type="button"
                    className="pc-expand-btn"
                    aria-expanded={expanded}
                    onClick={() => setExpanded(value => !value)}
                >
                    {expanded ? 'Hide details' : 'Manage pairing'}
                    <span aria-hidden="true">{expanded ? '▴' : '▾'}</span>
                </button>
            </div>

            {!expanded && (
                <div className="pc-next-step">
                    <span><strong>Next step:</strong>{' '}
                        {!pairing.courtroom ? 'assign a courtroom' :
                            assignedScorers.length === 0 ? 'assign scorers' :
                                !hasPresider ? 'choose a presider' :
                                    courtroomInUse ? 'resolve the double-booked courtroom' :
                                        hasScorerConflict ? 'review scorer conflicts' :
                                            ballotStatus && ballotStatus.submitted < ballotStatus.total_scorers ? 'wait for submitted ballots' : 'this pairing is ready'}
                    </span>
                    {!pairing.courtroom ? (
                        <button type="button" className="pc-next-step-action" onClick={beginCourtroomEdit}>Assign courtroom</button>
                    ) : assignedScorers.length === 0 ? (
                        <button type="button" className="pc-next-step-action" onClick={openScorerAdd}>Assign scorers</button>
                    ) : !hasPresider ? (
                        <button type="button" className="pc-next-step-action" onClick={openPresiderModal}>Choose presider</button>
                    ) : (courtroomInUse || hasScorerConflict) ? (
                        <button type="button" className="pc-next-step-action" onClick={() => setExpanded(true)}>Review issue</button>
                    ) : null}
                </div>
            )}

            {expanded && <div className="pc-details">
            <div className="dash-pairing-topbar">
                <div className="pc-topbar-actions">
                    <button className="pc-download-ballot-btn" onClick={openBallot}>
                        <Icon name="Download" size={0.9} />
                        Download ballot
                    </button>
                    {!assignedScorers.some(s => s.is_presider) && (
                        <DangerButton onClick={onRemove}>Remove</DangerButton>
                    )}
                </div>
            </div>

            <div className="pc-scorers-section">
                <div className="pc-scorers-header">
                    <span className="pc-scorers-label">Scorers</span>
                    <button className="pc-save-btn" onClick={openScorerAdd}>Add scorer</button>
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
                            to={`/organizer/${tournamentId}/pairing/${pairing.pairing_id}/scoresheet${
                                round ? `?roundName=${encodeURIComponent(round.name)}${round.round_time ? `&roundTime=${encodeURIComponent(round.round_time)}` : ''}` : ''
                            }`}
                            className="pc-view-btn"
                        >
                            Combined scoresheet
                        </Link>
                    )}

                </div>

                {assignedScorers.length === 0 && <p className="pc-empty-scorers">Assign scorers to collect ballots. The first scorer added becomes the presider.</p>}

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
                        <span className="pc-scorer-name">
                            <Link to={`/organizer/${tournamentId}/scorers/${s.scorer_id}`}>{s.name}</Link>
                            {s.type === 'paper'
                                ? <span className="pc-scorer-type pc-scorer-type--paper">Paper</span>
                                : <span className="pc-scorer-type pc-scorer-type--online">Online</span>
                            }
                            {hasConflict && (
                                <span className="pc-conflict-badge">CONFLICT</span>
                            )}
                            {s.conflict_reported && (
                                <span className="pc-conflict-reported-badge">CONFLICT REPORTED</span>
                            )}
                            {isOnlineScorer && !hasSubmitted && round?.locked && linksSent && (
                                <button
                                    className={'pc-send-link'}
                                    onClick={() => sendLink(s.assignment_id)}
                                    title="Email this scorer their scoring link. Can be sent multiple times."
                                >
                                    {sentLinks.has(s.assignment_id) ? 'Resend link' : 'Send Scoring Link'}
                                </button>
                            ) }
                            {isOnlineScorer && <EmailStatusBadge status={s.email_status} />}
                        </span>

                        {diffLabel && <span className={`pc-diff ${diffClass}`}>{diffLabel}</span>}
                        {hasSubmitted && <Link
                            to={`/organizer/${tournamentId}/pairing/${pairing.pairing_id}/scoresheet/${s.ballot_id}`}
                            className="pc-view-btn"
                        >
                            View
                        </Link>}
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
            </div>}
        </div>

        {editingTeams && (
            <ModalBackdrop onClose={() => setEditingTeams(false)}>
                <div className="confirm-modal pc-edit-matchup-modal" role="dialog" aria-modal="true" aria-labelledby="edit-matchup-title">
                    <h2 id="edit-matchup-title">Edit matchup teams</h2>
                    <div className="pc-edit-matchup-fields">
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
                    </div>
                    <div className="confirm-actions">
                        <button type="button" className="btn-cancel" onClick={() => setEditingTeams(false)}>Cancel</button>
                        <button type="button" className="btn-confirm" onClick={saveTeamsEdit}>Save changes</button>
                    </div>
                </div>
            </ModalBackdrop>
        )}

        {editingCourtroom && (
            <ModalBackdrop onClose={() => setEditingCourtroom(false)}>
                <div className="confirm-modal pc-edit-matchup-modal" role="dialog" aria-modal="true" aria-labelledby="edit-courtroom-title">
                    <h2 id="edit-courtroom-title">Edit courtroom</h2>
                    <div className="pc-edit-courtroom-field">
                        <label className="rv-field-label" htmlFor={`courtroom-search-${pairing.pairing_id}`}>Search or create a courtroom</label>
                        <p className="pc-courtroom-help">Start typing to filter existing courtrooms. If it is not listed, create it from the name you enter.</p>
                        <div className="pc-courtroom-typeahead">
                            <input
                                id={`courtroom-search-${pairing.pairing_id}`}
                                className="rv-select"
                                ref={courtroomSelectRef}
                                value={courtroomQuery}
                                placeholder="Start typing a courtroom name"
                                onChange={event => { setCourtroomQuery(event.target.value); setCourtroomDraft('') }}
                            />
                            <div className="pc-courtroom-results">
                                <span className="pc-courtroom-results-label">Existing courtrooms</span>
                                {matchingCourtrooms.map(courtroom => {
                                    const label = `${courtroom.name}${courtroom.location ? ` (${courtroom.location})` : ''}`
                                    return <button key={courtroom.id} type="button" className={`pc-courtroom-option${courtroomDraft === courtroom.id ? ' pc-courtroom-option--selected' : ''}`} onClick={() => { setCourtroomDraft(courtroom.id); setCourtroomQuery(label) }}>{label}</button>
                                })}
                                {matchingCourtrooms.length === 0 && <span className="pc-courtroom-no-results">No matching courtrooms.</span>}
                                {courtroomQuery.trim() && !hasExactCourtroomName && (
                                    <button type="button" className="pc-create-courtroom-btn" disabled={creatingCourtroom} onClick={() => { void createCourtroom() }}>
                                        {creatingCourtroom ? 'Creating…' : `+ Create "${courtroomQuery.trim()}"`}
                                    </button>
                                )}
                            </div>
                        </div>
                        <button type="button" className={`pc-clear-courtroom-btn${courtroomDraft === '' ? ' pc-clear-courtroom-btn--selected' : ''}`} onClick={() => { setCourtroomDraft(''); setCourtroomQuery('') }}>
                            No courtroom assigned
                        </button>
                    </div>
                    <div className="confirm-actions">
                        <button type="button" className="btn-cancel" onClick={() => setEditingCourtroom(false)}>Cancel</button>
                        <button type="button" className="btn-confirm" onClick={saveCourtroomEdit}>Save changes</button>
                    </div>
                </div>
            </ModalBackdrop>
        )}

        {showScorerAdd && (
            <ModalBackdrop onClose={() => setShowScorerAdd(false)}>
                <div className="confirm-modal pc-add-scorer-modal" role="dialog" aria-modal="true" aria-labelledby="add-scorer-title">
                    <h2 id="add-scorer-title" className="pc-modal-title">Add Scorer</h2>
                    {scorerAddMode === 'existing' && <>
                    <p className="pc-modal-text--muted">Choose a scorer already in this tournament.</p>
                    <label className="rv-field-label pc-modal-field">
                        Scorer
                        <div className="pc-scorer-typeahead">
                            <input
                                className="rv-select pc-scorer-search"
                                ref={scorerSearchRef}
                                placeholder="Search scorers or type a name…"
                                value={scorerQuery}
                                onChange={e => { setScorerQuery(e.target.value); setScorerDraft('') }}
                            />
                            {scorerQuery.trim() && <div className="pc-scorer-results">
                                {(() => {
                                    const q = scorerQuery.trim().toLowerCase()
                                    const matches = q === '' || scorerDraft
                                        ? availableScorers
                                        : availableScorers.filter(s =>
                                            s.name.toLowerCase().includes(q)
                                        )
                                    if (matches.length === 0) {
                                        return <p className="pc-scorer-results-empty">No matching scorers</p>
                                    }
                                    return (
                                        <ul className="pc-scorer-options">
                                            {matches.map(s => {
                                                const selected = s.scorer_id === scorerDraft
                                                return (
                                                    <li key={s.scorer_id}>
                                                        <button
                                                            type="button"
                                                            className={`pc-scorer-option${selected ? ' pc-scorer-option--selected' : ''}`}
                                                            onClick={() => { setScorerDraft(s.scorer_id); setScorerQuery(s.name) }}
                                                        >
                                                            {s.name}
                                                        </button>
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    )
                                })()}
                            </div>}
                        </div>
                    </label>
                    <button type="button" className="pc-create-offline-btn" onClick={() => { setScorerDraft(''); setScorerAddMode('create') }}>Create a new scorer instead</button>
                    </>}

                    {scorerAddMode === 'create' && (
                        <>
                            <p className="pc-modal-text--muted">Create the scorer, then assign them to this pairing.</p>
                            <label className="rv-field-label pc-modal-field" htmlFor="new-scorer-name">
                                Scorer name
                                <input id="new-scorer-name" className="rv-select" ref={scorerSearchRef}
                                    value={scorerQuery} onChange={e => setScorerQuery(e.target.value)} placeholder="Full name" />
                            </label>
                            <label className="sc-checkbox-label">
                                <input type="checkbox" checked={newScorerIsPaper}
                                    onChange={e => setNewScorerIsPaper(e.target.checked)} />
                                Paper (offline) scorer — no email, scores on paper
                            </label>
                            {!newScorerIsPaper && (
                                <label className="rv-field-label pc-modal-field" htmlFor="new-scorer-email">
                                    Email
                                    <input id="new-scorer-email" type="email" className="rv-select"
                                        value={newScorerEmail} onChange={e => setNewScorerEmail(e.target.value)}
                                        placeholder="scorer@example.com" />
                                    {newScorerEmail && !isValidEmail(newScorerEmail) && <span className="tc-field-error">Invalid email address</span>}
                                </label>
                            )}
                            <button
                                className="pc-create-offline-btn"
                                disabled={!scorerQuery.trim() || (!newScorerIsPaper && !isValidEmail(newScorerEmail))}
                                onClick={createScorer}
                            >
                                + Create scorer{scorerQuery.trim() ? ` "${scorerQuery.trim()}"` : ''}
                            </button>
                        </>
                    )}

                    <div className="confirm-actions">
                        <button type="button" onClick={() => setShowScorerAdd(false)}>Cancel</button>
                        {scorerAddMode === 'existing'
                            ? <button disabled={!scorerDraft} onClick={() => addRegisteredScorer()}>Add scorer</button>
                            : <button type="button" onClick={() => setScorerAddMode('existing')}>Back to search</button>}
                    </div>
                </div>
            </ModalBackdrop>
        )}

        {showPresiderModal && (
            <ModalBackdrop onClose={() => setShowPresiderModal(false)}>
                <div className="confirm-modal pc-presider-modal" role="dialog" aria-modal="true" aria-labelledby="presider-title">
                    <h2 id="presider-title" className="pc-modal-title">Change Presider</h2>
                    <label className="rv-field-label pc-modal-field">
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
                    <h2 id="manual-entry-title" className="pc-modal-title">Manually Enter Scores</h2>
                    <p className="pc-modal-text--tight">
                        You are about to manually enter scores for <strong>{manualEntryScorer.name}</strong>.
                    </p>
                    <p className="pc-modal-text--muted">
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
                    <h2 id="remove-scorer-title" className="pc-modal-title">Remove Scorer</h2>
                    <p className="pc-modal-text">
                        Remove <strong>{removeScorerTarget.name}</strong> from this pairing?
                    </p>
                    <div className="confirm-actions">
                        <button onClick={() => setRemoveScorerTarget(null)}>Cancel</button>
                        <button onClick={() => { removeScorer(removeScorerTarget.assignmentId); setRemoveScorerTarget(null) }} className="pc-modal-remove-btn">
                            Remove
                        </button>
                    </div>
                </div>
            </ModalBackdrop>
        )}
        </>
    )
}
