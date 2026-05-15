import type { ScoringCategory, ScoringField } from '../types/tournament'

interface Props {
    cat: ScoringCategory
    submitted: boolean
    draggingId: string | null
    dragOver: string | null
    onDragStart: () => void
    onDragOver: (e: { preventDefault(): void }) => void
    onDragLeave: () => void
    onDrop: () => void
    onDragEnd: () => void
    onUpdateName: (name: string) => void
    onRemoveCategory: () => void
    onUpdateField: (fId: string, key: keyof ScoringField, value: string | boolean | number) => void
    onAddField: () => void
    onRemoveField: (fId: string) => void
    fieldError: (f: ScoringField, isWitness?: boolean) => boolean
}

export default function ScoringCategoryCard({
    cat, submitted, draggingId, dragOver,
    onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
    onUpdateName, onRemoveCategory, onUpdateField, onAddField, onRemoveField, fieldError,
}: Props) {
    return (
        <div
            className={`sf-category-card${dragOver === cat.id && draggingId !== cat.id ? ' sf-category-card--over' : ''}${draggingId === cat.id ? ' sf-category-card--dragging' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
        >
            <div className="sf-category-header">
                <span className="sf-drag-handle" aria-hidden draggable onDragStart={onDragStart}>⠿</span>
                <input type="text"
                    className={`tc-input sf-cat-name${cat.witnessCategory ? ' sf-cat-name--locked' : ''}`}
                    value={cat.name} placeholder="Category name"
                    onChange={e => onUpdateName(e.target.value)}
                    readOnly={cat.witnessCategory}
                    title={cat.witnessCategory ? 'Witness category names cannot be renamed' : undefined}
                />
                <button type="button" className="tc-remove-btn" onClick={onRemoveCategory}
                    style={cat.witnessCategory ? { visibility: 'hidden' } : undefined}>×</button>
            </div>
            <div className="sf-table-wrap">
                <table className="sf-table">
                    <thead><tr>
                        <th>Role</th><th>Min</th><th>Max</th><th>Multiplier</th>
                        <th>Assignable</th><th>Award</th><th>Visible</th>
                        {!cat.witnessCategory && <><th>P</th><th>D</th></>}
                        {cat.witnessCategory && <><th>Calling</th><th>Crossing</th></>}
                        <th></th>
                    </tr></thead>
                    <tbody>
                        {cat.fields.map(f => {
                            const err = submitted && fieldError(f, cat.witnessCategory)
                            return (
                                <tr key={f.id} className={err ? 'sf-row sf-row--error' : 'sf-row'}>
                                    <td><input type="text" className="tc-input sf-label-input" value={f.label} placeholder="Role name" onChange={e => onUpdateField(f.id, 'label', e.target.value)} /></td>
                                    <td><input type="number" className={`tc-input sf-num${err ? ' tc-input--invalid' : ''}`} value={f.min} onChange={e => onUpdateField(f.id, 'min', +e.target.value)} /></td>
                                    <td><input type="number" className={`tc-input sf-num${err ? ' tc-input--invalid' : ''}`} value={f.max} onChange={e => onUpdateField(f.id, 'max', +e.target.value)} /></td>
                                    <td><input type="number" step="0.1" className={`tc-input sf-num${err ? ' tc-input--invalid' : ''}`} value={f.multiplier} onChange={e => onUpdateField(f.id, 'multiplier', +e.target.value)} /></td>
                                    <td className="sf-assignable-cell"><input type="checkbox" checked={f.assignable} onChange={e => onUpdateField(f.id, 'assignable', e.target.checked)} /></td>
                                    <td className="sf-assignable-cell"><input type="checkbox" checked={f.eligibleForAward} onChange={e => onUpdateField(f.id, 'eligibleForAward', e.target.checked)} /></td>
                                    <td className="sf-assignable-cell"><input type="checkbox" checked={f.visibleToScorers} onChange={e => onUpdateField(f.id, 'visibleToScorers', e.target.checked)} /></td>
                                    {!cat.witnessCategory && <td className="sf-assignable-cell"><input type="checkbox" checked={f.prosecution} onChange={e => onUpdateField(f.id, 'prosecution', e.target.checked)} /></td>}
                                    {!cat.witnessCategory && <td className="sf-assignable-cell"><input type="checkbox" checked={f.defense} onChange={e => onUpdateField(f.id, 'defense', e.target.checked)} /></td>}
                                    {cat.witnessCategory && <td className="sf-assignable-cell"><input type="checkbox" checked={f.calling} onChange={e => onUpdateField(f.id, 'calling', e.target.checked)} /></td>}
                                    {cat.witnessCategory && <td className="sf-assignable-cell"><input type="checkbox" checked={f.crossing} onChange={e => onUpdateField(f.id, 'crossing', e.target.checked)} /></td>}
                                    <td className="sf-remove-cell"><button type="button" className="tc-remove-btn" onClick={() => onRemoveField(f.id)}>×</button></td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            <button type="button" className="tc-add-btn" onClick={onAddField}>+ Add field</button>
        </div>
    )
}
