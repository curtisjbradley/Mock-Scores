import { useState } from 'react'
import type { AwardCategory } from '../types/tournament'
import { makeAwardCategory } from '../types/tournament'
import DangerButton from '../../shared/components/DangerButton'
import AddButton from '../../shared/components/AddButton'
import '../styles/organizer.css'

interface Props {
    awardCategories: AwardCategory[]
    onChange: (categories: AwardCategory[]) => void
    onNext: () => void
    onBack: () => void
}

/** Returns an error string for an award category row, or '' when valid. */
function rowError(ac: AwardCategory): string {
    if (!ac.name.trim()) return 'Name is required'
    if (ac.minNominees < 0) return 'Min nominees must be ≥ 0'
    if (ac.maxNominees < 1) return 'Max nominees must be ≥ 1'
    if (ac.minNominees > ac.maxNominees) return 'Min cannot exceed max'
    return ''
}

/**
 * Manual-branch step: define the individual award categories that scorers will
 * nominate students for (e.g. "Best Attorney", "Best Witness"). These are then
 * linkable to scoring fields in the next step.
 */
export default function TournamentAwards({ awardCategories, onChange, onNext, onBack }: Props) {
    const [submitted, setSubmitted] = useState(false)

    const update = (id: string, patch: Partial<AwardCategory>) =>
        onChange(awardCategories.map(ac => ac.id === id ? { ...ac, ...patch } : ac))
    const add = () => onChange([...awardCategories, makeAwardCategory()])
    const remove = (id: string) => onChange(awardCategories.filter(ac => ac.id !== id))

    const errors = awardCategories.map(rowError)
    const hasErrors = errors.some(Boolean)

    const handleSubmit = (e: { preventDefault(): void }) => {
        e.preventDefault()
        setSubmitted(true)
        // Award categories are optional; only block on invalid rows.
        if (!hasErrors) onNext()
    }

    return (
        <form className="tc-form sf-form" onSubmit={handleSubmit} noValidate>
            <p className="ts-note">
                Define award categories that scorers can nominate students for after
                submitting a ballot. You can link scoring fields to these categories in the
                next step. This step is optional.
            </p>

            {awardCategories.map((ac, i) => (
                <div key={ac.id} className="tc-card" style={{ padding: '1rem' }}>
                    <div className="tc-field">
                        <label className="tc-label" htmlFor={`ac-name-${ac.id}`}>Category name</label>
                        <input
                            id={`ac-name-${ac.id}`}
                            type="text"
                            className={`tc-input${submitted && errors[i] ? ' tc-input--invalid' : ''}`}
                            value={ac.name}
                            placeholder="e.g. Best Attorney"
                            onChange={e => update(ac.id, { name: e.target.value })}
                        />
                    </div>
                    <div className="tc-field" style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                            <label className="tc-label" htmlFor={`ac-min-${ac.id}`}>Min nominees</label>
                            <input
                                id={`ac-min-${ac.id}`}
                                type="number"
                                min={0}
                                className="tc-input"
                                value={ac.minNominees}
                                onChange={e => update(ac.id, { minNominees: Number(e.target.value) })}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="tc-label" htmlFor={`ac-max-${ac.id}`}>Max nominees</label>
                            <input
                                id={`ac-max-${ac.id}`}
                                type="number"
                                min={1}
                                className="tc-input"
                                value={ac.maxNominees}
                                onChange={e => update(ac.id, { maxNominees: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                    {submitted && errors[i] && <span className="tc-field-error">{errors[i]}</span>}
                    <DangerButton onClick={() => remove(ac.id)}>Remove Category</DangerButton>
                </div>
            ))}

            <AddButton variant="dashed" onClick={add}>+ Add award category</AddButton>

            {submitted && hasErrors && <div className="tc-error-banner">Fix the highlighted award categories before continuing.</div>}

            <div className="tc-actions">
                <button type="button" className="btn-cancel" onClick={onBack}>← Back</button>
                <button type="submit" className="btn-confirm">Next →</button>
            </div>
        </form>
    )
}
