import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import '../components/layout.css'
import '../judges/styles/modal.css'
import { dummyTournaments, dummyTeams, dummyPairings, dummyInvites, dummySchools, dummyOrganizers, dummyScorers, dummyCourtrooms, type ScoresheetStatus, type InviteStatus, type IInvite, type IOrganizer, type IPairing } from './dummyData'
import InviteSchoolModal from './InviteSchoolModal'

const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const dateRange = (dates: string[]) =>
    dates.length === 1 ? fmt(dates[0]) : `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}`

const statusChip = (s: ScoresheetStatus) => (
    <span className={`ss-chip ss-chip--${s}`}>{s}</span>
)
const inviteChip = (s: InviteStatus) => (
    <span className={`ss-chip ss-chip--${s === 'accepted' ? 'submitted' : 'pending'}`}>{s}</span>
)

const TournamentDashboard = () => {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const tournament = dummyTournaments.find(t => t.id === id)
    const [activeTab, setActiveTab] = useState<'overview' | 'rounds' | 'standings' | 'invites' | 'organizers'>('overview')
    const [showInviteModal, setShowInviteModal] = useState(false)
    const [showAddOrgModal, setShowAddOrgModal] = useState(false)
    const [confirmRemoveInvite, setConfirmRemoveInvite] = useState<IInvite | null>(null)
    const [confirmRemoveOrg, setConfirmRemoveOrg] = useState<IOrganizer | null>(null)
    const [editingOrgId, setEditingOrgId] = useState<string | null>(null)
    const [editEmail, setEditEmail] = useState('')
    const [confirmPublishRound, setConfirmPublishRound] = useState<number | null>(null)
    const [editingCourtroomPairing, setEditingCourtroomPairing] = useState<IPairing | null>(null)


    // Local state for demo mutations
    const [invites, setInvites] = useState(() => dummyInvites.filter(i => i.tournamentId === id))
    const [organizers, setOrganizers] = useState(() => dummyOrganizers.filter(o => o.tournamentId === id))
    const [pairingsState, setPairingsState] = useState(() => dummyPairings.filter(p => p.tournamentId === id))
    const [courtroomsState, setCourtroomsState] = useState(() => dummyCourtrooms.filter(c => c.tournamentId === id))

    console.log(setCourtroomsState)
    console.log(confirmPublishRound)

    if (!tournament) {
        navigate('/organizer/select', { replace: true })
        return null
    }

    const teams = dummyTeams.filter(t => t.tournamentId === id)
    const pairings = pairingsState
    const rounds = [...new Set(pairings.map(p => p.round))].sort((a, b) => a - b)
    const allSheets = pairings.flatMap(p => p.scoresheets)
    const submitted = allSheets.filter(s => s.status === 'submitted').length
    const missing   = allSheets.filter(s => s.status === 'missing').length
    const pending   = allSheets.filter(s => s.status === 'pending').length
    const teamName  = (tid: string) => { const t = teams.find(t => t.id === tid); return t ? `${t.code} — ${t.school}` : tid }
    const sortedTeams = [...teams].sort((a, b) => b.wins !== a.wins ? b.wins - a.wins : (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst))

    return (
        <>
            <Header />
            <main className="org-main">
                <div className="org-container">
                    <button className="org-back-btn" onClick={() => navigate('/organizer/select')}>← All tournaments</button>

                    <div className="org-header">
                        <h1>{tournament.name}</h1>
                        <span className={`org-status org-status--${tournament.status}`}>
                            {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                        </span>
                    </div>

                    <div className="org-meta-row">
                        <span>{dateRange(tournament.dates)}</span>
                        <span>{tournament.location}</span>
                        <span>{tournament.teams} teams</span>
                        <span>{tournament.rounds} rounds</span>
                    </div>

                    <div className="org-dashboard-grid">
                        <div className="org-dashboard-card"><h2>Teams</h2><p className="org-dashboard-stat">{teams.length || tournament.teams}</p></div>
                        <div className="org-dashboard-card"><h2>Scoresheets</h2><p className="org-dashboard-stat">{submitted}/{allSheets.length}</p></div>
                        <div className="org-dashboard-card"><h2>Pending</h2><p className="org-dashboard-stat">{pending}</p></div>
                        <div className="org-dashboard-card"><h2>Missing</h2><p className="org-dashboard-stat org-dashboard-stat--alert">{missing}</p></div>
                    </div>

                    <div className="dash-tabs">
                        {(['overview', 'rounds', 'standings', 'invites', 'organizers'] as const).map(tab => (
                            <button key={tab} className={`dash-tab${activeTab === tab ? ' dash-tab--active' : ''}`} onClick={() => setActiveTab(tab)}>
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                        <button className="dash-tab" onClick={() => navigate(`/organizer/${id}/scorers`)}>Scorers</button>
                        <button className="dash-tab" onClick={() => navigate(`/organizer/${id}/courtrooms`)}>Courtrooms</button>
                    </div>

                    {activeTab === 'overview' && (
                        <div className="dash-section">
                            <h2>Scoresheet status by round</h2>
                            {rounds.map(round => {
                                const rp = pairings.filter(p => p.round === round)
                                const rs = rp.flatMap(p => p.scoresheets)
                                const rsub = rs.filter(s => s.status === 'submitted').length
                                const rmis = rs.filter(s => s.status === 'missing').length
                                return (
                                    <div key={round} className="dash-round-summary">
                                        <span className="dash-round-label">Round {round}</span>
                                        <span className="dash-round-date">{fmt(rp[0].date)}</span>
                                        <span className="dash-round-progress">{rsub}/{rs.length} submitted{rmis > 0 && <span className="dash-missing"> · {rmis} missing</span>}</span>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {activeTab === 'rounds' && (
                        <div className="dash-section">
                            {rounds.map(round => {
                                const roundPairings = pairings.filter(p => p.round === round)
                                const isPublished = roundPairings.every(p => p.isPublished)
                                return (
                                    <div key={round}>
                                        <div className="dash-round-header">
                                            <h2 className="dash-round-heading">Round {round} — {fmt(roundPairings[0].date)}</h2>
                                            {!isPublished && (
                                                <button className="org-new-btn" onClick={() => setConfirmPublishRound(round)}>Publish round</button>
                                            )}
                                            {isPublished && <span className="dash-published-badge">Published</span>}
                                        </div>
                                        <div className="dash-pairings">
                                            {roundPairings.map(pairing => {
                                                const assignedIds = pairing.scoresheets.map(s => s.assignedScorerId).filter(Boolean)
                                                const unassignedScorers = dummyScorers.filter(s => !assignedIds.includes(s.id))
                                                return (
                                                    <div key={pairing.id} className="dash-pairing-card">
                                                        <div className="dash-pairing-header">
                                                            {editingCourtroomPairing?.id === pairing.id ? (
                                                                <select
                                                                    autoFocus
                                                                    className="dash-scorer-select"
                                                                    value={pairing.courtroom}
                                                                    onChange={e => {
                                                                        setPairingsState(prev => prev.map(p => p.id === pairing.id ? {...p, courtroom: e.target.value} : p))
                                                                        setEditingCourtroomPairing(null)
                                                                    }}
                                                                    onBlur={() => setEditingCourtroomPairing(null)}
                                                                >
                                                                    {courtroomsState.map(c => <option key={c.id} value={c.name}>{c.name}{c.details ? ` (${c.details})` : ''}</option>)}
                                                                </select>
                                                            ) : (
                                                                <button className="dash-courtroom-btn" onClick={() => setEditingCourtroomPairing(pairing)}>
                                                                    Courtroom {pairing.courtroom}
                                                                </button>
                                                            )}
                                                            {!isPublished && pairing.scoresheets.length < 10 && (
                                                                <select
                                                                    className="dash-scorer-select"
                                                                    value=""
                                                                    onChange={e => {
                                                                        const scorer = dummyScorers.find(s => s.id === e.target.value)
                                                                        if (!scorer) return
                                                                        setPairingsState(prev => prev.map(p => p.id === pairing.id ? {
                                                                            ...p,
                                                                            scoresheets: [...p.scoresheets, {
                                                                                judgeId: `j-${Date.now()}`,
                                                                                judgeName: scorer.name,
                                                                                status: 'pending' as const,
                                                                                assignedScorerId: scorer.id,
                                                                                assignedScorerName: scorer.name,
                                                                                isPresider: false
                                                                            }]
                                                                        } : p))
                                                                    }}
                                                                >
                                                                    <option value="">+ Add scorer</option>
                                                                    {unassignedScorers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                                </select>
                                                            )}
                                                        </div>
                                                        <div className="dash-matchup">
                                                            <span>{teamName(pairing.prosecutionTeamId)}</span>
                                                            <span className="dash-vs">v.</span>
                                                            <span>{teamName(pairing.defenseTeamId)}</span>
                                                        </div>
                                                        <div className="dash-scoresheets">
                                                            {pairing.scoresheets.map(s => (
                                                                <div key={s.judgeId} className="dash-scoresheet-row">
                                                                    <span className="dash-judge-name">{s.judgeName}</span>
                                                                    <span className={`dash-presider-slot${s.isPresider ? ' dash-presider-badge' : ''}`}>{s.isPresider ? 'Presider' : ''}</span>
                                                                    {!isPublished && (
                                                                        <label className="dash-presider-label">
                                                                            <input
                                                                                type="radio"
                                                                                name={`presider-${pairing.id}`}
                                                                                checked={s.isPresider || false}
                                                                                onChange={() => {
                                                                                    setPairingsState(prev => prev.map(p => p.id === pairing.id ? {
                                                                                        ...p,
                                                                                        scoresheets: p.scoresheets.map(sh => ({
                                                                                            ...sh,
                                                                                            isPresider: sh.judgeId === s.judgeId
                                                                                        }))
                                                                                    } : p))
                                                                                }}
                                                                            /> Presider
                                                                        </label>
                                                                    )}
                                                                    {s.status === 'submitted' ? (
                                                                        <button className="dash-view-btn" onClick={() => navigate(`/organizer/${id}/scoresheet/${pairing.id}/${s.judgeId}`)}>View</button>
                                                                    ) : !isPublished && (
                                                                        <button className="dash-remove-btn" onClick={() => {
                                                                            setPairingsState(prev => prev.map(p => p.id === pairing.id ? {
                                                                                ...p,
                                                                                scoresheets: p.scoresheets.filter(sh => sh.judgeId !== s.judgeId)
                                                                            } : p))
                                                                        }}>Remove</button>
                                                                    )}
                                                                    {statusChip(s.status)}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {activeTab === 'standings' && (
                        <div className="dash-section">
                            <table className="dash-standings-table">
                                <thead><tr><th>#</th><th>Team</th><th>School</th><th>W</th><th>L</th><th>PF</th><th>PA</th><th>Diff</th></tr></thead>
                                <tbody>
                                    {sortedTeams.map((team, i) => (
                                        <tr key={team.id}>
                                            <td>{i + 1}</td>
                                            <td className="dash-team-code">{team.code}</td>
                                            <td>{team.school}</td>
                                            <td>{team.wins}</td><td>{team.losses}</td>
                                            <td>{team.pointsFor}</td><td>{team.pointsAgainst}</td>
                                            <td className={team.pointsFor - team.pointsAgainst >= 0 ? 'dash-diff--pos' : 'dash-diff--neg'}>
                                                {team.pointsFor - team.pointsAgainst > 0 ? '+' : ''}{team.pointsFor - team.pointsAgainst}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'invites' && (
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
                                        return (
                                            <tr key={invite.id}>
                                                <td><button className="dash-school-link" onClick={() => navigate(`/organizer/${id}/school/${invite.schoolId}`)}>{school.name}</button></td>
                                                <td className="dash-judge-name">{school.contactEmail}</td>
                                                <td>{inviteChip(invite.status)}</td>
                                                <td><button className="dash-remove-btn" onClick={() => setConfirmRemoveInvite(invite)}>Remove</button></td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'organizers' && (
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
                                            <td>{editingOrgId === org.id ? (<form style={{display:'flex',gap:'0.4rem'}} onSubmit={e=>{e.preventDefault();setOrganizers(prev=>prev.map(o=>o.id===org.id?{...o,email:editEmail}:o));setEditingOrgId(null)}}><input autoFocus style={{height:'2rem',padding:'0 0.5rem',border:'1px solid var(--border-strong)',borderRadius:'0.5rem',background:'var(--surface)',color:'var(--text)',fontSize:'0.85rem',fontFamily:'inherit',minWidth:0,flex:1}} value={editEmail} onChange={e=>setEditEmail(e.target.value)} type="email" /><button type="submit" style={{height:'2rem',padding:'0 0.6rem',border:0,borderRadius:'0.5rem',background:'var(--primary)',color:'#fff',fontFamily:'inherit',fontSize:'0.82rem',cursor:'pointer'}}>Save</button><button type="button" style={{height:'2rem',padding:'0 0.6rem',border:0,borderRadius:'0.5rem',background:'var(--surface-muted)',color:'var(--text)',fontFamily:'inherit',fontSize:'0.82rem',cursor:'pointer'}} onClick={()=>setEditingOrgId(null)}>Cancel</button></form>) : (<span className="dash-judge-name">{org.email}</span>)}</td>
                                            <td><span className={`ss-chip ${org.role === 'owner' ? 'ss-chip--submitted' : 'ss-chip--pending'}`}>{org.role}</span></td>
                                            <td style={{display:'flex',gap:'0.4rem',alignItems:'center'}}>{editingOrgId !== org.id && <button className="dash-remove-btn" onClick={()=>{setEditingOrgId(org.id);setEditEmail(org.email)}}>Edit email</button>}{org.role !== 'owner' && <button className="dash-remove-btn" onClick={() => setConfirmRemoveOrg(org)}>Remove</button>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
            <Footer />

            {showInviteModal && (
                <InviteSchoolModal
                    onClose={() => setShowInviteModal(false)}
                    onInvite={(school, email) => {
                        const newInvite = { id: `i-${Date.now()}`, tournamentId: id!, schoolId: school, status: 'pending' as const }
                        setInvites(prev => [...prev, newInvite])
                        // TODO: persist
                        console.log(email)
                    }}
                />
            )}

            {showAddOrgModal && (
                <AddOrganizerModal
                    onClose={() => setShowAddOrgModal(false)}
                    onAdd={(name, email) => {
                        const newOrg: IOrganizer = { id: `o-${Date.now()}`, tournamentId: id!, name, email, role: 'co-organizer' }
                        setOrganizers(prev => [...prev, newOrg])
                        // TODO: persist
                    }}
                />
            )}

            {confirmRemoveInvite && (() => {
                const school = dummySchools.find(s => s.id === confirmRemoveInvite.schoolId)
                return (
                    <ConfirmRemoveModal
                        message={`Remove ${school?.name ?? 'this team'} from the tournament?`}
                        onCancel={() => setConfirmRemoveInvite(null)}
                        onConfirm={() => { setInvites(prev => prev.filter(i => i.id !== confirmRemoveInvite.id)); setConfirmRemoveInvite(null) }}
                    />
                )
            })()}

            {confirmRemoveOrg && (
                <ConfirmRemoveModal
                    message={`Remove ${confirmRemoveOrg.name} as an organizer?`}
                    onCancel={() => setConfirmRemoveOrg(null)}
                    onConfirm={() => { setOrganizers(prev => prev.filter(o => o.id !== confirmRemoveOrg.id)); setConfirmRemoveOrg(null) }}
                />
            )}
        </>
    )
}

// ── Shared small modals ───────────────────────────────────────────────────────

function ConfirmRemoveModal({ message, onCancel, onConfirm }: { message: string; onCancel: () => void; onConfirm: () => void }) {
    return (
        <div className="modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
            <div className="confirm-modal" role="dialog" aria-modal="true">
                <h2>Are you sure?</h2>
                <p>{message}</p>
                <div className="confirm-actions">
                    <button type="button" onClick={onCancel}>Cancel</button>
                    <button type="button" className="confirm-btn-danger" onClick={onConfirm}>Remove</button>
                </div>
            </div>
        </div>
    )
}

function AddOrganizerModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, email: string) => void }) {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const valid = name.trim() && email.trim()
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!valid) return; onAdd(name.trim(), email.trim()); onClose() }
    const inputStyle = { height: '2.75rem', padding: '0 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', fontSize: '1rem', fontFamily: 'inherit' } as const
    return (
        <div className="modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="add-org-title">
                <h2 id="add-org-title">Add organizer</h2>
                <p>They will be added as a co-organizer for this tournament.</p>
                <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                    <label htmlFor="org-name" style={{ fontSize: '0.875rem', fontWeight: 600 }}>Name</label>
                    <input id="org-name" type="text" required autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Full name" style={inputStyle} />
                    <label htmlFor="org-email" style={{ fontSize: '0.875rem', fontWeight: 600, marginTop: '0.25rem' }}>Email</label>
                    <input id="org-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="organizer@crf.org" style={inputStyle} />
                    <div className="confirm-actions">
                        <button type="button" onClick={onClose}>Cancel</button>
                        <button type="submit" disabled={!valid}>Add organizer</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default TournamentDashboard
