import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiFetch } from '../../auth/auth'
import type { IScoringCategory, IStudent, IStudentAssignment } from '@mock-scores/shared'
import { resolveCoachTournament } from '../coachApi'
import SaveCancelActions from '../components/SaveCancelActions'
import '../../organizer/styles/organizer.css'
import '../../organizer/styles/tabs.css'
import '../../organizer/styles/round-view.css'
import '../../organizer/styles/standings.css'
import '../styles/assign-roles.css'

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
    const [error, setError] = useState<string | null>(null)

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

    // Roles are ordered to match the judge's scorecard (see ScoreSheet.tsx /
    // scorerProvider.buildScoreSheetForPairing): categories in `position` order, and
    // within a witness category the scorecard is witness-major — each witness is its own
    // block with its fields listed underneath, own-side (called) witnesses before
    // opposing-side (crossed) witnesses. We mirror that grouping here rather than the
    // previous field-major layout so the two screens read in the same order.
    const rows: RoleRow[] = categories.flatMap(cat => {
        const assignableFields = cat.fields.filter(f => f.assignable && (
            cat.witnessCategory || (isP ? f.prosecution : f.defense)
        ))

        if (!cat.witnessCategory) {
            return assignableFields.map((f): RoleRow => ({
                key: f.id, label: f.label, fieldId: f.id, witnessId: null, categoryName: cat.name,
            }))
        }

        // Witness-major ordering to match the scorecard: own-side (called) witnesses
        // first, then opposing-side (crossed) witnesses; swing witnesses appear once, in
        // the own-side group. Each (field, witness) pair emitted here is exactly the set
        // the previous field-major layout produced — only the grouping/order changes.
        // A field applies to a witness on this side iff: crossing fields target the
        // opposing-side witness list, all other assignable fields target the own-side list
        // (swings are in both lists, so they receive both calling and crossing fields).
        const seen = new Set<string>()
        const orderedWitnesses: Witness[] = []
        for (const w of [...ownSideWitnesses, ...oppSideWitnesses]) {
            if (seen.has(w.id)) continue
            seen.add(w.id)
            orderedWitnesses.push(w)
        }
        const ownIds = new Set(ownSideWitnesses.map(w => w.id))
        const oppIds = new Set(oppSideWitnesses.map(w => w.id))

        return orderedWitnesses.flatMap(witness =>
            assignableFields
                .filter(f => (f.crossing ? oppIds : ownIds).has(witness.id))
                .map((f): RoleRow => ({
                    key: `${f.id}:${witness.id}`,
                    label: `${witness.name} - ${f.label}`,
                    fieldId: f.id,
                    witnessId: witness.id,
                    categoryName: cat.name,
                }))
        )
    })

    async function handleSave() {
        if (!teamId || !pairingId) return
        setSaving(true)
        setError(null)
        // Send all assigned rows in one request
        const assignments = rows
            .filter(r => pending.get(r.key))
            .map(r => ({ field_id: r.fieldId, student_id: pending.get(r.key)!, witness_id: r.witnessId ?? null }))
        const res = await apiFetch(`/coach/teams/${teamId}/pairings/${pairingId}/assignments/bulk`, {
            method: 'POST',
            body: JSON.stringify({ assignments }),
        })
        setSaving(false)
        if (!res.ok) {
            const body = await res.json().catch(() => null) as { message?: string } | null
            setError(body?.message ?? 'Could not save role assignments.')
            return
        }
        navigate(-1)
    }

    return (
        <main className="org-main">
            <div className="org-container">
                <button className="org-back-btn" onClick={() => navigate(-1)}>Back to schedule</button>
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
                                            <option value="">-unassigned-</option>
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
                <SaveCancelActions onSave={handleSave} onCancel={() => navigate(-1)} saving={saving} />
                {error && <p className="coach-save-error" role="alert">{error}</p>}
            </div>
        </main>
    )
}
