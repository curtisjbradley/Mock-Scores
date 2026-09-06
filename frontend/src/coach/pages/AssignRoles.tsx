import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiFetch } from '../../auth/auth'
import type { IScoringCategory, IStudent, IStudentAssignment } from '@mock-scores/shared'
import { resolveCoachTournament } from '../coachApi'
import '../../organizer/styles/organizer.css'
import '../../organizer/styles/tabs.css'
import '../../organizer/styles/round-view.css'
import '../../organizer/styles/standings.css'
import '../styles/coach-pages.css'

interface Witness { id: string; name: string; side: string }

interface RoleRow {
    key: string
    label: string
    fieldId: string
    witnessId: string | null
    categoryName: string
}

export default function AssignRoles() {
    const { teamId, pairingId, side } = useParams<{
        teamId: string; pairingId: string; side: 'p' | 'd'
    }>()
    const navigate = useNavigate()

    const [categories, setCategories] = useState<IScoringCategory[]>([])
    const [witnesses, setWitnesses] = useState<Witness[]>([])
    const [students, setStudents] = useState<IStudent[]>([])
    const [pending, setPending] = useState<Map<string, string>>(new Map())
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!teamId || !pairingId) return
        let active = true
        // Tournament-scoped endpoints query by tournament id; resolve it from the team.
        resolveCoachTournament(teamId, false, undefined).then(info => {
            if (!active || !info) return
            const tid = info.tournamentId
            return Promise.all([
                apiFetch(`/coach/tournaments/${tid}/scoring-categories`).then(r => r.ok ? r.json() : []),
                apiFetch(`/coach/tournaments/${tid}/witnesses`).then(r => r.ok ? r.json() : []),
                apiFetch(`/coach/teams/${teamId}/students`).then(r => r.ok ? r.json() : []),
                apiFetch(`/coach/teams/${teamId}/pairings/${pairingId}/assignments`).then(r => r.ok ? r.json() : []),
                apiFetch(`/coach/teams/${teamId}/default-assignments`).then(r => r.ok ? r.json() : []),
            ]).then(([cats, wits, studs, assigns, defaults]: [IScoringCategory[], Witness[], IStudent[], IStudentAssignment[], IStudentAssignment[]]) => {
                if (!active) return
                setCategories(cats)
                setWitnesses(wits)
                setStudents(studs)

                // Build default map first, then overlay pairing-specific assignments
                const map = new Map<string, string>()
                for (const a of defaults) {
                    const key = a.witness_id ? `${a.field_id}:${a.witness_id}` : a.field_id
                    map.set(key, a.student_id)
                }
                for (const a of assigns) {
                    const key = a.witness_id ? `${a.field_id}:${a.witness_id}` : a.field_id
                    map.set(key, a.student_id)
                }
                setPending(map)
            })
        }).catch(() => {})
        return () => { active = false }
    }, [teamId, pairingId])

    const isP = side === 'p'

    const ownSideWitnesses   = witnesses.filter(w => w.side === (isP ? 'P' : 'D') || w.side === 'S')
    const oppSideWitnesses   = witnesses.filter(w => w.side === (isP ? 'D' : 'P') || w.side === 'S')

    const rows: RoleRow[] = categories.flatMap(cat =>
        cat.fields.filter(f => f.assignable && (
            cat.witnessCategory || (isP ? f.prosecution : f.defense)
        )).flatMap((f): RoleRow[] => {
            if (!cat.witnessCategory) {
                return [{ key: f.id, label: f.label, fieldId: f.id, witnessId: null, categoryName: cat.name }]
            }
            const applicableWitnesses = f.crossing ? oppSideWitnesses : ownSideWitnesses
            return applicableWitnesses.map(w => ({
                key: `${f.id}:${w.id}`,
                label: `${w.name} - ${f.label}`,
                fieldId: f.id,
                witnessId: w.id,
                categoryName: cat.name,
            }))
        })
    )

    async function handleSave() {
        if (!teamId || !pairingId) return
        setSaving(true)
        // Send all assigned rows in one request
        const assignments = rows
            .filter(r => pending.get(r.key))
            .map(r => ({ field_id: r.fieldId, student_id: pending.get(r.key)!, witness_id: r.witnessId ?? null }))
        await apiFetch(`/coach/teams/${teamId}/pairings/${pairingId}/assignments/bulk`, {
            method: 'POST',
            body: JSON.stringify({ assignments }),
        })
        setSaving(false)
        navigate(-1)
    }

    return (
        <main className="org-main">
            <div className="org-container">
                <button className="org-back-btn" onClick={() => navigate(-1)}>← Back to schedule</button>
                <h1>Assign Roles</h1>
                <p className="coach-empty coach-assign-note">
                    Assigning roles for <strong>{isP ? 'Prosecution' : 'Defense'}</strong> side.
                </p>
                {rows.length === 0
                    ? <p className="coach-empty">No assignable roles for this side.</p>
                    : (
                        <table className="dash-standings-table">
                            <thead><tr><th>Category</th><th>Role</th><th>Assigned Student</th></tr></thead>
                            <tbody>{rows.map(r => (
                                <tr key={r.key}>
                                    <td>{r.categoryName}</td>
                                    <td>{r.label}</td>
                                    <td>
                                        <select
                                            className="rv-select"
                                            value={pending.get(r.key) ?? ''}
                                            disabled={saving}
                                            onChange={e => setPending(prev => new Map(prev).set(r.key, e.target.value))}
                                        >
                                            <option value="">— unassigned —</option>
                                            {students.map(s => (
                                                <option key={s.student_id} value={s.student_id}>{s.student_name}</option>
                                            ))}
                                        </select>
                                    </td>
                                </tr>
                            ))}</tbody>
                        </table>
                    )
                }
                <div className="tab-actions coach-tab-actions">
                    <button className="btn-confirm" onClick={handleSave} disabled={saving}>Save</button>
                    <button className="btn-cancel" onClick={() => navigate(-1)} disabled={saving}>Cancel</button>
                </div>
            </div>
        </main>
    )
}
