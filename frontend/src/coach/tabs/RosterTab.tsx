import { useState } from 'react'
import type { IStudent } from '@mock-scores/shared'
import { ConfirmRemoveModal } from '../../organizer/components/modals'
import { useConfirmRemove } from '../../shared/hooks/useConfirmRemove'
import EmptyState from '../../shared/components/EmptyState'

const PRONOUN_OPTIONS = [
    { value: 'he/him', label: 'he/him (Mr)' },
    { value: 'she/her', label: 'she/her (Ms)' },
    { value: 'they/them', label: 'they/them (Mx)' },
    { value: 'other', label: 'Other' },
]

interface Props {
    students: IStudent[]
    onAdd: (name: string, pronouns: string | null) => void
    onRemove: (studentId: string) => void
}

export default function RosterTab({ students, onAdd, onRemove }: Props) {
    const [name, setName] = useState('')
    const [pronounSelect, setPronounSelect] = useState('')
    const [customPronouns, setCustomPronouns] = useState('')
    const [error, setError] = useState('')
    const [submitted, setSubmitted] = useState(false)
    const confirmRemove = useConfirmRemove<IStudent>()

    const submit = () => {
        setSubmitted(true)
        if (!name.trim()) { setError('Please enter a student name.'); return }
        if (!pronounSelect) { setError('Please select pronouns.'); return }
        if (pronounSelect === 'other' && !customPronouns.trim()) { setError('Please enter custom pronouns.'); return }
        setError('')
        setSubmitted(false)
        const pronouns = pronounSelect === 'other' ? customPronouns.trim() : pronounSelect
        onAdd(name.trim(), pronouns)
        setName(''); setPronounSelect(''); setCustomPronouns('')
    }

    return (
        <div className="roster-tab">
            <form className="roster-add-form" onSubmit={e => { e.preventDefault(); submit() }}>
                <input
                    className={`dash-edit-input ${submitted && !name.trim() ? 'dash-edit-input--invalid' : 'dash-edit-input--valid'}`}
                    placeholder="Student name"
                    value={name}
                    onChange={e => { setName(e.target.value); setError('') }}
                    autoComplete="off"
                />
                <select
                    className={`dash-edit-input ${submitted && !pronounSelect ? 'dash-edit-input--invalid' : 'dash-edit-input--valid'}`}
                    value={pronounSelect}
                    onChange={e => { setPronounSelect(e.target.value); setError('') }}
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
                        onChange={e => { setCustomPronouns(e.target.value); setError('') }}
                    />
                )}
                <button type="submit" className="org-new-btn">+ Add</button>
            </form>
            {error && <p className="sb-config-error">{error}</p>}

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
