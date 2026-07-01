import { useState } from 'react'
import type { CaseFormatState } from '../types/tournament'
import FormField from '../../shared/components/FormField'
import WitnessNameList from '../../shared/components/WitnessNameList'

interface Props {
    caseFormat: CaseFormatState
    onChange: (cf: CaseFormatState) => void
    onNext: () => void
    onBack: () => void
}

/** Returns an error string for witnesses-called, or '' when valid. */
function calledError(called: number | '', available: number): string {
    if (called === '') return 'Required'
    if (Number(called) < 0) return 'Must be ≥ 0'
    if (Number(called) > available) return `Only ${available} have been defined`
    return ''
}

/** Derives validation errors from the current case format state. */
function getErrors(cf: CaseFormatState) {
    const swingCount  = cf.hasSwing ? cf.swingWitnessNames.length : 0
    const pAvailable  = cf.pWitnessNames.length + swingCount
    const dAvailable  = cf.dWitnessNames.length + swingCount
    const hasBlankWitness = [
        ...cf.pWitnessNames, ...cf.dWitnessNames,
        ...(cf.hasSwing ? cf.swingWitnessNames : []),
    ].some(n => !n.trim())
    return {
        caseName:         !cf.caseName.trim() ? 'Required' : '',
        witnessNames:     hasBlankWitness ? 'All witness names are required' : '',
        pWitnessesCalled: calledError(cf.pWitnessesCalled, pAvailable),
        dWitnessesCalled: calledError(cf.dWitnessesCalled, dAvailable),
    }
}

/**
 * Step 2 of the tournament creation wizard: case format configuration.
 * Captures case name, criminal/civil toggle, prosecution/defense witness
 * lists, witnesses-called counts, and optional swing witnesses.
 */
export default function TournamentCaseFormat({ caseFormat, onChange, onNext, onBack }: Props) {
    const [submitted, setSubmitted] = useState(false)
    const errors = getErrors(caseFormat)

    const handleSubmit = (e: { preventDefault(): void }) => {
        e.preventDefault()
        setSubmitted(true)
        if (!errors.caseName && !errors.witnessNames && !errors.pWitnessesCalled && !errors.dWitnessesCalled) onNext()
    }

    const sideLabel = caseFormat.criminalCase ? ['Prosecution', 'Defense'] : ['Plaintiff', 'Defense']

    return (
        <form className="tc-form" onSubmit={handleSubmit} noValidate>
            <FormField
                id="caseName"
                label="Case name"
                autoFocus
                value={caseFormat.caseName}
                placeholder="e.g. People v. Fromholz"
                submitted={submitted}
                error={errors.caseName}
                onChange={e => onChange({ ...caseFormat, caseName: e.target.value })}
            />

            <label className="tc-checkbox-label">
                <input type="checkbox" checked={caseFormat.criminalCase}
                    onChange={() => onChange({ ...caseFormat, criminalCase: !caseFormat.criminalCase })} />
                Criminal case
            </label>

            {(['P', 'D'] as const).map((side, si) => {
                const namesKey  = side === 'P' ? 'pWitnessNames'      : 'dWitnessNames'
                const calledKey = side === 'P' ? 'pWitnessesCalled'   : 'dWitnessesCalled'
                return (
                    <div key={side}>
                        <WitnessNameList
                            label={`${sideLabel[si]} witnesses`}
                            names={caseFormat[namesKey]}
                            showErrors={submitted}
                            onChangeName={(i, v) => {
                                const arr = [...caseFormat[namesKey]]; arr[i] = v
                                onChange({ ...caseFormat, [namesKey]: arr })
                            }}
                            onAdd={() => onChange({ ...caseFormat, [namesKey]: [...caseFormat[namesKey], ''] })}
                            onRemove={(i) => onChange({ ...caseFormat, [namesKey]: caseFormat[namesKey].filter((_, j) => j !== i) })}
                        />
                        <div className="tc-field">
                            <label className="tc-label">Witnesses called per trial</label>
                            <input type="number" min={0}
                                className={`tc-input${submitted && errors[calledKey] ? ' tc-input--invalid' : ''}`}
                                value={caseFormat[calledKey]}
                                onChange={e => onChange({ ...caseFormat, [calledKey]: e.target.value === '' ? '' : Number(e.target.value) })}
                            />
                            {submitted && errors[calledKey] && <span className="tc-field-error">{errors[calledKey]}</span>}
                        </div>
                    </div>
                )
            })}

            <label className="tc-checkbox-label">
                <input type="checkbox" checked={caseFormat.hasSwing}
                    onChange={() => onChange({ ...caseFormat, hasSwing: !caseFormat.hasSwing })} />
                Case has swing witnesses
            </label>

            {caseFormat.hasSwing && (
                <WitnessNameList
                    label="Swing witnesses"
                    names={caseFormat.swingWitnessNames}
                    placeholder={(i) => `Swing witness ${i + 1}`}
                    showErrors={submitted}
                    onChangeName={(i, v) => {
                        const arr = [...caseFormat.swingWitnessNames]; arr[i] = v
                        onChange({ ...caseFormat, swingWitnessNames: arr })
                    }}
                    onAdd={() => onChange({ ...caseFormat, swingWitnessNames: [...caseFormat.swingWitnessNames, ''] })}
                    onRemove={(i) => onChange({ ...caseFormat, swingWitnessNames: caseFormat.swingWitnessNames.filter((_, j) => j !== i) })}
                    addLabel="Add swing witness"
                />
            )}

            {submitted && errors.witnessNames && <span className="tc-field-error">{errors.witnessNames}</span>}

            <div className="tc-actions">
                <button type="button" className="btn-cancel" onClick={onBack}>← Back</button>
                <button type="submit" className="btn-confirm">Next →</button>
            </div>
        </form>
    )
}
