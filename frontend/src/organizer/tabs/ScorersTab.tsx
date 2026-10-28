import { useCallback, useEffect, useState } from 'react'
import type { IScorer, ITeam, IConflict } from '@mock-scores/shared'
import { apiFetch } from '../../auth/auth'
import { isValidEmail } from '../../utils/validation'
import { ConfirmRemoveModal } from '../components/modals'
import ModalBackdrop from '../../shared/components/ModalBackdrop'
import DangerButton from '../../shared/components/DangerButton'
import AddButton from '../../shared/components/AddButton'
import CsvImportModal from '../../shared/components/CsvImportModal'
import { useConfirmRemove } from '../../shared/hooks/useConfirmRemove'
import { useAutoFocus } from '../../shared/hooks/useAutoFocus'
import Section from './Section'
import { v4 as randomUUID } from 'uuid'

function ManageConflictsModal({ scorer, tournamentId, onClose }: {
    scorer: IScorer
    tournamentId: string
    onClose: () => void
}) {
    const [conflicts, setConflicts] = useState<IConflict[]>([])
    const [teams, setTeams] = useState<ITeam[]>([])

    useEffect(() => {
        apiFetch(`/organizer/tournament/${tournamentId}/scorers/${scorer.scorer_id}/conflicts`)
            .then(r => r.ok ? r.json() : []).then(setConflicts).catch(() => {})
        apiFetch(`/organizer/tournament/${tournamentId}/teams`)
            .then(r => r.ok ? r.json() : []).then(setTeams).catch(() => {})
    }, [tournamentId, scorer.scorer_id])

    const conflictTeamIds = new Set(conflicts.map(c => c.team_id))
    const available = teams.filter(t => !conflictTeamIds.has(t.id))

    const addConflict = (team: ITeam) => {
        apiFetch(`/organizer/tournament/${tournamentId}/scorers/${scorer.scorer_id}/conflicts`, {
            method: 'POST', body: JSON.stringify({ team_id: team.id })
        }).then(r => r.ok ? r.json() : null).then(c => {
            if (c) setConflicts(prev => [...prev, c])
        }).catch(() => {})
    }

    const removeConflict = (conflict: IConflict) => {
        apiFetch(`/organizer/tournament/${tournamentId}/scorers/${scorer.scorer_id}/conflicts`, {
            method: 'DELETE', body: JSON.stringify({ team_id: conflict.team_id })
        }).then(r => { if (r.ok) setConflicts(prev => prev.filter(c => c.team_id !== conflict.team_id)) }).catch(() => {})
    }

    return (
        <ModalBackdrop onClose={onClose}>
            <div className="confirm-modal sc-conflict-modal" role="dialog" aria-modal="true" aria-labelledby="conflicts-title">
                <h2 id="conflicts-title">Conflicts — {scorer.name}</h2>
                {conflicts.length > 0 && (
                    <ul className="sc-conflict-list">
                        {conflicts.map(c => (
                            <li key={c.team_id} className="sc-conflict-item">
                                <span>{c.team_name}</span>
                                <DangerButton onClick={() => removeConflict(c)}>Remove</DangerButton>
                            </li>
                        ))}
                    </ul>
                )}
                {available.length > 0 ? (
                    <div className="tc-field">
                        <label className="tc-label" htmlFor="add-conflict-team">Add conflicting team</label>
                        <select id="add-conflict-team" className="tc-input" defaultValue="" onChange={e => {
                            const team = teams.find(t => t.id === e.target.value)
                            if (team) { addConflict(team); e.target.value = '' }
                        }}>
                            <option value="" disabled>Select a team…</option>
                            {available.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                ) : (
                    <p className="sc-conflict-empty">
                        {teams.length === 0 ? 'No teams in this tournament yet.' : 'All teams are already listed as conflicts.'}
                    </p>
                )}
                <div className="confirm-actions">
                    <button type="button" onClick={onClose}>Done</button>
                </div>
            </div>
        </ModalBackdrop>
    )
}

interface ScorerDraft {
    name: string
    email: string
    isPaper: boolean
    willingToPreside: boolean
    prefersToScoreWith: string[]
}

const EMPTY_DRAFT: ScorerDraft = { name: '', email: '', isPaper: false, willingToPreside: true, prefersToScoreWith: [] }

/**
 * Add/Edit form for a scorer. Handles both online (email required) and paper
 * (offline, no email) judges, plus the judge profile: willingness to preside and
 * a "prefers to score with" multi-select over the other scorers in the tournament.
 */
function ScorerFormModal({ editingScorer, allScorers, onClose, onSave, saving }: {
    editingScorer: IScorer | null
    allScorers: IScorer[]
    onClose: () => void
    onSave: (draft: ScorerDraft) => void
    saving: boolean
}) {
    const [draft, setDraft] = useState<ScorerDraft>(() => editingScorer
        ? {
            name: editingScorer.name,
            email: editingScorer.email ?? '',
            isPaper: editingScorer.is_paper,
            willingToPreside: editingScorer.willing_to_preside,
            prefersToScoreWith: editingScorer.prefers_to_score_with ?? [],
        }
        : EMPTY_DRAFT)
    const nameRef = useAutoFocus<HTMLInputElement>(true)

    // A paper scorer needs no email; an online scorer requires a valid one.
    const emailValid = draft.isPaper || isValidEmail(draft.email)
    const canSave = draft.name.trim().length > 0 && emailValid

    // Candidate co-scorers: everyone except the scorer being edited.
    const coScorerOptions = allScorers.filter(s => s.scorer_id !== editingScorer?.scorer_id)

    const togglePref = (id: string) => setDraft(d => ({
        ...d,
        prefersToScoreWith: d.prefersToScoreWith.includes(id)
            ? d.prefersToScoreWith.filter(x => x !== id)
            : [...d.prefersToScoreWith, id],
    }))

    return (
        <ModalBackdrop onClose={onClose}>
            <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="scorer-form-title">
                <h2 id="scorer-form-title">{editingScorer ? 'Edit scorer' : 'Add scorer'}</h2>
                <form className="tc-form" onSubmit={e => { e.preventDefault(); if (canSave) onSave(draft) }} noValidate>
                    <div className="tc-field">
                        <label className="tc-label" htmlFor="scorer-name">Name</label>
                        <input id="scorer-name" type="text" className="tc-input" required ref={nameRef}
                            value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                            placeholder="Jane Smith" />
                    </div>

                    <label className="sc-checkbox-label">
                        <input type="checkbox" checked={draft.isPaper}
                            onChange={e => setDraft(d => ({ ...d, isPaper: e.target.checked }))} />
                        Paper (offline) scorer — no email, scores on paper
                    </label>

                    {!draft.isPaper && (
                        <div className="tc-field">
                            <label className="tc-label" htmlFor="scorer-email">Email</label>
                            <input id="scorer-email" type="email" required
                                className={`tc-input${draft.email && !isValidEmail(draft.email) ? ' tc-input--invalid' : ''}`}
                                value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
                                placeholder="scorer@example.com" />
                            {draft.email && !isValidEmail(draft.email) && <span className="tc-field-error">Invalid email address</span>}
                        </div>
                    )}

                    <label className="sc-checkbox-label">
                        <input type="checkbox" checked={draft.willingToPreside}
                            onChange={e => setDraft(d => ({ ...d, willingToPreside: e.target.checked }))} />
                        Willing to preside
                    </label>

                    <div className="tc-field">
                        <span className="tc-label">Prefers to score with</span>
                        {coScorerOptions.length === 0 ? (
                            <p className="sc-conflict-empty">No other scorers yet.</p>
                        ) : (
                            <ul className="sc-pref-list">
                                {coScorerOptions.map(s => (
                                    <li key={s.scorer_id}>
                                        <label className="sc-checkbox-label">
                                            <input type="checkbox"
                                                checked={draft.prefersToScoreWith.includes(s.scorer_id)}
                                                onChange={() => togglePref(s.scorer_id)} />
                                            {s.name}{s.is_paper ? ' (paper)' : ''}
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="confirm-actions">
                        <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
                        <button type="submit" disabled={!canSave || saving}>
                            {saving ? 'Saving…' : editingScorer ? 'Save' : 'Add scorer'}
                        </button>
                    </div>
                </form>
            </div>
        </ModalBackdrop>
    )
}

export default function ScorersTab({ tournamentId }: { tournamentId: string }) {
    const [scorers, setScorers] = useState<IScorer[]>([])
    const [showForm, setShowForm] = useState(false)
    const [editingScorer, setEditingScorer] = useState<IScorer | null>(null)
    const confirmRemove = useConfirmRemove<IScorer>()
    const [conflictsScorer, setConflictsScorer] = useState<IScorer | null>(null)
    const [bouncedEmails, setBouncedEmails] = useState<Set<string>>(new Set())
    const [showImport, setShowImport] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    const loadScorers = useCallback(() => apiFetch(`/organizer/tournament/${tournamentId}/scorers`)
        .then(r => r.ok ? r.json() : [])
        .then((data: IScorer[]) => setScorers(Array.isArray(data) ? data : []))
        .catch(() => setScorers([])), [tournamentId])

    useEffect(() => {
        loadScorers()
        apiFetch(`/organizer/tournament/${tournamentId}/bounced-emails`)
            .then(r => r.ok ? r.json() : [])
            .then((emails: string[]) => setBouncedEmails(new Set(emails.map(e => e.toLowerCase()))))
            .catch(() => {})
    }, [tournamentId, loadScorers])

    const scorerName = (id: string) => scorers.find(s => s.scorer_id === id)?.name ?? '—'

    const openAddModal = () => { setEditingScorer(null); setShowForm(true) }
    const openEditModal = (scorer: IScorer) => { setEditingScorer(scorer); setShowForm(true) }

    const handleSave = async (draft: ScorerDraft) => {
        const base = {
            name: draft.name.trim(),
            email: draft.isPaper ? null : draft.email.trim(),
            is_paper: draft.isPaper,
            willing_to_preside: draft.willingToPreside,
            prefers_to_score_with: draft.prefersToScoreWith,
        }
        setSaving(true)
        setError(null)
        try {
        if (editingScorer) {
            const payload: IScorer = { ...editingScorer, ...base }
            const res = await apiFetch(`/organizer/tournament/${tournamentId}/scorers`, { method: 'PUT', body: JSON.stringify(payload) })
            if (!res.ok) throw new Error('Unable to save scorer.')
            setScorers(prev => prev.map(s => s.scorer_id === editingScorer.scorer_id ? payload : s))
        } else {
            const payload: IScorer = { scorer_id: randomUUID(), ...base }
            const res = await apiFetch(`/organizer/tournament/${tournamentId}/scorers`, { method: 'POST', body: JSON.stringify(payload) })
            if (!res.ok) throw new Error('Unable to add scorer.')
            setScorers(prev => [...prev, payload])
        }
        setShowForm(false)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to save scorer.')
        } finally {
            setSaving(false)
        }
    }

    const handleRemove = async () => {
        if (!confirmRemove.pending) return
        setSaving(true)
        setError(null)
        try {
            const scorerId = confirmRemove.pending.scorer_id
            const res = await apiFetch(`/organizer/tournament/${tournamentId}/scorers`, { method: 'DELETE', body: JSON.stringify({ scorer_id: scorerId }) })
            if (!res.ok) throw new Error('Unable to remove scorer.')
            setScorers(prev => prev.filter(s => s.scorer_id !== scorerId))
            confirmRemove.clear()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to remove scorer.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Section title="Scorers" description="Manage available scorers, including paper (offline) judges, their conflicts, and preferences">
            {error && <p className="org-error" role="alert">{error}</p>}
            <div className="tab-actions">
                <AddButton onClick={openAddModal}>+ Add scorer</AddButton>
                <button className="btn-primary tab-actions-import" onClick={() => setShowImport(true)}>Import CSV</button>
            </div>

            <div className="dash-table-scroll">
                <table className="dash-standings-table">
                    <thead><tr><th>Name</th><th>Type</th><th>Email</th><th>Preside</th><th>Prefers</th><th></th></tr></thead>
                    <tbody>
                        {scorers.map(scorer => (
                            <tr key={scorer.scorer_id}>
                                <td>{scorer.name}</td>
                                <td>
                                    <span className={`sc-type-badge ${scorer.is_paper ? 'sc-type-badge--paper' : 'sc-type-badge--online'}`}>
                                        {scorer.is_paper ? 'Paper' : 'Online'}
                                    </span>
                                </td>
                                <td className="dash-judge-name">
                                    {scorer.email ?? '—'}
                                    {scorer.email && bouncedEmails.has(scorer.email.toLowerCase()) && (
                                        <span title="Email delivery failed" className="dash-bounced-badge">⚠ BOUNCED</span>
                                    )}
                                </td>
                                <td>{scorer.willing_to_preside ? '✓' : '—'}</td>
                                <td>
                                    {scorer.prefers_to_score_with && scorer.prefers_to_score_with.length > 0
                                        ? scorer.prefers_to_score_with.map(scorerName).join(', ')
                                        : '—'}
                                </td>
                                <td>
                                    <div className="dash-actions-cell">
                                        <button className="dash-remove-btn" onClick={() => openEditModal(scorer)}>Edit</button>
                                        <button className="dash-remove-btn" onClick={() => setConflictsScorer(scorer)}>Manage Conflicts</button>
                                        <DangerButton onClick={() => confirmRemove.open(scorer)}>Remove</DangerButton>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showForm && (
                <ScorerFormModal
                    editingScorer={editingScorer}
                    allScorers={scorers}
                    onClose={() => setShowForm(false)}
                    onSave={draft => { void handleSave(draft) }}
                    saving={saving}
                />
            )}

            {confirmRemove.pending && (
                <ConfirmRemoveModal
                    message={`Remove ${confirmRemove.pending.name} from the scorer list?`}
                    onCancel={confirmRemove.clear}
                    onConfirm={() => { void handleRemove() }}
                />
            )}

            {conflictsScorer && (
                <ManageConflictsModal
                    scorer={conflictsScorer}
                    tournamentId={tournamentId}
                    onClose={() => setConflictsScorer(null)}
                />
            )}

            {showImport && (
                <CsvImportModal
                    title="Import Scorers"
                    description="Upload a CSV file with scorer information. Include a header row to set optional fields. Online scorers need an email; paper scorers (is_paper=true) may omit it."
                    columns={['name', 'email', 'is_paper', 'willing_to_preside']}
                    exampleRow="Jane Smith,jane.smith@example.com,false,true"
                    onClose={() => { setShowImport(false); loadScorers() }}
                    onImport={async (csv) => {
                        const res = await apiFetch(`/organizer/tournament/${tournamentId}/import/scorers`, {
                            method: 'POST',
                            body: JSON.stringify({ csv }),
                        })
                        if (!res.ok) throw new Error('Import failed')
                        return res.json()
                    }}
                />
            )}
        </Section>
    )
}
