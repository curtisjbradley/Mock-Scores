interface WitnessNameListProps {
    /** Label shown above the list (e.g. "Prosecution witnesses") */
    label: string
    /** Current array of witness name strings */
    names: string[]
    /** Placeholder for each individual input (e.g. "Witness 1") */
    placeholder?: (index: number) => string
    /** Whether to highlight blank names as invalid */
    showErrors?: boolean
    /** Called when a single name changes */
    onChangeName: (index: number, value: string) => void
    /** Called when the + Add button is clicked */
    onAdd: () => void
    /** Called when the × remove button is clicked */
    onRemove: (index: number) => void
    /** Text for the add button (default "Add witness") */
    addLabel?: string
}

/**
 * Renders a labelled list of witness name inputs with add/remove controls.
 * Extracted from `WitnessesTab` and `TournamentCaseFormat` to eliminate the
 * duplicated witness-row JSX pattern.
 *
 * @example
 * <WitnessNameList
 *   label="Prosecution witnesses"
 *   names={witnesses.pWitnessNames}
 *   showErrors={hasSubmitted}
 *   onChangeName={(i, v) => setName('pWitnessNames', i, v)}
 *   onAdd={() => addWitness('pWitnessNames')}
 *   onRemove={(i) => removeWitness('pWitnessNames', i)}
 * />
 */
export default function WitnessNameList({
    label,
    names,
    placeholder = (i) => `Witness ${i + 1}`,
    showErrors = false,
    onChangeName,
    onAdd,
    onRemove,
    addLabel = 'Add witness',
}: WitnessNameListProps) {
    return (
        <div className="tc-section">
            <span className="tc-section-label">{label}</span>
            <div className="tc-witness-list">
                {names.map((name, i) => (
                    <div key={i} className="tc-witness-row">
                        <input
                            type="text"
                            className={`tc-input${showErrors && !name.trim() ? ' tc-input--invalid' : ''}`}
                            placeholder={placeholder(i)}
                            value={name}
                            onChange={e => onChangeName(i, e.target.value)}
                        />
                        <button type="button" className="tc-remove-btn" onClick={() => onRemove(i)}>×</button>
                    </div>
                ))}
            </div>
            <button type="button" className="tc-add-btn" onClick={onAdd}>+ {addLabel}</button>
        </div>
    )
}
