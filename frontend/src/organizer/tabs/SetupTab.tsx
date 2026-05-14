import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
// TODO: fetch schools from GET /api/schools (replace dummySchools)
import { dummySchools, type IInvite, type IOrganizer, type InviteStatus } from '../data/dummyData'
import { ConfirmRemoveModal, AddOrganizerModal } from '../components/modals'
import InviteSchoolModal from '../components/InviteSchoolModal'
import CourtroomsPage from "../pages/CourtroomsPage.tsx";
import ScorersPage from "../pages/ScorersPage.tsx";
import { isValidEmail } from '../../utils/validation'

type SubTab = 'invites' | 'organizers' | 'scorers' | 'courtrooms'

interface Props {
    tournamentId: string
    subTab: SubTab
    invites: IInvite[]
    organizers: IOrganizer[]
    onAddInvite: (invite: IInvite) => void
    onRemoveInvite: (id: string) => void
    onUpdateInviteEmail: (id: string, email: string) => void
    onAddOrganizer: (org: IOrganizer) => void
    onRemoveOrganizer: (id: string) => void
    onUpdateOrgEmail: (id: string, email: string) => void
}

const inviteChip = (s: InviteStatus) => (
    <span className={`ss-chip ss-chip--${s === 'accepted' ? 'submitted' : 'pending'}`}>{s}</span>
)

export default function SetupTab({
    tournamentId, subTab,
    invites, organizers,
    onAddInvite, onRemoveInvite, onUpdateInviteEmail,
    onAddOrganizer, onRemoveOrganizer, onUpdateOrgEmail,
}: Props) {
    const navigate = useNavigate()
    const [showInviteModal, setShowInviteModal] = useState(false)
    const [showAddOrgModal, setShowAddOrgModal] = useState(false)
    const [confirmRemoveInvite, setConfirmRemoveInvite] = useState<IInvite | null>(null)
    const [confirmRemoveOrg, setConfirmRemoveOrg] = useState<IOrganizer | null>(null)
    const [editingOrgId, setEditingOrgId] = useState<string | null>(null)
    const [editEmail, setEditEmail] = useState('')
    const [editingInviteId, setEditingInviteId] = useState<string | null>(null)
    const [editInviteEmail, setEditInviteEmail] = useState('')

    return (
        <>
            {subTab === 'invites' && (
                <div className="dash-section">
                    <div className="dash-invites-header">
                        <h2>{invites.length} team{invites.length !== 1 ? 's' : ''} invited</h2>
                        <button className="org-new-btn" onClick={() => setShowInviteModal(true)}>+ Invite team</button>
                    </div>
                    <table className="dash-standings-table">
                        <thead><tr><th>Team</th><th>Contact</th><th>Status</th><th></th></tr></thead>
                        <tbody>
                            {invites.map(invite => {
                                const school = dummySchools.find(s => s.id === invite.schoolId)
                                if (!school) return null
                                const displayEmail = invite.contactEmail ?? school.contactEmail
                                return (
                                    <tr key={invite.id}>
                                        <td><button className="dash-school-link" onClick={() => navigate(`/organizer/${tournamentId}/school/${invite.schoolId}`)}>{school.name}</button></td>
                                        <td>
                                            {editingInviteId === invite.id ? (
                                                <form style={{ display: 'flex', gap: '0.4rem' }} onSubmit={e => {
                                                    e.preventDefault()
                                                    if (!isValidEmail(editInviteEmail)) return
                                                    onUpdateInviteEmail(invite.id, editInviteEmail.trim())
                                                    setEditingInviteId(null)
                                                }}>
                                                    <input autoFocus type="email" value={editInviteEmail} onChange={e => setEditInviteEmail(e.target.value)}
                                                        style={{ height: '2rem', padding: '0 0.5rem', border: `1px solid ${isValidEmail(editInviteEmail) || !editInviteEmail ? 'var(--border-strong)' : 'var(--danger)'}`, borderRadius: '0.5rem', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'inherit', flex: 1, minWidth: 0 }} />
                                                    <button type="submit" disabled={!isValidEmail(editInviteEmail)} style={{ height: '2rem', padding: '0 0.6rem', border: 0, borderRadius: '0.5rem', background: 'var(--primary)', color: '#fff', fontFamily: 'inherit', fontSize: '0.82rem', cursor: 'pointer' }}>Save</button>
                                                    <button type="button" style={{ height: '2rem', padding: '0 0.6rem', border: 0, borderRadius: '0.5rem', background: 'var(--surface-muted)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.82rem', cursor: 'pointer' }} onClick={() => setEditingInviteId(null)}>Cancel</button>
                                                </form>
                                            ) : (
                                                <span className="dash-judge-name">{displayEmail}</span>
                                            )}
                                        </td>
                                        <td>{inviteChip(invite.status)}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                {editingInviteId !== invite.id && (
                                                    <button className="dash-remove-btn" onClick={() => { setEditingInviteId(invite.id); setEditInviteEmail(displayEmail) }}>Edit email</button>
                                                )}
                                                <button className="dash-remove-btn" onClick={() => setConfirmRemoveInvite(invite)}>Remove</button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {subTab === 'organizers' && (
                <div className="dash-section">
                    <div className="dash-invites-header">
                        <h2>{organizers.length} organizer{organizers.length !== 1 ? 's' : ''}</h2>
                        <button className="org-new-btn" onClick={() => setShowAddOrgModal(true)}>+ Add organizer</button>
                    </div>
                    <table className="dash-standings-table">
                        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
                        <tbody>
                            {organizers.map(org => (
                                <tr key={org.id}>
                                    <td>{org.name}</td>
                                    <td>
                                        {editingOrgId === org.id ? (
                                            <form style={{ display: 'flex', gap: '0.4rem' }} onSubmit={e => {
                                                e.preventDefault()
                                                if (!isValidEmail(editEmail)) return
                                                // TODO: PATCH /api/tournaments/:id/organizers/:orgId { email: editEmail }
                                                onUpdateOrgEmail(org.id, editEmail)
                                                setEditingOrgId(null)
                                            }}>
                                                <input autoFocus type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                                                    style={{ height: '2rem', padding: '0 0.5rem', border: `1px solid ${isValidEmail(editEmail) || !editEmail ? 'var(--border-strong)' : 'var(--danger)'}`, borderRadius: '0.5rem', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'inherit', flex: 1, minWidth: 0 }} />
                                                <button type="submit" disabled={!isValidEmail(editEmail)} style={{ height: '2rem', padding: '0 0.6rem', border: 0, borderRadius: '0.5rem', background: 'var(--primary)', color: '#fff', fontFamily: 'inherit', fontSize: '0.82rem', cursor: 'pointer' }}>Save</button>
                                                <button type="button" style={{ height: '2rem', padding: '0 0.6rem', border: 0, borderRadius: '0.5rem', background: 'var(--surface-muted)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.82rem', cursor: 'pointer' }} onClick={() => setEditingOrgId(null)}>Cancel</button>
                                            </form>
                                        ) : (
                                            <span className="dash-judge-name">{org.email}</span>
                                        )}
                                    </td>
                                    <td><span className={`ss-chip ${org.role === 'owner' ? 'ss-chip--submitted' : 'ss-chip--pending'}`}>{org.role}</span></td>
                                    <td style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                        {editingOrgId !== org.id && (
                                            <button className="dash-remove-btn" onClick={() => { setEditingOrgId(org.id); setEditEmail(org.email) }}>Edit email</button>
                                        )}
                                        {org.role !== 'owner' && (
                                            <button className="dash-remove-btn" onClick={() => setConfirmRemoveOrg(org)}>Remove</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {subTab === 'scorers' && (
                <div className="dash-section">
                    <div className="dash-invites-header">
                        <h2>Scorers</h2>
                    </div>
                    <p className="dash-judge-name">Manage your list of available scorers.</p>
                    <ScorersPage />
                </div>
            )}

            {subTab === 'courtrooms' && (
                <div className="dash-section">
                    <div className="dash-invites-header">
                        <h2>Courtrooms</h2>
                    </div>
                    <p className="dash-judge-name">Manage available courtrooms in use during competition.</p>
                    <CourtroomsPage />
                </div>
            )}

            {showInviteModal && (
                <InviteSchoolModal
                    onClose={() => setShowInviteModal(false)}
                    onInvite={(schoolId, email) => {
                        // TODO: POST /api/tournaments/:id/invites { schoolId, email } — send invite email and persist
                        onAddInvite({ id: `i-${Date.now()}`, tournamentId, schoolId, status: 'pending' })
                        console.log(email)
                    }}
                />
            )}

            {showAddOrgModal && (
                <AddOrganizerModal
                    onClose={() => setShowAddOrgModal(false)}
                    onAdd={(name, email) => 
                        // TODO: POST /api/tournaments/:id/organizers { name, email }
                        onAddOrganizer({ id: `o-${Date.now()}`, tournamentId, name, email, role: 'co-organizer' })}
                />
            )}

            {confirmRemoveInvite && (() => {
                const school = dummySchools.find(s => s.id === confirmRemoveInvite.schoolId)
                return (
                    <ConfirmRemoveModal
                        message={`Remove ${school?.name ?? 'this team'} from the tournament?`}
                        onCancel={() => setConfirmRemoveInvite(null)}
                        onConfirm={() => { 
                            // TODO: DELETE /api/tournaments/:id/invites/:inviteId
                            onRemoveInvite(confirmRemoveInvite.id); setConfirmRemoveInvite(null) }}
                    />
                )
            })()}

            {confirmRemoveOrg && (
                <ConfirmRemoveModal
                    message={`Remove ${confirmRemoveOrg.name} as an organizer?`}
                    onCancel={() => setConfirmRemoveOrg(null)}
                    onConfirm={() => { 
                        // TODO: DELETE /api/tournaments/:id/organizers/:orgId
                        onRemoveOrganizer(confirmRemoveOrg.id); setConfirmRemoveOrg(null) }}
                />
            )}
        </>
    )
}
