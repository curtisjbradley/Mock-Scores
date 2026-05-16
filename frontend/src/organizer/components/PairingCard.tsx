import { useState } from 'react'
import { dummyScorers, type IPairing, type ITeam } from '../data/dummyData'
import type { ICourtroom } from '@mock-scores/shared'

interface Props {
    pairing: IPairing
    teams: ITeam[]
    courtrooms: ICourtroom[]
    onRemove: () => void
    onUpdate: (updated: IPairing) => void
}

export default function PairingCard({ pairing, teams, courtrooms, onRemove, onUpdate }: Props) {
    // Courtroom editing
    const [editingCourtroom, setEditingCourtroom] = useState(false)
    const [courtroomDraft, setCourtroomDraft] = useState(pairing.courtroom)

    // Team editing
    const [editingTeams, setEditingTeams] = useState(false)
    const [prosDraft, setProsDraft] = useState(pairing.prosecutionTeamId)
    const [defDraft, setDefDraft] = useState(pairing.defenseTeamId)

    // Paper scorer
    const [paperName, setPaperName] = useState('')
    const [showPaperInput, setShowPaperInput] = useState(false)

    const teamName = (tid: string) => {
        const t = teams.find(t => t.id === tid)
        return t ? `${t.code} — ${t.team}` : '—'
    }

    const availableScorers = dummyScorers.filter(
        s => !pairing.scoresheets.some(sh => sh.assignedScorerId === s.id)
    )

    const updateSheets = (sheets: IPairing['scoresheets']) =>
        onUpdate({ ...pairing, scoresheets: sheets })

    const setPresider = (judgeId: string) =>
        updateSheets(pairing.scoresheets.map(s => ({ ...s, isPresider: s.judgeId === judgeId })))

    const togglePresiderScores = (judgeId: string) =>
        updateSheets(pairing.scoresheets.map(s =>
            s.judgeId === judgeId ? { ...s, presiderScores: !s.presiderScores } : s
        ))

    const addScorer = (scorerId: string) => {
        const scorer = dummyScorers.find(s => s.id === scorerId)
        if (!scorer) return
        updateSheets([...pairing.scoresheets, {
            judgeId: `j-${Date.now()}`, judgeName: scorer.name,
            status: 'pending', assignedScorerId: scorer.id, isPresider: false,
        }])
    }

    const addPaperScorer = () => {
        const name = paperName.trim()
        if (!name) return
        updateSheets([...pairing.scoresheets, {
            judgeId: `j-paper-${Date.now()}`, judgeName: name,
            status: 'pending', isPresider: false,
        }])
        setPaperName('')
        setShowPaperInput(false)
    }

    const removeScorer = (judgeId: string) =>
        updateSheets(pairing.scoresheets.filter(s => s.judgeId !== judgeId))

    const openCourtroomEdit = () => { setCourtroomDraft(pairing.courtroom); setEditingCourtroom(true) }
    const saveCourtroomEdit = () => { onUpdate({ ...pairing, courtroom: courtroomDraft }); setEditingCourtroom(false) }
    const cancelCourtroomEdit = () => setEditingCourtroom(false)

    const openTeamsEdit = () => { setProsDraft(pairing.prosecutionTeamId); setDefDraft(pairing.defenseTeamId); setEditingTeams(true) }
    const saveTeamsEdit = () => { onUpdate({ ...pairing, prosecutionTeamId: prosDraft, defenseTeamId: defDraft }); setEditingTeams(false) }
    const cancelTeamsEdit = () => setEditingTeams(false)

    return (
        <div className="dash-pairing-card">
            {/* Top bar */}
            <div className="dash-pairing-topbar">
                {editingCourtroom ? (
                    <div className="pc-inline-edit">
                        <select className="rv-select" autoFocus
                            value={courtroomDraft}
                            onChange={e => setCourtroomDraft(e.target.value)}>
                            {courtrooms.map(c => (
                                <option key={c.id} value={c.name}>{c.name}{c.details ? ` (${c.details})` : ''}</option>
                            ))}
                        </select>
                        <button className="pc-save-btn" onClick={saveCourtroomEdit}>Save</button>
                        <button className="pc-cancel-btn" onClick={cancelCourtroomEdit}>Cancel</button>
                    </div>
                ) : (
                    <button className="dash-courtroom-badge" onClick={openCourtroomEdit}>
                        🏛 Courtroom {pairing.courtroom} ✎
                    </button>
                )}
                <button className="dash-remove-btn" onClick={onRemove}>Remove</button>
            </div>

            {/* Matchup */}
            {editingTeams ? (
                <div className="pc-edit-teams">
                    <label className="rv-field-label">
                        Prosecution
                        <select className="rv-select" value={prosDraft} onChange={e => setProsDraft(e.target.value)}>
                            <option value="">Select team…</option>
                            {teams.map(t => <option key={t.id} value={t.id}>{t.code} — {t.team}</option>)}
                        </select>
                    </label>
                    <label className="rv-field-label">
                        Defense
                        <select className="rv-select" value={defDraft} onChange={e => setDefDraft(e.target.value)}>
                            <option value="">Select team…</option>
                            {teams.map(t => <option key={t.id} value={t.id}>{t.code} — {t.team}</option>)}
                        </select>
                    </label>
                    <div className="pc-edit-actions">
                        <button className="pc-save-btn" onClick={saveTeamsEdit}>Save</button>
                        <button className="pc-cancel-btn" onClick={cancelTeamsEdit}>Cancel</button>
                    </div>
                </div>
            ) : (
                <button className="dash-matchup-grid pc-matchup-btn" onClick={openTeamsEdit}>
                    <div className="dash-matchup-side">
                        <span className="dash-side-label">Prosecution</span>
                        <span className="dash-team-name">{teamName(pairing.prosecutionTeamId)}</span>
                    </div>
                    <span className="dash-vs">v.</span>
                    <div className="dash-matchup-side dash-matchup-side--right">
                        <span className="dash-side-label">Defense</span>
                        <span className="dash-team-name">{teamName(pairing.defenseTeamId)}</span>
                    </div>
                    <span className="pc-edit-hint">✎</span>
                </button>
            )}

            {/* Scorers */}
            <div className="pc-scorers-section">
                <div className="pc-scorers-header">
                    <span className="pc-scorers-label">Scorers</span>
                    <div className="pc-scorer-add-row">
                        {showPaperInput ? (
                            <form className="pc-paper-form" onSubmit={e => { e.preventDefault(); addPaperScorer() }}>
                                <input autoFocus className="pc-paper-input" placeholder="Judge name…"
                                    value={paperName} onChange={e => setPaperName(e.target.value)} />
                                <button type="submit" className="pc-paper-add" disabled={!paperName.trim()}>Add</button>
                                <button type="button" className="pc-paper-cancel"
                                    onClick={() => { setShowPaperInput(false); setPaperName('') }}>✕</button>
                            </form>
                        ) : (
                            <select className="dash-scorer-select" value=""
                                onChange={e => {
                                    if (e.target.value === '__paper__') { setShowPaperInput(true); return }
                                    if (e.target.value) addScorer(e.target.value)
                                }}>
                                <option value="">+ Add scorer</option>
                                {availableScorers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                <option disabled>──────────</option>
                                <option value="__paper__">📄 Paper scorer…</option>
                            </select>
                        )}
                    </div>
                </div>

                {pairing.scoresheets.length > 0 && (
                    <div className="dash-scoresheets">
                        {pairing.scoresheets.map(s => {
                            const isPaper = !s.assignedScorerId
                            return (
                                <div key={s.judgeId} className="dash-scoresheet-row">
                                    <span className="dash-judge-name">{s.judgeName}</span>
                                    <div className="dash-scoresheet-actions">
                                        <label className="pc-presider-radio" title="Set as presider">
                                            <input type="radio" name={`presider-${pairing.id}`}
                                                checked={!!s.isPresider} onChange={() => setPresider(s.judgeId)} />
                                            Presider
                                        </label>
                                        {s.isPresider && (
                                            <label className="pc-scores-check" title="Presider also scores">
                                                <input type="checkbox" checked={!!s.presiderScores}
                                                    onChange={() => togglePresiderScores(s.judgeId)} />
                                                Scores
                                            </label>
                                        )}
                                        {(() => {
                                            const hasScores = s.status === 'submitted' && s.prosecutionScore != null && s.defenseScore != null
                                            if (hasScores) {
                                                const diff = s.prosecutionScore! - s.defenseScore!
                                                if (diff > 0) return <span className="pc-margin pc-margin--p">+{diff} P</span>
                                                if (diff < 0) return <span className="pc-margin pc-margin--d">{diff} D</span>
                                                return <span className="pc-margin pc-margin--t">0 T</span>
                                            }
                                            if (isPaper) return <span className="ss-chip ss-chip--pending">awaiting ballot</span>
                                            return <span className={`ss-chip ss-chip--${s.status}`}>{s.status}</span>
                                        })()}
                                        {isPaper && (
                                            <button className="dash-view-btn" onClick={() => window.location.href = './score/TBI-Paper'}>
                                                Input Ballot
                                            </button>
                                        )}
                                        {s.status !== 'submitted' && (
                                            <button className="dash-remove-btn" onClick={() => removeScorer(s.judgeId)}>
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
