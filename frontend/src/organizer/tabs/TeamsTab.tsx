import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { dummySchools, dummyTeamInvites, type ITeamInvite, type TeamInviteStatus } from '../data/dummyData'
import { ConfirmRemoveModal } from '../components/modals'
import Section from './Section'
import AddTeamModal from '../components/AddTeamModal'
import { isValidEmail } from '../../utils/validation'

const teamChip = (s: TeamInviteStatus) => (
    <span className={`ss-chip ss-chip--${s === 'accepted' ? 'submitted' : 'pending'}`}>{s}</span>
)

export default function TeamsTab({ tournamentId }: { tournamentId: string }) {
    const navigate = useNavigate()
    const [teams, setTeams] = useState<ITeamInvite[]>(() => dummyTeamInvites.filter(t => t.tournamentId === tournamentId))
    const [showModal, setShowModal] = useState(false)
    const [confirmRemove, setConfirmRemove] = useState<ITeamInvite | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editEmail, setEditEmail] = useState('')

    return (
        <Section title="Teams" description="Manage invited teams">

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                <button className="org-new-btn" onClick={() => setShowModal(true)}>+ Add team</button>
            </div>

            <div className="dash-table-scroll">
                <table className="dash-standings-table">
                    <thead><tr><th>Team</th><th>Contact</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                        {teams.map(team => {
                            const school = dummySchools.find(s => s.id === team.schoolId)
                            if (!school) return null
                            const displayEmail = team.contactEmail ?? school.contactEmail
                            return (
                                <tr key={team.id}>
                                    <td><button className="dash-school-link" onClick={() => navigate(`/organizer/${tournamentId}/school/${team.schoolId}`)}>{school.name}</button></td>
                                    <td>
                                        {editingId === team.id ? (
                                            <form className="dash-edit-form" onSubmit={e => {
                                                e.preventDefault()
                                                if (!isValidEmail(editEmail)) return
                                                setTeams(prev => prev.map(t => t.id === team.id ? { ...t, contactEmail: editEmail.trim() } : t))
                                                setEditingId(null)
                                            }}>
                                                <input autoFocus type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                                                    className={`dash-edit-input ${isValidEmail(editEmail) || !editEmail ? 'dash-edit-input--valid' : 'dash-edit-input--invalid'}`} />
                                                <button type="submit" disabled={!isValidEmail(editEmail)} className="dash-edit-save">Save</button>
                                                <button type="button" className="dash-edit-cancel" onClick={() => setEditingId(null)}>Cancel</button>
                                            </form>
                                        ) : (
                                            <span className="dash-judge-name">{displayEmail}</span>
                                        )}
                                    </td>
                                    <td>{teamChip(team.status)}</td>
                                    <td>
                                        <div className="dash-actions-cell">
                                            {editingId !== team.id && (
                                                <button className="dash-remove-btn" onClick={() => { setEditingId(team.id); setEditEmail(displayEmail) }}>Edit email</button>
                                            )}
                                            <button className="dash-remove-btn" onClick={() => setConfirmRemove(team)}>Remove</button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <AddTeamModal
                    onClose={() => setShowModal(false)}
                    onAdd={(schoolId, email) => {
                        // TODO: POST /api/tournaments/:id/teams { schoolId, email }
                        setTeams(prev => [...prev, { id: `t-${Date.now()}`, tournamentId, schoolId, status: 'pending' }])
                        console.log(email)
                        setShowModal(false)
                    }}
                />
            )}

            {confirmRemove && (() => {
                const school = dummySchools.find(s => s.id === confirmRemove.schoolId)
                return (
                    <ConfirmRemoveModal
                        message={`Remove ${school?.name ?? 'this team'} from the tournament?`}
                        onCancel={() => setConfirmRemove(null)}
                        onConfirm={() => {
                            // TODO: DELETE /api/tournaments/:id/teams/:teamId
                            setTeams(prev => prev.filter(t => t.id !== confirmRemove.id))
                            setConfirmRemove(null)
                        }}
                    />
                )
            })()}
        </Section>
    )
}
