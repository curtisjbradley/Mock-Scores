import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import type { ICourtroom, IPairing, IRound, ITeam } from '@mock-scores/shared'
import { apiFetch } from '../../auth/auth'
import { ConfirmRemoveModal } from '../components/modals'
import DangerButton from '../../shared/components/DangerButton'
import ModalBackdrop from '../../shared/components/ModalBackdrop'
import { useConfirmRemove } from '../../shared/hooks/useConfirmRemove'
import '../styles/organizer.css'
import '../styles/tabs.css'
import '../styles/standings.css'
import '../styles/tournament-create.css'
import '../../judges/styles/modal.css'
import '../styles/scorer-view.css'
import '../styles/courtroom-view.css'

interface RoundListEntry extends IRound {
    readiness: { pairings: number }
}

interface CourtroomDraft {
    name: string
    location: string
}

interface TrialDraft {
    roundId: string
    pairingId: string
}

interface ReassignTrialDraft {
    pairingId: string
    courtroomId: string
}

/** Organizer view for a courtroom, its details, and every trial assigned to it. */
export default function CourtroomView() {
    const { id: tournamentId, courtroomId } = useParams<{ id: string; courtroomId: string }>()
    const navigate = useNavigate()
    const [courtroom, setCourtroom] = useState<ICourtroom | null>(null)
    const [courtrooms, setCourtrooms] = useState<ICourtroom[]>([])
    const [rounds, setRounds] = useState<IRound[]>([])
    const [teams, setTeams] = useState<ITeam[]>([])
    const [pairings, setPairings] = useState<IPairing[]>([])
    const [showAddTrial, setShowAddTrial] = useState(false)
    const [showReassignTrial, setShowReassignTrial] = useState(false)
    const [editingDetails, setEditingDetails] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const confirmRemove = useConfirmRemove<ICourtroom>()
    const detailsForm = useForm<CourtroomDraft>({ defaultValues: { name: '', location: '' } })
    const trialForm = useForm<TrialDraft>({ defaultValues: { roundId: '', pairingId: '' } })
    const reassignTrialForm = useForm<ReassignTrialDraft>({ defaultValues: { pairingId: '', courtroomId: '' } })
    const selectedRoundId = trialForm.watch('roundId')
    const selectedPairingId = trialForm.watch('pairingId')

    const load = useCallback(async () => {
        if (!tournamentId || !courtroomId) return
        setError(null)
        try {
            const [courtroomsResponse, roundsResponse, teamsResponse] = await Promise.all([
                apiFetch(`/organizer/tournament/${tournamentId}/courtrooms`),
                apiFetch(`/organizer/tournament/${tournamentId}/rounds`),
                apiFetch(`/organizer/tournament/${tournamentId}/teams`),
            ])
            if (!courtroomsResponse.ok || !roundsResponse.ok || !teamsResponse.ok) throw new Error('Unable to load courtroom.')
            const [courtrooms, roundEntries, teams] = await Promise.all([
                courtroomsResponse.json() as Promise<ICourtroom[]>,
                roundsResponse.json() as Promise<RoundListEntry[]>,
                teamsResponse.json() as Promise<ITeam[]>,
            ])
            const foundCourtroom = courtrooms.find(candidate => candidate.id === courtroomId)
            if (!foundCourtroom) throw new Error('Courtroom not found.')
            const loadedRounds: IRound[] = roundEntries
            const pairingResponses = await Promise.all(loadedRounds.map(round => apiFetch(`/organizer/tournament/${tournamentId}/rounds/${round.round_id}/pairings`)))
            if (pairingResponses.some(response => !response.ok)) throw new Error('Unable to load courtroom trials.')
            const pairingGroups = await Promise.all(pairingResponses.map(response => response.json() as Promise<IPairing[]>))
            setCourtroom(foundCourtroom)
            setCourtrooms(courtrooms)
            setRounds(loadedRounds)
            setTeams(teams)
            setPairings(pairingGroups.flat())
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : 'Unable to load courtroom.')
        }
    }, [courtroomId, tournamentId])

    useEffect(() => { void load() }, [load])
    useEffect(() => {
        if (!courtroom) return
        detailsForm.reset({ name: courtroom.name, location: courtroom.location ?? '' })
        setEditingDetails(false)
    }, [courtroom, detailsForm])
    useEffect(() => { trialForm.setValue('pairingId', '') }, [selectedRoundId, trialForm])

    const teamName = useCallback((teamId: string) => {
        const team = teams.find(candidate => candidate.id === teamId)
        return team ? `${team.name}${team.code ? ` (${team.code})` : ''}` : 'Unknown team'
    }, [teams])
    const courtroomName = useCallback((id: string | null) => {
        if (!id) return 'No courtroom assigned'
        return courtrooms.find(candidate => candidate.id === id)?.name ?? 'Unknown courtroom'
    }, [courtrooms])
    const trials = useMemo(() => pairings.filter(pairing => pairing.courtroom === courtroomId), [courtroomId, pairings])
    const doubleBookedRoundIds = useMemo(() => new Set(trials
        .filter(pairing => trials.filter(candidate => candidate.round_id === pairing.round_id).length > 1)
        .map(pairing => pairing.round_id)), [trials])
    const availableTrials = useMemo(() => pairings.filter(pairing => pairing.round_id === selectedRoundId && pairing.courtroom !== courtroomId), [pairings, selectedRoundId, courtroomId])

    const saveDetails = async (draft: CourtroomDraft) => {
        if (!courtroom || !tournamentId) return
        setSaving(true)
        setError(null)
        const updated: ICourtroom = { ...courtroom, name: draft.name.trim(), location: draft.location.trim() }
        try {
            const response = await apiFetch(`/organizer/tournament/${tournamentId}/courtrooms`, { method: 'PUT', body: JSON.stringify(updated) })
            if (!response.ok) throw new Error('Unable to save courtroom.')
            setCourtroom(updated)
            setEditingDetails(false)
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : 'Unable to save courtroom.')
        } finally {
            setSaving(false)
        }
    }

    const assignTrial = async (draft: TrialDraft) => {
        const pairing = pairings.find(candidate => candidate.pairing_id === draft.pairingId)
        if (!pairing || !tournamentId || !courtroomId) return
        setSaving(true)
        setError(null)
        try {
            const response = await apiFetch(`/organizer/tournament/${tournamentId}/pairings/${pairing.pairing_id}`, {
                method: 'PUT', body: JSON.stringify({ prosectionID: pairing.p_team, defenseID: pairing.d_team, courtroomID: courtroomId }),
            })
            if (!response.ok) throw new Error('Unable to assign trial to this courtroom.')
            setShowAddTrial(false)
            await load()
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : 'Unable to assign trial to this courtroom.')
        } finally {
            setSaving(false)
        }
    }

    const updateTrialCourtroom = async (pairing: IPairing, nextCourtroomId: string | null, failureMessage: string) => {
        if (!tournamentId) return false
        setSaving(true)
        setError(null)
        try {
            const response = await apiFetch(`/organizer/tournament/${tournamentId}/pairings/${pairing.pairing_id}`, {
                method: 'PUT', body: JSON.stringify({ prosectionID: pairing.p_team, defenseID: pairing.d_team, courtroomID: nextCourtroomId }),
            })
            if (!response.ok) throw new Error(failureMessage)
            await load()
            return true
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : failureMessage)
            return false
        } finally {
            setSaving(false)
        }
    }

    const unassignTrial = async (pairing: IPairing) => {
        await updateTrialCourtroom(pairing, null, 'Unable to unassign trial from this courtroom.')
    }

    const reassignTrial = async (draft: ReassignTrialDraft) => {
        const pairing = pairings.find(candidate => candidate.pairing_id === draft.pairingId)
        if (!pairing) return
        if (await updateTrialCourtroom(pairing, draft.courtroomId, 'Unable to reassign trial.')) setShowReassignTrial(false)
    }

    const remove = async () => {
        if (!confirmRemove.pending || !tournamentId) return
        setSaving(true)
        try {
            const response = await apiFetch(`/organizer/tournament/${tournamentId}/courtrooms`, { method: 'DELETE', body: JSON.stringify(confirmRemove.pending) })
            if (!response.ok) throw new Error('Unable to remove courtroom.')
            navigate(`/organizer/${tournamentId}?page=courtrooms`)
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : 'Unable to remove courtroom.')
        } finally {
            setSaving(false)
        }
    }

    const openAddTrial = () => {
        trialForm.reset({ roundId: '', pairingId: '' })
        setShowAddTrial(true)
    }

    const openReassignTrial = (pairing: IPairing) => {
        reassignTrialForm.reset({ pairingId: pairing.pairing_id, courtroomId: '' })
        setShowReassignTrial(true)
    }

    if (!tournamentId || !courtroomId) return null
    if (!courtroom && !error) return <div className="org-main"><p>Loading courtroom…</p></div>
    if (!courtroom) return <div className="org-main"><p className="org-error" role="alert">{error}</p></div>

    return <div className="org-main">
        <section className="org-container scorer-view courtroom-view">
            <Link className="org-back-btn" to={`/organizer/${tournamentId}?page=courtrooms`}>View All Courtrooms</Link>
            <header className="scorer-view__header">
                <div className="scorer-view__title"><h1>{courtroom.name}</h1><p>{courtroom.location || 'No details'}</p></div>
                <div className="scorer-view__actions"><DangerButton variant="outline" onClick={() => confirmRemove.open(courtroom)}>Remove courtroom</DangerButton></div>
            </header>
            {error && <p className="org-error" role="alert">{error}</p>}

            <section className="scorer-view__editor-section">
                <div className="scorer-view__editor-heading"><h2>Courtroom details</h2>{editingDetails ? <div className="scorer-view__editor-actions"><button type="button" className="btn-primary" disabled={saving} onClick={detailsForm.handleSubmit(draft => { void saveDetails(draft) })}>{saving ? 'Saving…' : 'Save'}</button><button type="button" className="btn-secondary" disabled={saving} onClick={() => { detailsForm.reset({ name: courtroom.name, location: courtroom.location ?? '' }); setEditingDetails(false) }}>Cancel</button></div> : <button type="button" className="btn-secondary" onClick={() => setEditingDetails(true)}>Edit</button>}</div>
                {editingDetails ? <form className="scorer-view__field-grid" onSubmit={detailsForm.handleSubmit(draft => { void saveDetails(draft) })} noValidate>
                    <div className="tc-field"><label className="tc-label" htmlFor="courtroom-view-name">Name</label><input id="courtroom-view-name" className="tc-input" {...detailsForm.register('name', { required: 'Name is required' })} />{detailsForm.formState.errors.name && <span className="tc-field-error">{detailsForm.formState.errors.name.message}</span>}</div>
                    <div className="tc-field"><label className="tc-label" htmlFor="courtroom-view-location">Details</label><input id="courtroom-view-location" className="tc-input" {...detailsForm.register('location')} placeholder="e.g. 2nd Floor" /></div>
                </form> : <dl className="scorer-view__summary"><div><dt>Name</dt><dd>{courtroom.name}</dd></div><div><dt>Details</dt><dd>{courtroom.location || 'No details'}</dd></div></dl>}
            </section>

            <section className="scorer-view__assignments">
                <div className="scorer-view__section-heading"><div><h2>Trials</h2><p>Every trial currently assigned to this courtroom.</p></div><span>{trials.length} trial{trials.length === 1 ? '' : 's'}</span></div>
                {doubleBookedRoundIds.size > 0 && <p className="courtroom-view__double-booked" role="alert">This courtroom is assigned to more than one trial in {doubleBookedRoundIds.size === 1 ? 'a round' : `${doubleBookedRoundIds.size} rounds`}.</p>}
                {trials.length === 0 ? <p className="scorer-view__notes">No trials are assigned to this courtroom yet.</p> : <div className="dash-table-scroll scorer-view__table"><table className="dash-standings-table"><thead><tr><th>Round</th><th>Prosecution</th><th>Defense</th><th>Actions</th></tr></thead><tbody>{trials.map(pairing => <tr key={pairing.pairing_id}><td data-label="Round"><Link to={`/organizer/${tournamentId}/round/${pairing.round_id}`}>{rounds.find(round => round.round_id === pairing.round_id)?.name ?? 'Round'}</Link>{doubleBookedRoundIds.has(pairing.round_id) && <span className="courtroom-view__row-warning">Double-booked</span>}</td><td data-label="Prosecution"><Link to={`/organizer/${tournamentId}/team/${pairing.p_team}`}>{teamName(pairing.p_team)}</Link></td><td data-label="Defense"><Link to={`/organizer/${tournamentId}/team/${pairing.d_team}`}>{teamName(pairing.d_team)}</Link></td><td data-label="Actions"><div className="courtroom-view__trial-actions"><button type="button" className="btn-secondary" disabled={saving} onClick={() => { void unassignTrial(pairing) }}>Unassign</button><button type="button" className="btn-secondary" disabled={saving} onClick={() => openReassignTrial(pairing)}>Reassign</button></div></td></tr>)}</tbody></table></div>}
                <button type="button" className="btn-secondary scorer-view__add-assignment" onClick={openAddTrial}>+ Add trial</button>
            </section>
        </section>

        {showAddTrial && <ModalBackdrop onClose={() => setShowAddTrial(false)}><div className="confirm-modal courtroom-view__trial-modal" role="dialog" aria-modal="true" aria-labelledby="add-trial-title"><h2 id="add-trial-title">Add trial to {courtroom.name}</h2><p>Select a round to see its trials and current courtroom assignments.</p><form className="tc-form" onSubmit={trialForm.handleSubmit(draft => { void assignTrial(draft) })} noValidate><div className="tc-field"><label className="tc-label" htmlFor="courtroom-trial-round">Round</label><select id="courtroom-trial-round" className="tc-input" {...trialForm.register('roundId', { required: 'Select a round' })}><option value="">Select a round…</option>{rounds.map(round => <option key={round.round_id} value={round.round_id}>{round.name}</option>)}</select></div>{selectedRoundId && <fieldset className="courtroom-view__trial-options"><legend>Select a trial</legend>{availableTrials.length === 0 ? <p>No other trials are available in this round.</p> : availableTrials.map(pairing => <label key={pairing.pairing_id} className="courtroom-view__trial-option"><input type="radio" value={pairing.pairing_id} {...trialForm.register('pairingId', { required: 'Select a trial' })} /><span><strong>P:</strong> {teamName(pairing.p_team)}</span><span><strong>D:</strong> {teamName(pairing.d_team)}</span><span><strong>Current courtroom:</strong> {courtroomName(pairing.courtroom)}</span></label>)}{trialForm.formState.errors.pairingId && <span className="tc-field-error">{trialForm.formState.errors.pairingId.message}</span>}</fieldset>}<div className="confirm-actions"><button type="button" onClick={() => setShowAddTrial(false)} disabled={saving}>Cancel</button><button type="submit" disabled={!selectedPairingId || saving}>{saving ? 'Adding…' : 'Add trial'}</button></div></form></div></ModalBackdrop>}
        {showReassignTrial && <ModalBackdrop onClose={() => setShowReassignTrial(false)}><div className="confirm-modal courtroom-view__trial-modal" role="dialog" aria-modal="true" aria-labelledby="reassign-trial-title"><h2 id="reassign-trial-title">Reassign trial</h2><form className="tc-form" onSubmit={reassignTrialForm.handleSubmit(draft => { void reassignTrial(draft) })} noValidate><div className="tc-field"><label className="tc-label" htmlFor="reassign-trial-courtroom">Courtroom</label><select id="reassign-trial-courtroom" className="tc-input" {...reassignTrialForm.register('courtroomId', { required: 'Select a courtroom' })}><option value="">Select a courtroom…</option>{courtrooms.filter(candidate => candidate.id !== courtroomId).map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select>{reassignTrialForm.formState.errors.courtroomId && <span className="tc-field-error">{reassignTrialForm.formState.errors.courtroomId.message}</span>}</div><div className="confirm-actions"><button type="button" onClick={() => setShowReassignTrial(false)} disabled={saving}>Cancel</button><button type="submit" disabled={saving}>Reassign</button></div></form></div></ModalBackdrop>}
        {confirmRemove.pending && <ConfirmRemoveModal message={`Remove ${confirmRemove.pending.name} from the courtroom list?`} onCancel={confirmRemove.clear} onConfirm={() => { void remove() }} />}
    </div>
}
