import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { ITeam } from '@mock-scores/shared'
import { ConfirmRemoveModal, EditTeamModal } from '../components/modals'
import Section from './Section'
import AddTeamModal from '../components/AddTeamModal'
import CsvImportModal from '../../shared/components/CsvImportModal'
import { apiFetch } from '../../auth/auth'
import { useConfirmRemove } from '../../shared/hooks/useConfirmRemove'
import InlineEmailEdit from '../../shared/components/InlineEmailEdit'
import StatusChip from '../../shared/components/StatusChip'


export default function TeamsTab({ tournamentId }: { tournamentId: string }) {
    const [teams, setTeams] = useState<ITeam[]>([])
    const [showModal, setShowModal] = useState(false)
    const confirmRemove = useConfirmRemove<ITeam>()
    const [editingTeam, setEditingTeam] = useState<ITeam | null>(null)
    const [editingEmailId, setEditingEmailId] = useState<string | null>(null)
    const [editEmail, setEditEmail] = useState('')
    const [bouncedEmails, setBouncedEmails] = useState<Set<string>>(new Set())
    const [showImport, setShowImport] = useState(false)

    useEffect(() => {
        apiFetch(`/organizer/tournament/${tournamentId}/teams`)
            .then(r => r.json())
            .then(setTeams)
            .catch(console.error)
        apiFetch(`/organizer/tournament/${tournamentId}/bounced-emails`)
            .then(r => r.ok ? r.json() : [])
            .then((emails: string[]) => setBouncedEmails(new Set(emails.map(e => e.toLowerCase()))))
            .catch(() => {})
    }, [tournamentId])

    const putTeam = async (team: ITeam, patch: Partial<ITeam>): Promise<boolean> => {
        const res = await apiFetch(`/organizer/tournament/${tournamentId}/teams`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ team: { ...team, ...patch } }),
        })
        if (!res.ok) return false
        const updated: ITeam = await res.json()
        setTeams(prev => prev.map(t => t.id === team.id ? updated : t))
        return true
    }

    const handleAdd = async (name: string, email: string, code: string) => {
        const res = await apiFetch(`/organizer/tournament/${tournamentId}/teams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ team: { name, coach_email: email, code } }),
        })
        if (!res.ok) return
        const team: ITeam = await res.json()
        setTeams(prev => [...prev, team])
        setShowModal(false)
    }

    const handleRemove = async (team: ITeam) => {
        const res = await apiFetch(`/organizer/tournament/${tournamentId}/teams`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: team.id }),
        })
        if (!res.ok) return
        setTeams(prev => prev.filter(t => t.id !== team.id))
        confirmRemove.clear()
    }

    return (
        <Section title="Teams" description="Manage invited teams">
            <div className="tab-actions">
                <button className="org-new-btn" onClick={() => setShowModal(true)}>+ Add team</button>
                <button className="org-new-btn" onClick={() => setShowImport(true)} style={{ marginLeft: 8 }}>Import CSV</button>
            </div>

            <div className="dash-table-scroll">
                <table className="dash-standings-table">
                    <thead><tr><th>Team</th><th>Code</th><th>Contact</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                        {teams.map(team => (
                            <tr key={team.id}>
                                <td><Link className="dash-table-link" to={`/organizer/${tournamentId}/school/${team.id}`}>{team.name}</Link></td>
                                <td>{team.code}</td>
                                <td>
                                    {editingEmailId === team.id
                                        ? <InlineEmailEdit
                                            value={editEmail}
                                            onChange={setEditEmail}
                                            onSave={async () => {
                                                const ok = await putTeam(team, { coach_email: editEmail })
                                                if (ok) setEditingEmailId(null)
                                            }}
                                            onCancel={() => setEditingEmailId(null)}
                                          />
                                        : <span className="dash-judge-name">
                                            {team.coach_email}
                                            {bouncedEmails.has(team.coach_email.toLowerCase()) && (
                                                <span title="Email delivery failed" style={{ marginLeft: 6, background: '#dc2626', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '1px 5px', borderRadius: 3, verticalAlign: 'middle' }}>⚠ BOUNCED</span>
                                            )}
                                          </span>
                                    }
                                </td>
                                <td><StatusChip label={team.has_joined ? 'accepted' : 'pending'} variant={team.has_joined ? 'submitted' : 'pending'} /></td>
                                <td>
                                    <div className="dash-actions-cell">
                                        <button className="dash-remove-btn" onClick={() => setEditingTeam(team)}>Edit</button>
                                        {!team.has_joined && editingEmailId !== team.id && (
                                            <button className="dash-remove-btn" onClick={() => { setEditingEmailId(team.id); setEditEmail(team.coach_email) }}>Edit email</button>
                                        )}
                                        <button className="dash-remove-btn" onClick={() => confirmRemove.open(team)}>Remove</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <AddTeamModal
                    existingNames={teams.map(t => t.name)}
                    onClose={() => setShowModal(false)}
                    onAdd={(name, email, code) => { void handleAdd(name, email, code) }}
                />
            )}

            {editingTeam && (
                <EditTeamModal
                    team={editingTeam}
                    existingNames={teams.filter(t => t.id !== editingTeam.id).map(t => t.name)}
                    onClose={() => setEditingTeam(null)}
                    onSave={(name, code) => { void putTeam(editingTeam, { name, code }) }}
                />
            )}

            {confirmRemove.pending && (
                <ConfirmRemoveModal
                    message="Remove this team from the tournament?"
                    onCancel={confirmRemove.clear}
                    onConfirm={() => { void handleRemove(confirmRemove.pending!) }}
                />
            )}

            {showImport && (
                <CsvImportModal
                    title="Import Teams"
                    description="Upload a CSV file with team information. Each row will be added as a new team."
                    columns={['name', 'coach_email', 'code (optional)']}
                    exampleRow="Eagles,coach@school.edu,EGL"
                    onClose={() => {
                        setShowImport(false)
                        // Refresh teams list after import
                        apiFetch(`/organizer/tournament/${tournamentId}/teams`)
                            .then(r => r.json())
                            .then(setTeams)
                            .catch(console.error)
                    }}
                    onImport={async (csv) => {
                        const res = await apiFetch(`/organizer/tournament/${tournamentId}/import/teams`, {
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
