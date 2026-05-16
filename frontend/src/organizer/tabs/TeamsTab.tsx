import { useState, useEffect } from 'react'
import type { ITeam } from '@mock-scores/shared'
import { ConfirmRemoveModal, EditTeamModal } from '../components/modals'
import Section from './Section'
import AddTeamModal from '../components/AddTeamModal'
import { isValidEmail } from '../../utils/validation'
import { apiFetch } from '../../auth/auth'

const teamChip = (hasJoined: boolean) => (
    <span className={`ss-chip ss-chip--${hasJoined ? 'submitted' : 'pending'}`}>{hasJoined ? 'accepted' : 'pending'}</span>
)

export default function TeamsTab({ tournamentId }: { tournamentId: string }) {
    const [teams, setTeams] = useState<ITeam[]>([])
    const [showModal, setShowModal] = useState(false)
    const [confirmRemove, setConfirmRemove] = useState<ITeam | null>(null)
    const [editingTeam, setEditingTeam] = useState<ITeam | null>(null)
    const [editingEmailId, setEditingEmailId] = useState<string | null>(null)
    const [editEmail, setEditEmail] = useState('')

    useEffect(() => {
        apiFetch(`/api/organizer/tournament/${tournamentId}/teams`)
            .then(r => r.json())
            .then(setTeams)
            .catch(console.error)
    }, [tournamentId])

    const putTeam = async (team: ITeam, patch: Partial<ITeam>): Promise<boolean> => {
        const res = await apiFetch(`/api/organizer/tournament/${tournamentId}/teams`, {
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
        const res = await apiFetch(`/api/organizer/tournament/${tournamentId}/teams`, {
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
        const res = await apiFetch(`/api/organizer/tournament/${tournamentId}/teams`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: team.id }),
        })
        if (!res.ok) return
        setTeams(prev => prev.filter(t => t.id !== team.id))
        setConfirmRemove(null)
    }

    return (
        <Section title="Teams" description="Manage invited teams">
            <div className="tab-actions">
                <button className="org-new-btn" onClick={() => setShowModal(true)}>+ Add team</button>
            </div>

            <div className="dash-table-scroll">
                <table className="dash-standings-table">
                    <thead><tr><th>Team</th><th>Code</th><th>Contact</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                        {teams.map(team => (
                            <tr key={team.id}>
                                <td>{team.name}</td>
                                <td>{team.code}</td>
                                <td>
                                    {editingEmailId === team.id ? (
                                        <form className="dash-edit-form" onSubmit={async e => {
                                            e.preventDefault()
                                            const ok = await putTeam(team, { coach_email: editEmail })
                                            if (ok) setEditingEmailId(null)
                                        }}>
                                            <input autoFocus type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                                                className={`dash-edit-input ${isValidEmail(editEmail) || !editEmail ? 'dash-edit-input--valid' : 'dash-edit-input--invalid'}`} />
                                            <button type="submit" disabled={!isValidEmail(editEmail)} className="dash-edit-save">Save</button>
                                            <button type="button" className="dash-edit-cancel" onClick={() => setEditingEmailId(null)}>Cancel</button>
                                        </form>
                                    ) : (
                                        <span className="dash-judge-name">{team.coach_email}</span>
                                    )}
                                </td>
                                <td>{teamChip(team.has_joined)}</td>
                                <td>
                                    <div className="dash-actions-cell">
                                        <button className="dash-remove-btn" onClick={() => setEditingTeam(team)}>Edit</button>
                                        {!team.has_joined && editingEmailId !== team.id && (
                                            <button className="dash-remove-btn" onClick={() => { setEditingEmailId(team.id); setEditEmail(team.coach_email) }}>Edit email</button>
                                        )}
                                        <button className="dash-remove-btn" onClick={() => setConfirmRemove(team)}>Remove</button>
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

            {confirmRemove && (
                <ConfirmRemoveModal
                    message="Remove this team from the tournament?"
                    onCancel={() => setConfirmRemove(null)}
                    onConfirm={() => { void handleRemove(confirmRemove) }}
                />
            )}
        </Section>
    )
}
