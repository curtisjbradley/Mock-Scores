import { useEffect, useState } from 'react'
import type { IStudent, IStudentAssignment, IScoringCategory } from '@mock-scores/shared'
import { apiFetch } from '../../auth/auth'
import { ConfirmRemoveModal } from '../../organizer/components/modals'
import { useConfirmRemove } from '../../shared/hooks/useConfirmRemove'
import EmptyState from '../../shared/components/EmptyState'
import ModalBackdrop from '../../shared/components/ModalBackdrop'
import '../../organizer/styles/organizer.css'
import '../../organizer/styles/tabs.css'
import '../../organizer/styles/round-view.css'

const PRONOUN_OPTIONS = [
    { value: 'he/him',    label: 'he/him (Mr)' },
    { value: 'she/her',   label: 'she/her (Ms)' },
    { value: 'they/them', label: 'they/them (Mx)' },
    { value: 'other',     label: 'Other' },
]

interface Witness { id: string; name: string; side: string }
interface DefaultCallOrderRow { witness_id: string; witness_name: string; position: number }
interface Format { p_witnesses_called: number; d_witnesses_called: number; criminal_case?: boolean }

interface Props {
    students: IStudent[]
    tournamentId: string
    teamId: string
    onAdd: (name: string, pronouns: string | null) => void
    onRemove: (studentId: string) => void
}

// ── Side setup modal ──────────────────────────────────────────────────────────

function SideSetupModal({
    side, students, teamId, tournamentId, isCriminal, onClose,
}: {
    side: 'p' | 'd'
    students: IStudent[]
    teamId: string
    tournamentId: string
    isCriminal: boolean
    onClose: () => void
}) {
    const sideLabel = side === 'p' ? (isCriminal ? 'Prosecution' : 'Plaintiff') : 'Defense'
    const ownSide = side === 'p' ? 'P' : 'D'
    const oppSide = side === 'p' ? 'D' : 'P'

    const [witnesses, setWitnesses] = useState<Witness[]>([])
    const [callOrderSlots, setCallOrderSlots] = useState<string[]>([])
    const [categories, setCategories] = useState<IScoringCategory[]>([])
    const [assignments, setAssignments] = useState<Map<string, string>>(new Map())
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        Promise.all([
            apiFetch(`/coach/tournaments/${tournamentId}/witnesses`).then(r => r.ok ? r.json() : []),
            apiFetch(`/coach/tournaments/${tournamentId}/format`).then(r => r.ok ? r.json() : null),
            apiFetch(`/coach/teams/${teamId}/default-witness-order`).then(r => r.ok ? r.json() : []),
            apiFetch(`/coach/tournaments/${tournamentId}/scoring-categories`).then(r => r.ok ? r.json() : []),
            apiFetch(`/coach/teams/${teamId}/default-assignments`).then(r => r.ok ? r.json() : []),
        ]).then(([wits, fmt, callOrder, cats, defaultAssigns]: [
            Witness[], Format | null, DefaultCallOrderRow[], IScoringCategory[], IStudentAssignment[]
        ]) => {
            setWitnesses(wits)

            const count = fmt ? (side === 'p' ? fmt.p_witnesses_called : fmt.d_witnesses_called) : 0
            const savedIds = callOrder.map(r => r.witness_id)
            setCallOrderSlots(Array.from({ length: count }, (_, i) => savedIds[i] ?? ''))

            setCategories(cats)
            const map = new Map<string, string>()
            for (const a of defaultAssigns) {
                const key = a.witness_id ? `${a.field_id}:${a.witness_id}` : a.field_id
                map.set(key, a.student_id)
            }
            setAssignments(map)
        }).catch(() => {})
     
    }, [tournamentId, teamId, side])

    // ── Call order ────────────────────────────────────────────────────────────
    const ownSideWitnesses = witnesses.filter(w => w.side === ownSide || w.side === 'S')
    const oppSideWitnesses = witnesses.filter(w => w.side === oppSide || w.side === 'S')

    const setSlot = (index: number, witnessId: string) => {
        setCallOrderSlots(prev => {
            const next = [...prev]
            for (let i = 0; i < next.length; i++) {
                if (i !== index && next[i] === witnessId) next[i] = ''
            }
            next[index] = witnessId
            return next
        })
    }

    // ── Role rows ─────────────────────────────────────────────────────────────
    const roleRows = categories.flatMap(cat =>
        cat.fields
            .filter(f => f.assignable && (cat.witnessCategory || (side === 'p' ? f.prosecution : f.defense)))
            .flatMap(f => {
                if (!cat.witnessCategory) {
                    return [{ key: f.id, label: `${cat.name} — ${f.label}`, fieldId: f.id, witnessId: null as string | null }]
                }
                // calling fields use own-side witnesses; crossing fields use opponent witnesses
                const applicable = f.crossing ? oppSideWitnesses : ownSideWitnesses
                return applicable.map(w => ({
                    key: `${f.id}:${w.id}`,
                    label: `${cat.name} — ${w.name} — ${f.label}`,
                    fieldId: f.id,
                    witnessId: w.id as string | null,
                }))
            })
    )

    // ── Save ──────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        setSaving(true)
        await Promise.all([
            apiFetch(`/coach/teams/${teamId}/default-witness-order`, {
                method: 'PUT',
                body: JSON.stringify({ witness_ids: callOrderSlots.filter(Boolean) }),
            }),
            ...roleRows.map(r => {
                const studentId = assignments.get(r.key)
                if (studentId) {
                    return apiFetch(`/coach/teams/${teamId}/default-assignments`, {
                        method: 'PUT',
                        body: JSON.stringify({ field_id: r.fieldId, student_id: studentId, witness_id: r.witnessId }),
                    })
                }
                return apiFetch(`/coach/teams/${teamId}/default-assignments`, {
                    method: 'DELETE',
                    body: JSON.stringify({ field_id: r.fieldId, witness_id: r.witnessId }),
                })
            }),
        ])
        setSaving(false)
        setSaved(true)
        setTimeout(() => { setSaved(false); onClose() }, 800)
    }

    return (
        <ModalBackdrop onClose={onClose}>
            <div className="confirm-modal" role="dialog" aria-modal="true"
                style={{ maxWidth: '36rem', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
                <h2 style={{ marginTop: 0 }}>{sideLabel} — Default Setup</h2>

                {/* Call order */}
                {callOrderSlots.length > 0 && (
                    <>
                        <h3 style={{ margin: '0 0 0.5rem' }}>Witness Call Order</h3>
                        <table className="dash-standings-table" style={{ marginBottom: '1rem' }}>
                            <thead><tr><th>Call #</th><th>Witness</th></tr></thead>
                            <tbody>
                                {callOrderSlots.map((val, i) => (
                                    <tr key={i}>
                                        <td>{i + 1}</td>
                                        <td>
                                            <select className="rv-select" value={val}
                                                onChange={e => setSlot(i, e.target.value)}>
                                                <option value="">— select —</option>
                                                {ownSideWitnesses.map(w => (
                                                    <option key={w.id} value={w.id}
                                                        disabled={callOrderSlots.includes(w.id) && callOrderSlots[i] !== w.id}>
                                                        {w.name}{w.side === 'S' ? ' (Swing)' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                )}

                {/* Role assignments */}
                {roleRows.length > 0 && students.length > 0 && (
                    <>
                        <h3 style={{ margin: '0 0 0.5rem' }}>Role Assignments</h3>
                        <table className="dash-standings-table" style={{ marginBottom: '1rem' }}>
                            <thead><tr><th>Role</th><th>Student</th></tr></thead>
                            <tbody>
                                {roleRows.map(r => (
                                    <tr key={r.key}>
                                        <td>{r.label}</td>
                                        <td>
                                            <select className="rv-select"
                                                value={assignments.get(r.key) ?? ''}
                                                onChange={e => setAssignments(prev => {
                                                    const next = new Map(prev)
                                                    if (e.target.value) next.set(r.key, e.target.value)
                                                    else next.delete(r.key)
                                                    return next
                                                })}>
                                                <option value="">— unassigned —</option>
                                                {students.map(s => (
                                                    <option key={s.student_id} value={s.student_id}>{s.student_name}</option>
                                                ))}
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                )}

                {callOrderSlots.length === 0 && roleRows.length === 0 && (
                    <p className="coach-empty">No witnesses or scoring categories configured for this tournament yet.</p>
                )}

                <div className="confirm-actions">
                    <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
                    <button type="button" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
                    </button>
                </div>
            </div>
        </ModalBackdrop>
    )
}

// ── RosterTab ─────────────────────────────────────────────────────────────────

export default function RosterTab({ students, tournamentId, teamId, onAdd, onRemove }: Props) {
    const [name, setName] = useState('')
    const [pronounSelect, setPronounSelect] = useState('')
    const [customPronouns, setCustomPronouns] = useState('')
    const [formError, setFormError] = useState('')
    const [submitted, setSubmitted] = useState(false)
    const confirmRemove = useConfirmRemove<IStudent>()
    const [openSide, setOpenSide] = useState<'p' | 'd' | null>(null)
    const [isCriminal, setIsCriminal] = useState(true)

    useEffect(() => {
        if (!tournamentId) return
        apiFetch(`/coach/tournaments/${tournamentId}/format`)
            .then(r => r.ok ? r.json() : null)
            .then((fmt: Format | null) => { if (fmt?.criminal_case != null) setIsCriminal(fmt.criminal_case) })
            .catch(() => {})
    }, [tournamentId])

    const submit = () => {
        setSubmitted(true)
        if (!name.trim()) { setFormError('Please enter a student name.'); return }
        if (!pronounSelect) { setFormError('Please select pronouns.'); return }
        if (pronounSelect === 'other' && !customPronouns.trim()) { setFormError('Please enter custom pronouns.'); return }
        setFormError('')
        setSubmitted(false)
        const pronouns = pronounSelect === 'other' ? customPronouns.trim() : pronounSelect
        onAdd(name.trim(), pronouns)
        setName(''); setPronounSelect(''); setCustomPronouns('')
    }

    const prosecutionLabel = isCriminal ? 'Prosecution' : 'Plaintiff'

    return (
        <div className="roster-tab">
            {/* Add student */}
            <form className="roster-add-form" onSubmit={e => { e.preventDefault(); submit() }}>
                <input
                    className={`dash-edit-input ${submitted && !name.trim() ? 'dash-edit-input--invalid' : 'dash-edit-input--valid'}`}
                    placeholder="Student name"
                    value={name}
                    onChange={e => { setName(e.target.value); setFormError('') }}
                    autoComplete="off"
                />
                <select
                    className={`dash-edit-input ${submitted && !pronounSelect ? 'dash-edit-input--invalid' : 'dash-edit-input--valid'}`}
                    value={pronounSelect}
                    onChange={e => { setPronounSelect(e.target.value); setFormError('') }}
                    required
                >
                    <option value="" disabled>Pronouns</option>
                    {PRONOUN_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                {pronounSelect === 'other' && (
                    <input
                        className={`dash-edit-input ${submitted && !customPronouns.trim() ? 'dash-edit-input--invalid' : 'dash-edit-input--valid'}`}
                        placeholder="Enter pronouns"
                        value={customPronouns}
                        onChange={e => { setCustomPronouns(e.target.value); setFormError('') }}
                    />
                )}
                <button type="submit" className="org-new-btn">+ Add</button>
            </form>
            {formError && <p className="sb-config-error">{formError}</p>}

            {students.length === 0
                ? <EmptyState message="No students on the roster yet." />
                : <ul className="roster-list">
                    {students.map(s => (
                        <li key={s.student_id} className="roster-item">
                            <span className="roster-name">
                                {s.student_name}
                                {s.pronouns ? <span className="roster-pronouns">({s.pronouns})</span> : null}
                            </span>
                            <button className="dash-remove-btn" onClick={() => confirmRemove.open(s)}>Remove</button>
                        </li>
                    ))}
                </ul>
            }
            {students.length > 0 && <p className="org-header-sub">{students.length} student{students.length !== 1 ? 's' : ''}</p>}

            {/* Side setup buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                <button className="org-new-btn" onClick={() => setOpenSide('p')}>
                    Set {prosecutionLabel} Call Order &amp; Assignments
                </button>
                <button className="org-new-btn" onClick={() => setOpenSide('d')}>
                    Set Defense Call Order &amp; Assignments
                </button>
            </div>

            {openSide && (
                <SideSetupModal
                    side={openSide}
                    students={students}
                    teamId={teamId}
                    tournamentId={tournamentId}
                    isCriminal={isCriminal}
                    onClose={() => setOpenSide(null)}
                />
            )}

            {confirmRemove.pending && (
                <ConfirmRemoveModal
                    message={`Remove ${confirmRemove.pending.student_name} from the roster?`}
                    onCancel={confirmRemove.clear}
                    onConfirm={() => { onRemove(confirmRemove.pending!.student_id); confirmRemove.clear() }}
                />
            )}
        </div>
    )
}
