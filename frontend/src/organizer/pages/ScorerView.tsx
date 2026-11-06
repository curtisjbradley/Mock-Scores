import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import type { IConflict, IScorer, IScorerAssignmentSummary, IScorerDetail, ITeam } from '@mock-scores/shared'
import { apiFetch } from '../../auth/auth'
import { isValidEmail } from '../../utils/validation'
import { ConfirmRemoveModal } from '../components/modals'
import DangerButton from '../../shared/components/DangerButton'
import ModalBackdrop from '../../shared/components/ModalBackdrop'
import { useConfirmRemove } from '../../shared/hooks/useConfirmRemove'
import type { ScorerDraft } from '../tabs/ScorersTab'
import '../styles/organizer.css'
import '../styles/tabs.css'
import '../styles/standings.css'
import '../styles/tournament-create.css'
import '../../judges/styles/modal.css'
import '../styles/scorer-view.css'

type EditorSection = 'details' | 'notes' | 'preferences'

/** Detailed organizer view for one scorer and every one of their assignments. */
export default function ScorerView() {
    const { id: tournamentId, scorerId } = useParams<{ id: string; scorerId: string }>()
    const navigate = useNavigate()
    const [scorers, setScorers] = useState<IScorer[]>([])
    const [assignments, setAssignments] = useState<IScorerDetail['assignments']>([])
    const [conflicts, setConflicts] = useState<IConflict[]>([])
    const [teams, setTeams] = useState<ITeam[]>([])
    const [availablePairings, setAvailablePairings] = useState<IScorerDetail['available_pairings']>([])
    const [showAddAssignment, setShowAddAssignment] = useState(false)
    const [assignmentRoundId, setAssignmentRoundId] = useState('')
    const [assignmentPairingId, setAssignmentPairingId] = useState('')
    const [assignmentToRemove, setAssignmentToRemove] = useState<IScorerAssignmentSummary | null>(null)
    const [updatingAssignmentId, setUpdatingAssignmentId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [editingSections, setEditingSections] = useState<Set<EditorSection>>(new Set())
    const confirmRemove = useConfirmRemove<IScorer>()
    const scorer = scorers.find(candidate => candidate.scorer_id === scorerId)
    const { register, handleSubmit, reset, resetField, setValue, watch, formState: { errors } } = useForm<ScorerDraft>({
        defaultValues: { name: '', email: '', isPaper: false, willingToPreside: true, prefersToScoreWith: [], notes: '' },
    })
    const isPaper = watch('isPaper')
    const preferredScorerIds = watch('prefersToScoreWith') ?? []
    const conflictTeamLabel = (conflict: IConflict) => {
        const code = teams.find(team => team.id === conflict.team_id)?.code
        return code ? `${conflict.team_name} (${code})` : conflict.team_name
    }
    const toggleEditingSection = (section: EditorSection) => setEditingSections(previous => {
        const next = new Set(previous)
        if (next.has(section)) next.delete(section)
        else next.add(section)
        return next
    })
    const cancelEditingSection = (section: EditorSection) => {
        if (!scorer) return
        if (section === 'details') {
            resetField('name', { defaultValue: scorer.name })
            resetField('email', { defaultValue: scorer.email ?? '' })
            resetField('isPaper', { defaultValue: scorer.is_paper })
            resetField('willingToPreside', { defaultValue: scorer.willing_to_preside })
        } else if (section === 'notes') {
            resetField('notes', { defaultValue: scorer.notes })
        } else {
            resetField('prefersToScoreWith', { defaultValue: scorer.prefers_to_score_with ?? [] })
        }
        setEditingSections(previous => {
            const next = new Set(previous)
            next.delete(section)
            return next
        })
    }

    const load = useCallback(() => {
        if (!tournamentId || !scorerId) return
        apiFetch(`/organizer/tournament/${tournamentId}/scorers/${scorerId}`).then(async response => {
            if (!response.ok) throw new Error('Unable to load scorer.')
            const data = await response.json() as IScorerDetail
            setScorers(data.scorers)
            setAssignments(data.assignments)
            setConflicts(data.conflicts ?? [])
            setTeams(data.teams ?? [])
            setAvailablePairings(data.available_pairings ?? [])
        }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load scorer.'))
    }, [scorerId, tournamentId])

    useEffect(() => { load() }, [load])

    useEffect(() => {
        if (!scorer) return
        reset({
            name: scorer.name,
            email: scorer.email ?? '',
            isPaper: scorer.is_paper,
            willingToPreside: scorer.willing_to_preside,
            prefersToScoreWith: scorer.prefers_to_score_with ?? [],
            notes: scorer.notes,
        })
        setEditingSections(new Set())
    }, [reset, scorer])

    const save = async (draft: ScorerDraft) => {
        if (!scorer || !tournamentId) return
        setSaving(true)
        setError(null)
        const updated: IScorer = {
            ...scorer,
            name: draft.name.trim(),
            email: draft.isPaper ? null : draft.email.trim(),
            is_paper: draft.isPaper,
            willing_to_preside: draft.willingToPreside,
            prefers_to_score_with: draft.prefersToScoreWith,
            notes: draft.notes.trim(),
        }
        try {
            const response = await apiFetch(`/organizer/tournament/${tournamentId}/scorers`, { method: 'PUT', body: JSON.stringify(updated) })
            if (!response.ok) throw new Error('Unable to save scorer.')
            setScorers(previous => previous.map(candidate => candidate.scorer_id === updated.scorer_id ? updated : candidate))
            setEditingSections(new Set())
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : 'Unable to save scorer.')
        } finally {
            setSaving(false)
        }
    }

    const remove = async () => {
        if (!confirmRemove.pending || !tournamentId) return
        setSaving(true)
        try {
            const response = await apiFetch(`/organizer/tournament/${tournamentId}/scorers`, {
                method: 'DELETE', body: JSON.stringify({ scorer_id: confirmRemove.pending.scorer_id }),
            })
            if (!response.ok) throw new Error('Unable to remove scorer.')
            navigate(`/organizer/${tournamentId}?page=scorers`)
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : 'Unable to remove scorer.')
        } finally {
            setSaving(false)
        }
    }

    const addConflict = async (team: ITeam) => {
        try {
            const response = await apiFetch(`/organizer/tournament/${tournamentId}/scorers/${scorerId}/conflicts`, {
                method: 'POST', body: JSON.stringify({ team_id: team.id }),
            })
            if (!response.ok) throw new Error('Unable to add conflict.')
            const conflict = await response.json() as IConflict
            setConflicts(previous => [...previous, conflict])
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : 'Unable to add conflict.')
        }
    }

    const removeConflict = async (conflict: IConflict) => {
        try {
            const response = await apiFetch(`/organizer/tournament/${tournamentId}/scorers/${scorerId}/conflicts`, {
                method: 'DELETE', body: JSON.stringify({ team_id: conflict.team_id }),
            })
            if (!response.ok) throw new Error('Unable to remove conflict.')
            setConflicts(previous => previous.filter(item => item.team_id !== conflict.team_id))
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : 'Unable to remove conflict.')
        }
    }

    const openAddAssignment = () => {
        setAssignmentRoundId('')
        setAssignmentPairingId('')
        setShowAddAssignment(true)
    }

    const selectedRoundPairings = availablePairings.filter(pairing => pairing.round_id === assignmentRoundId)
    const selectedPairing = selectedRoundPairings.find(pairing => pairing.pairing_id === assignmentPairingId)
    const assignmentRounds = [...new Map(availablePairings.map(pairing => [pairing.round_id, pairing.round_name])).entries()]

    const addAssignment = async () => {
        if (!assignmentPairingId || !scorerId) return
        setSaving(true)
        setError(null)
        try {
            const response = await apiFetch(`/organizer/tournament/${tournamentId}/pairings/${assignmentPairingId}/scorers`, {
                method: 'POST', body: JSON.stringify({ scorer_id: scorerId }),
            })
            if (!response.ok) throw new Error('Unable to add assignment.')
            setShowAddAssignment(false)
            load()
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : 'Unable to add assignment.')
        } finally {
            setSaving(false)
        }
    }

    const makePresider = async (assignment: IScorerAssignmentSummary) => {
        setUpdatingAssignmentId(assignment.assignment_id)
        setError(null)
        try {
            const response = await apiFetch(`/organizer/tournament/${tournamentId}/pairings/${assignment.pairing_id}/presider`, {
                method: 'PUT', body: JSON.stringify({ assignment_id: assignment.assignment_id }),
            })
            if (!response.ok) throw new Error('Unable to make scorer the presider.')
            load()
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : 'Unable to make scorer the presider.')
        } finally {
            setUpdatingAssignmentId(null)
        }
    }

    const removeAssignment = async () => {
        if (!assignmentToRemove) return
        setUpdatingAssignmentId(assignmentToRemove.assignment_id)
        setError(null)
        try {
            const response = await apiFetch(`/organizer/tournament/${tournamentId}/pairings/${assignmentToRemove.pairing_id}/scorers/${assignmentToRemove.assignment_id}`, {
                method: 'DELETE',
            })
            if (!response.ok) throw new Error('Unable to remove assignment.')
            setAssignmentToRemove(null)
            load()
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : 'Unable to remove assignment.')
        } finally {
            setUpdatingAssignmentId(null)
        }
    }

    if (!tournamentId || !scorerId) return null
    if (!scorer && !error) return <div className="org-main"><p>Loading scorer…</p></div>
    if (!scorer) return <div className="org-main"><p className="org-error" role="alert">{error}</p></div>

    return (
        <div className="org-main">
            <section className="org-container scorer-view">
                <Link className="org-back-btn" to={`/organizer/${tournamentId}?page=scorers`}>View All Scorers</Link>
                <header className="scorer-view__header">
                    <div className="scorer-view__title">
                        <span className={`sc-type-badge ${scorer.is_paper ? 'sc-type-badge--paper' : 'sc-type-badge--online'}`}>{scorer.is_paper ? 'Paper scorer' : 'Online scorer'}</span>
                        <h1>{scorer.name}</h1>
                        <p>{scorer.email ?? 'No email address'}</p>
                    </div>
                    <div className="scorer-view__actions">
                        <DangerButton variant="outline" onClick={() => confirmRemove.open(scorer)}>Remove scorer</DangerButton>
                    </div>
                </header>
                {error && <p className="org-error" role="alert">{error}</p>}

                <form className="scorer-view__editor" onSubmit={event => event.preventDefault()} noValidate>
                    <section className="scorer-view__editor-section">
                        <div className="scorer-view__editor-heading"><h2>Scorer details</h2>{editingSections.has('details') ? <div className="scorer-view__editor-actions"><button type="button" className="btn-primary" disabled={saving} onClick={handleSubmit(draft => { void save(draft) })}>{saving ? 'Saving…' : 'Save'}</button><button type="button" className="btn-secondary" disabled={saving} onClick={() => cancelEditingSection('details')}>Cancel</button></div> : <button type="button" className="btn-secondary" onClick={() => toggleEditingSection('details')}>Edit</button>}</div>
                        {editingSections.has('details') ? <>
                        <div className="scorer-view__field-grid">
                            <div className="tc-field">
                                <label className="tc-label" htmlFor="scorer-view-name">Name</label>
                                <input id="scorer-view-name" className="tc-input" {...register('name', { required: 'Name is required' })} />
                                {errors.name && <span className="tc-field-error">{errors.name.message}</span>}
                            </div>
                            {!isPaper && <div className="tc-field">
                                <label className="tc-label" htmlFor="scorer-view-email">Email</label>
                                <input id="scorer-view-email" type="email" className="tc-input" {...register('email', {
                                    validate: value => isValidEmail(value) || 'Invalid email address',
                                })} />
                                {errors.email && <span className="tc-field-error">{errors.email.message}</span>}
                            </div>}
                        </div>
                        <div className="scorer-view__options">
                            <label className="sc-checkbox-label"><input type="checkbox" {...register('isPaper')} /> Paper (offline) scorer</label>
                            <label className="sc-checkbox-label"><input type="checkbox" {...register('willingToPreside')} /> Willing to preside</label>
                        </div>
                        </> : <dl className="scorer-view__summary">
                            <div><dt>Name</dt><dd>{scorer.name}</dd></div>
                            <div><dt>Email</dt><dd>{scorer.email ?? 'No email address'}</dd></div>
                            <div><dt>Type</dt><dd>{scorer.is_paper ? 'Paper (offline)' : 'Online'}</dd></div>
                            <div><dt>Presiding preference</dt><dd>{scorer.willing_to_preside ? 'Willing to preside' : 'Does not wish to preside'}</dd></div>
                        </dl>}
                    </section>

                    <section className="scorer-view__editor-section">
                        <div className="scorer-view__editor-heading"><h2>Conflicts</h2></div>
                        {conflicts.length > 0 ? <ul className="sc-conflict-list">
                            {conflicts.map(conflict => <li key={conflict.team_id} className="sc-conflict-item">
                                <span><Link to={`/organizer/${tournamentId}/team/${conflict.team_id}`}> {conflictTeamLabel(conflict)}</Link></span>
                                <DangerButton onClick={() => { void removeConflict(conflict) }}>Remove</DangerButton>
                            </li>)}
                        </ul> : <p className="scorer-view__notes">No team conflicts.</p>}
                        {teams.filter(team => !conflicts.some(conflict => conflict.team_id === team.id)).length > 0 && <div className="tc-field scorer-view__add-conflict">
                            <label className="tc-label" htmlFor="scorer-view-add-conflict">Add conflicting team</label>
                            <select id="scorer-view-add-conflict" className="tc-input" defaultValue="" onChange={event => {
                                const team = teams.find(candidate => candidate.id === event.target.value)
                                if (team) { void addConflict(team); event.target.value = '' }
                            }}>
                                <option value="" disabled>Select a team…</option>
                                {teams.filter(team => !conflicts.some(conflict => conflict.team_id === team.id)).map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                            </select>
                        </div>}
                    </section>

                    <section className="scorer-view__editor-section">
                        <div className="scorer-view__editor-heading"><h2>Notes</h2>{editingSections.has('notes') ? <div className="scorer-view__editor-actions"><button type="button" className="btn-primary" disabled={saving} onClick={handleSubmit(draft => { void save(draft) })}>{saving ? 'Saving…' : 'Save'}</button><button type="button" className="btn-secondary" disabled={saving} onClick={() => cancelEditingSection('notes')}>Cancel</button></div> : <button type="button" className="btn-secondary" onClick={() => toggleEditingSection('notes')}>Edit</button>}</div>
                        {editingSections.has('notes') ? <div className="tc-field">
                            <label className="tc-label" htmlFor="scorer-view-notes">Notes</label>
                            <textarea id="scorer-view-notes" className="tc-input" {...register('notes')} placeholder="Organizer notes" />
                        </div> : <p className="scorer-view__notes">{scorer.notes || 'No notes'}</p>}
                    </section>

                    <section className="scorer-view__editor-section">
                        <div className="scorer-view__editor-heading"><h2>Co-scorer preferences</h2>{editingSections.has('preferences') ? <div className="scorer-view__editor-actions"><button type="button" className="btn-primary" disabled={saving} onClick={handleSubmit(draft => { void save(draft) })}>{saving ? 'Saving…' : 'Save'}</button><button type="button" className="btn-secondary" disabled={saving} onClick={() => cancelEditingSection('preferences')}>Cancel</button></div> : <button type="button" className="btn-secondary" onClick={() => toggleEditingSection('preferences')}>Edit</button>}</div>
                        {editingSections.has('preferences') ? <>
                        <p>Select scorers this judge prefers to score with.</p>
                        <ul className="sc-pref-list">
                            {scorers.filter(candidate => candidate.scorer_id !== scorer.scorer_id).map(candidate => (
                                <li key={candidate.scorer_id}>
                                    <label className="sc-checkbox-label">
                                        <input type="checkbox" checked={preferredScorerIds.includes(candidate.scorer_id)} onChange={() => {
                                            setValue('prefersToScoreWith', preferredScorerIds.includes(candidate.scorer_id)
                                                ? preferredScorerIds.filter(id => id !== candidate.scorer_id)
                                                : [...preferredScorerIds, candidate.scorer_id])
                                        }} />
                                        {candidate.name}
                                    </label>
                                </li>
                            ))}
                            {scorers.length === 1 && <li className="sc-conflict-empty">No other scorers yet.</li>}
                        </ul>
                        </> : <p className="scorer-view__notes">{scorers.filter(candidate => preferredScorerIds.includes(candidate.scorer_id)).map(candidate => <Link key={candidate.scorer_id} className="scorer-view-pairing-pref" to={`/organizer/${tournamentId}/scorers/${candidate.scorer_id}`}>{candidate.name}</Link>) || 'No preferences set'}</p>}
                    </section>

                </form>

                <section className="scorer-view__assignments">
                    <div className="scorer-view__section-heading">
                        <div>
                            <h2>Round assignments</h2>
                            <p>Every pairing this scorer is assigned to.</p>
                        </div>
                        <span>{assignments.length} assignment{assignments.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="dash-table-scroll scorer-view__table">
                        <table className="dash-standings-table">
                            <thead><tr><th>Round</th><th>P</th><th>D</th><th>Courtroom</th><th>Other scorers</th><th>Presiding</th><th>Actions</th></tr></thead>
                            <tbody>
                                {assignments.map(assignment => (
                                    <tr key={assignment.assignment_id}>
                                        <td data-label="Round"><Link to={`/organizer/${tournamentId}/round/${assignment.round_id}`}>{assignment.round_name}</Link></td>
                                        <td data-label="P"><Link to={`/organizer/${tournamentId}/team/${assignment.prosecution_id}`}>{assignment.prosecution}</Link></td>
                                        <td data-label="D"><Link to={`/organizer/${tournamentId}/team/${assignment.defense_id}`}>{assignment.defense}</Link></td>
                                        <td data-label="Courtroom">{assignment.courtroom ?? '—'}</td>
                                        <td data-label="Other scorers">{assignment.other_scorers.length > 0
                                            ? assignment.other_scorers.map((otherScorer, index) => <span key={otherScorer.scorer_id}>{index > 0 && ', '}<Link to={`/organizer/${tournamentId}/scorers/${otherScorer.scorer_id}`}>{otherScorer.name}</Link></span>)
                                            : '—'}</td>
                                        <td data-label="Presiding">
                                            {assignment.is_presider
                                                ? <span className="scorer-view__presider-status">Presider</span>
                                                : <button type="button" className="btn-secondary scorer-view__make-presider" disabled={updatingAssignmentId === assignment.assignment_id} onClick={() => { void makePresider(assignment) }}>{updatingAssignmentId === assignment.assignment_id ? 'Updating…' : 'Make presider'}</button>}
                                        </td>
                                        <td data-label="Actions">
                                            <div className="scorer-view__assignment-actions">
                                                {assignment.ballot_id
                                                    ? <Link className="btn-secondary" to={`/organizer/${tournamentId}/pairing/${assignment.pairing_id}/scoresheet/${assignment.ballot_id}`}>View submitted ballot</Link>
                                                    : <>
                                                        <Link className="btn-secondary" to={`/score/${assignment.assignment_id}`} target="_blank" rel="noopener noreferrer">Enter ballot</Link>
                                                        <DangerButton disabled={updatingAssignmentId === assignment.assignment_id} onClick={() => setAssignmentToRemove(assignment)}>Remove assignment</DangerButton>
                                                    </>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {assignments.length === 0 && <tr><td colSpan={7}>This scorer has not been assigned to a round.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                    <button type="button" className="btn-secondary scorer-view__add-assignment" onClick={openAddAssignment}>+ Add assignment</button>
                </section>

                {confirmRemove.pending && <ConfirmRemoveModal message={`Remove ${scorer.name} from the scorer list?`} onCancel={confirmRemove.clear} onConfirm={() => { void remove() }} />}
                {showAddAssignment && <ModalBackdrop onClose={() => { if (!saving) setShowAddAssignment(false) }} dismissible={!saving}>
                    <div className="confirm-modal scorer-view__assignment-modal" role="dialog" aria-modal="true" aria-labelledby="add-assignment-title">
                        <h2 id="add-assignment-title">Add assignment</h2>
                        <div className="tc-field">
                            <label className="tc-label" htmlFor="assignment-round">Round</label>
                            <select id="assignment-round" className="tc-input" value={assignmentRoundId} onChange={event => {
                                setAssignmentRoundId(event.target.value)
                                setAssignmentPairingId('')
                            }}>
                                <option value="" disabled>Select a round…</option>
                                {assignmentRounds.map(([roundId, roundName]) => <option key={roundId} value={roundId}>{roundName}</option>)}
                            </select>
                        </div>
                        {assignmentRoundId && <div className="tc-field">
                            <label className="tc-label" htmlFor="assignment-pairing">Pairing</label>
                            <select id="assignment-pairing" className="tc-input" value={assignmentPairingId} onChange={event => setAssignmentPairingId(event.target.value)}>
                                <option value="" disabled>Select a pairing…</option>
                                {selectedRoundPairings.map(pairing => <option key={pairing.pairing_id} value={pairing.pairing_id}>{pairing.prosecution} v. {pairing.defense} — {pairing.courtroom ?? 'No courtroom'}</option>)}
                            </select>
                        </div>}
                        {selectedPairing && <dl className="scorer-view__pairing-preview">
                            <div><dt>P</dt><dd>{selectedPairing.prosecution}</dd></div>
                            <div><dt>D</dt><dd>{selectedPairing.defense}</dd></div>
                            <div><dt>Courtroom</dt><dd>{selectedPairing.courtroom ?? 'No courtroom assigned'}</dd></div>
                            <div><dt>Current scorers</dt><dd>{selectedPairing.scorer_count}</dd></div>
                        </dl>}
                        <div className="confirm-actions">
                            <button type="button" onClick={() => setShowAddAssignment(false)} disabled={saving}>Cancel</button>
                            <button type="button" onClick={() => { void addAssignment() }} disabled={!assignmentPairingId || saving}>{saving ? 'Adding…' : 'Add assignment'}</button>
                        </div>
                    </div>
                </ModalBackdrop>}
                {assignmentToRemove && <ConfirmRemoveModal
                    message={`Remove ${scorer.name} from the ${assignmentToRemove.round_name} assignment?`}
                    onCancel={() => setAssignmentToRemove(null)}
                    onConfirm={() => { void removeAssignment() }}
                />}
            </section>
        </div>
    )
}
