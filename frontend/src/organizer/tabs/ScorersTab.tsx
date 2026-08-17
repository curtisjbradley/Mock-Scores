import { useEffect, useState } from 'react'
import type { IScorer, ITeam, IConflict } from '@mock-scores/shared'
import { apiFetch } from '../../auth/auth'
import { isValidEmail } from '../../utils/validation'
import { ConfirmRemoveModal } from '../components/modals'
import ModalBackdrop from '../../shared/components/ModalBackdrop'
import CsvImportModal from '../../shared/components/CsvImportModal'
import { useConfirmRemove } from '../../shared/hooks/useConfirmRemove'
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
            <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="conflicts-title">
                <h2 id="conflicts-title">Conflicts — {scorer.first_name} {scorer.last_name}</h2>
                {conflicts.length > 0 && (
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
                        {conflicts.map(c => (
                            <li key={c.team_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                                <span>{c.team_name}</span>
                                <button className="dash-remove-btn" onClick={() => removeConflict(c)}>Remove</button>
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
                    <p style={{ opacity: 0.6, fontSize: '0.9em' }}>
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

export default function ScorersTab({ tournamentId }: { tournamentId: string }) {
    const [scorers, setScorers] = useState<IScorer[]>([])
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const confirmRemove = useConfirmRemove<IScorer>()
    const [conflictsScorer, setConflictsScorer] = useState<IScorer | null>(null)
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [email, setEmail] = useState('')
    const [bouncedEmails, setBouncedEmails] = useState<Set<string>>(new Set())
    const [showImport, setShowImport] = useState(false)

    useEffect(() => {
        apiFetch(`/organizer/tournament/${tournamentId}/scorers`)
            .then(r => r.ok ? r.json() : [])
            .then((data: IScorer[]) => setScorers(Array.isArray(data) ? data : []))
            .catch(() => setScorers([]))
        apiFetch(`/organizer/tournament/${tournamentId}/bounced-emails`)
            .then(r => r.ok ? r.json() : [])
            .then((emails: string[]) => setBouncedEmails(new Set(emails.map(e => e.toLowerCase()))))
            .catch(() => {})
    }, [tournamentId])

    const openAddModal = () => {
        setEditingId(null); setFirstName(''); setLastName(''); setEmail('')
        setShowModal(true)
    }

    const openEditModal = (scorer: IScorer) => {
        setEditingId(scorer.scorer_id)
        setFirstName(scorer.first_name); setLastName(scorer.last_name); setEmail(scorer.email ?? '')
        setShowModal(true)
    }

    const handleSave = () => {
        if (!firstName.trim() || !lastName.trim() || !isValidEmail(email)) return
        if (editingId) {
            const updated = scorers.find(s => s.scorer_id === editingId)
            if (!updated) return
            const payload = { ...updated, first_name: firstName.trim(), last_name: lastName.trim(), email: email.trim() }
            setScorers(prev => prev.map(s => s.scorer_id === editingId ? payload : s))
            apiFetch(`/organizer/tournament/${tournamentId}/scorers`, { method: 'PUT', body: JSON.stringify(payload) }).catch(console.error)
        } else {
            const newScorer: IScorer = { scorer_id: randomUUID(), first_name: firstName.trim(), last_name: lastName.trim(), email: email.trim() }
            setScorers(prev => [...prev, newScorer])
            apiFetch(`/organizer/tournament/${tournamentId}/scorers`, { method: 'POST', body: JSON.stringify(newScorer) }).catch(console.error)
        }
        setShowModal(false)
    }

    const handleRemove = () => {
        if (!confirmRemove.pending) return
        apiFetch(`/organizer/tournament/${tournamentId}/scorers`, { method: 'DELETE', body: JSON.stringify({ scorer_id: confirmRemove.pending.scorer_id }) }).catch(console.error)
        setScorers(prev => prev.filter(s => s.scorer_id !== confirmRemove.pending!.scorer_id))
        confirmRemove.clear()
    }

    return (
        <Section title="Scorers" description="Manage available scorers">
            <div className="tab-actions">
                <button className="org-new-btn" onClick={openAddModal}>+ Add scorer</button>
                <button className="org-new-btn" onClick={() => setShowImport(true)} style={{ marginLeft: 8 }}>Import CSV</button>
            </div>

            <div className="dash-table-scroll">
                <table className="dash-standings-table">
                    <thead><tr><th>Name</th><th>Email</th><th></th></tr></thead>
                    <tbody>
                        {scorers.map(scorer => (
                            <tr key={scorer.scorer_id}>
                                <td>{scorer.first_name} {scorer.last_name}</td>
                                <td className="dash-judge-name">
                                    {scorer.email ?? '—'}
                                    {scorer.email && bouncedEmails.has(scorer.email.toLowerCase()) && (
                                        <span title="Email delivery failed" style={{ marginLeft: 6, background: '#dc2626', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '1px 5px', borderRadius: 3, verticalAlign: 'middle' }}>⚠ BOUNCED</span>
                                    )}
                                </td>
                                <td>
                                    <div className="dash-actions-cell">
                                        <button className="dash-remove-btn" onClick={() => openEditModal(scorer)}>Edit</button>
                                        <button className="dash-remove-btn" onClick={() => setConflictsScorer(scorer)}>Manage Conflicts</button>
                                        <button className="dash-remove-btn" onClick={() => confirmRemove.open(scorer)}>Remove</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <ModalBackdrop onClose={() => setShowModal(false)}>
                    <div className="confirm-modal" role="dialog" aria-modal="true">
                        <h2>{editingId ? 'Edit scorer' : 'Add scorer'}</h2>
                        <form className="tc-form" onSubmit={e => { e.preventDefault(); handleSave() }} noValidate>
                            <div className="tc-field">
                                <label className="tc-label" htmlFor="first-name">First name</label>
                                <input id="first-name" type="text" className="tc-input" required autoFocus
                                    value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" />
                            </div>
                            <div className="tc-field">
                                <label className="tc-label" htmlFor="last-name">Last name</label>
                                <input id="last-name" type="text" className="tc-input" required
                                    value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" />
                            </div>
                            <div className="tc-field">
                                <label className="tc-label" htmlFor="scorer-email">Email</label>
                                <input id="scorer-email" type="email" required
                                    className={`tc-input${email && !isValidEmail(email) ? ' tc-input--invalid' : ''}`}
                                    value={email} onChange={e => setEmail(e.target.value)} placeholder="scorer@example.com" />
                                {email && !isValidEmail(email) && <span className="tc-field-error">Invalid email address</span>}
                            </div>
                            <div className="confirm-actions">
                                <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" disabled={!firstName.trim() || !lastName.trim() || !isValidEmail(email)}>
                                    {editingId ? 'Save' : 'Add scorer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </ModalBackdrop>
            )}

            {confirmRemove.pending && (
                <ConfirmRemoveModal
                    message={`Remove ${confirmRemove.pending.first_name} ${confirmRemove.pending.last_name} from the scorer list?`}
                    onCancel={confirmRemove.clear}
                    onConfirm={handleRemove}
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
                    description="Upload a CSV file with scorer information. Each row will be added as a new scorer."
                    columns={['first_name', 'last_name', 'email']}
                    exampleRow="Jane,Smith,jane.smith@example.com"
                    onClose={() => {
                        setShowImport(false)
                        // Refresh scorers list after import
                        apiFetch(`/organizer/tournament/${tournamentId}/scorers`)
                            .then(r => r.ok ? r.json() : [])
                            .then((data: IScorer[]) => setScorers(Array.isArray(data) ? data : []))
                            .catch(() => {})
                    }}
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
