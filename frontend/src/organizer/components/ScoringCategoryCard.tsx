import type { ScoringCategory, ScoringField } from '../types/tournament'
import type { IIndividualAwardCategory } from '@mock-scores/shared'
import DangerButton from '../../shared/components/DangerButton'
import AddButton from '../../shared/components/AddButton'
import Tooltip from "../../shared/components/Tooltip.tsx";

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
    onUpdateField: (fId: string, key: keyof ScoringField, value: string | boolean | number | null) => void
    onAddField: () => void
    onRemoveField: (fId: string) => void
    fieldError: (f: ScoringField, isWitness?: boolean) => boolean
    awardCategories?: IIndividualAwardCategory[]
}

export default function ScoringCategoryCard({
    cat, submitted, draggingId, dragOver,
    onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
    onUpdateName, onRemoveCategory, onUpdateField, onAddField, onRemoveField, fieldError,
    awardCategories,
}: Props) {

    const removeButton = <DangerButton
        variant="solid"
        aria-label="Remove category"
        onClick={onRemoveCategory}
        disabled={cat.witnessCategory ?? false}
    >Remove Category</DangerButton>
    return (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
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
                {cat.witnessCategory ? <Tooltip content={<p>This category cannot be removed.</p>} children={[removeButton]}/> : removeButton}
            </div>
            <div className="sf-table-wrap">
                <table className="sf-table">
                    <thead><tr>
                        <th>Role</th><th>Min</th><th>Max</th><th>Multiplier</th>
                         <th>
                            <Tooltip placement="bottom" content={<p>Allows coaches to assign a student to the score. Uncheck this for fields like sportsmanship and deductions.</p>}>
                                <span className="sf-th-info">Assignable</span>
                            </Tooltip>
                        </th>
                        <th><Tooltip placement="bottom" content={<p>The award category this position is eligible for.</p>}>
                            <span className="sf-th-info">Award</span>
                        </Tooltip></th><th><Tooltip placement="bottom" content={<p>Visible fields are ones that scorers will enter. Nonvisible fields may be used by organizers to enforce point deductions.</p>}>
                        <span className="sf-th-info">Visible</span>
                    </Tooltip></th>
                        {!cat.witnessCategory && <><th>
                            <Tooltip placement="bottom" content={<p>Points go the Prosecution.</p>}>
                                <span className="sf-th-info">P</span>
                            </Tooltip>
                        </th><th>
                            <Tooltip placement="bottom" content={<p>Points go the Defense.</p>}>
                            <span className="sf-th-info">D</span>
                        </Tooltip></th></>}
                        {cat.witnessCategory && <>
                            <th>
                                <Tooltip placement="bottom" content={<p>Points go the side calling the witness.</p>}>
                                    <span className="sf-th-info">Calling</span>
                                </Tooltip>
                            </th>
                            <th>
                                <Tooltip placement="bottom" content={<p>Points go to the side crossing the witness.</p>}>
                                    <span className="sf-th-info">Crossing</span>
                                </Tooltip>
                            </th>
                        </>}
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
                                    <td className="sf-assignable-cell"><input type="checkbox" checked={f.assignable} onChange={e => onUpdateField(f.id, 'assignable', e.target.checked)} /> </td>
                                    <td className="sf-award-cell">
                                        <select className="tc-input sf-award-select" value={f.awardCategoryId ?? ''} onChange={e => {
                                            const val = e.target.value || null
                                            onUpdateField(f.id, 'awardCategoryId', val)
                                        }}>
                                            <option value="">None</option>
                                            {awardCategories?.map(ac => (
                                                <option key={ac.id} value={ac.id}>{ac.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="sf-assignable-cell"><input type="checkbox" checked={f.visibleToScorers} onChange={e => onUpdateField(f.id, 'visibleToScorers', e.target.checked)} /></td>
                                    {!cat.witnessCategory && <td className="sf-assignable-cell"><input type="checkbox" checked={f.prosecution} onChange={e => onUpdateField(f.id, 'prosecution', e.target.checked)} /></td>}
                                    {!cat.witnessCategory && <td className="sf-assignable-cell"><input type="checkbox" checked={f.defense} onChange={e => onUpdateField(f.id, 'defense', e.target.checked)} /></td>}
                                    {cat.witnessCategory && <td className="sf-assignable-cell"><input type="checkbox" checked={f.calling} onChange={e => onUpdateField(f.id, 'calling', e.target.checked)} /></td>}
                                    {cat.witnessCategory && <td className="sf-assignable-cell"><input type="checkbox" checked={f.crossing} onChange={e => onUpdateField(f.id, 'crossing', e.target.checked)} /></td>}
                                    <td ><DangerButton variant="subtle" aria-label="Remove field" onClick={() => onRemoveField(f.id)}>Remove</DangerButton></td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            <AddButton variant="dashed" onClick={onAddField}>+ Add field</AddButton>
        </div>
    )
}
