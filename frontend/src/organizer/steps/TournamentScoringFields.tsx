import { useState, useRef } from 'react'
import type { ScoringCategory, ScoringField, CaseFormatState } from '../types/tournament'
import { makeField, makeCategory } from '../types/tournament'
import ScoringCategoryCard from '../components/ScoringCategoryCard'
import type { IIndividualAwardCategory } from '@mock-scores/shared'

interface Props {
    categories: ScoringCategory[]
    onChange: (cats: ScoringCategory[]) => void
    caseFormat: CaseFormatState
    onSubmit: () => void
    onBack?: () => void
    isEditing?: boolean
    submitLabel?: string
    awardCategories?: IIndividualAwardCategory[]
}

export default function TournamentScoringFields({ categories, onChange, caseFormat, onSubmit, isEditing, submitLabel, awardCategories }: Props) {
    const [submitted, setSubmitted] = useState(false)
    const dragId = useRef<string | null>(null)
    const [draggingId, setDraggingId] = useState<string | null>(null)
    const [dragOver, setDragOver] = useState<string | null>(null)

    const reorder = (overId: string) => {
        if (!dragId.current || dragId.current === overId) return
        const from = categories.findIndex(c => c.id === dragId.current)
        const to = categories.findIndex(c => c.id === overId)
        const next = [...categories]
        next.splice(to, 0, next.splice(from, 1)[0])
        onChange(next)
    }

    const updateCatName = (catId: string, name: string) => { onChange(categories.map(c => c.id === catId ? { ...c, name } : c)) }
    const removeCategory = (catId: string) => { onChange(categories.filter(c => c.id !== catId)) }
    const addCategory = () => { onChange([...categories, makeCategory()]) }
    const updateField = (catId: string, fId: string, key: keyof ScoringField, value: string | boolean | number | null) => {
        onChange(categories.map(c => c.id !== catId ? c : { ...c, fields: c.fields.map(f => f.id === fId ? { ...f, [key]: value } : f) }))
    }
    const addField = (catId: string) => { onChange(categories.map(c => c.id !== catId ? c : { ...c, fields: [...c.fields, makeField()] })) }
    const removeField = (catId: string, fId: string) => { onChange(categories.map(c => c.id !== catId ? c : { ...c, fields: c.fields.filter(f => f.id !== fId) })) }

    const fieldError = (f: ScoringField, isWitness?: boolean) => {
        if (isNaN(f.min) || isNaN(f.max) || isNaN(f.multiplier) || f.min > f.max || f.multiplier === 0) return true
        return isWitness ? !f.calling && !f.crossing : !f.prosecution && !f.defense
    }

    const allFields = categories.flatMap(c => c.fields.map(f => ({ f, isWitness: !!c.witnessCategory })))
    const hasErrors = submitted && allFields.some(({ f, isWitness }) => fieldError(f, isWitness))

    const handleSubmit = (e: { preventDefault(): void }) => {
        e.preventDefault()
        setSubmitted(true)
        if (!allFields.some(({ f, isWitness }) => fieldError(f, isWitness))) onSubmit()
    }

    const pWitnesses = Number(caseFormat.pWitnessesCalled) || 0
    const dWitnesses = Number(caseFormat.dWitnessesCalled) || 0
    let pMax = 0, dMax = 0
    categories.forEach(cat => cat.fields.forEach(f => {
        const pts = f.max * f.multiplier
        if (cat.witnessCategory) {
            if (f.calling)  { pMax += pts * pWitnesses; dMax += pts * dWitnesses }
            if (f.crossing) { pMax += pts * dWitnesses; dMax += pts * pWitnesses }
        } else {
            if (f.prosecution) pMax += pts
            if (f.defense)     dMax += pts
        }
    }))

    return (
        <form className="tc-form sf-form" onSubmit={handleSubmit} noValidate>
            {categories.map(cat => (
                <ScoringCategoryCard
                    key={cat.id}
                    cat={cat}
                    submitted={submitted}
                    draggingId={draggingId}
                    dragOver={dragOver}
                    onDragStart={() => { dragId.current = cat.id; setDraggingId(cat.id) }}
                    onDragOver={e => { e.preventDefault(); setDragOver(cat.id) }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={() => { reorder(cat.id); setDragOver(null) }}
                    onDragEnd={() => { dragId.current = null; setDraggingId(null); setDragOver(null) }}
                    onUpdateName={name => updateCatName(cat.id, name)}
                    onRemoveCategory={() => removeCategory(cat.id)}
                    onUpdateField={(fId, key, val) => updateField(cat.id, fId, key, val)}
                    onAddField={() => addField(cat.id)}
                    onRemoveField={fId => removeField(cat.id, fId)}
                    fieldError={fieldError}
                    awardCategories={awardCategories}
                />
            ))}

            <button type="button" className="tc-add-btn" onClick={addCategory}>+ Add category</button>

            {hasErrors && <div className="tc-error-banner">Fix invalid fields: min ≤ max, multiplier ≠ 0, and each row needs a side.</div>}

            <div className="sf-max-scores">
                <span>Max score — P: <strong>{pMax}</strong></span>
                <span>D: <strong>{dMax}</strong></span>
            </div>
            {pMax !== dMax && <div className="tc-error-banner">Max scores are unequal — P: {pMax}, D: {dMax}.</div>}

            <div className="tc-actions">
                <button type="submit" className="btn-confirm">{submitLabel ?? (isEditing ? 'Save changes' : 'Create tournament')}</button>
            </div>
        </form>
    )
}
