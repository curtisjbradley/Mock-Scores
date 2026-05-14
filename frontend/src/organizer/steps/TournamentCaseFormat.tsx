import { useState } from 'react'
import type { CaseFormatState } from '../types/tournament'

interface Props {
    caseFormat: CaseFormatState
    onChange: (cf: CaseFormatState) => void
    onNext: () => void
    onBack: () => void
}

export default function TournamentCaseFormat({ caseFormat, onChange, onNext, onBack }: Props) {
    const [submitted, setSubmitted] = useState(false)

    const pCalled = caseFormat.pWitnessesCalled === '' ? 0 : Number(caseFormat.pWitnessesCalled)
    const dCalled = caseFormat.dWitnessesCalled === '' ? 0 : Number(caseFormat.dWitnessesCalled)
    const swingCount = caseFormat.hasSwing ? caseFormat.swingWitnessNames.length : 0
    const pAvailable = caseFormat.pWitnessNames.length + swingCount
    const dAvailable = caseFormat.dWitnessNames.length + swingCount

    const witnessNameErrors = [
        ...caseFormat.pWitnessNames.map((n, i) => !n.trim() ? `P witness ${i + 1}` : ''),
        ...caseFormat.dWitnessNames.map((n, i) => !n.trim() ? `D witness ${i + 1}` : ''),
        ...(caseFormat.hasSwing ? caseFormat.swingWitnessNames.map((n, i) => !n.trim() ? `Swing ${i + 1}` : '') : []),
    ].filter(Boolean)

    const errors = {
        caseName: !caseFormat.caseName.trim() ? 'Required' : '',
        pWitnessesCalled: caseFormat.pWitnessesCalled === '' ? 'Required' : pCalled < 0 ? 'Must be ≥ 0' : pCalled > pAvailable ? `Only ${pAvailable} have been defined` : '',
        dWitnessesCalled: caseFormat.dWitnessesCalled === '' ? 'Required' : dCalled < 0 ? 'Must be ≥ 0' : dCalled > dAvailable ? `Only ${dAvailable} have been defined` : '',
    }

    const handleSubmit = (e: { preventDefault(): void }) => {
        e.preventDefault()
        setSubmitted(true)
        if (!errors.caseName && !errors.pWitnessesCalled && !errors.dWitnessesCalled && !witnessNameErrors.length) onNext()
    }

    const setWitnessName = (key: 'pWitnessNames' | 'dWitnessNames' | 'swingWitnessNames', idx: number) =>
        (e: { target: { value: string } }) => {
            const arr = [...caseFormat[key]]; arr[idx] = e.target.value
            onChange({ ...caseFormat, [key]: arr })
        }
    const addWitness = (key: 'pWitnessNames' | 'dWitnessNames' | 'swingWitnessNames') =>
        () => onChange({ ...caseFormat, [key]: [...caseFormat[key], ''] })
    const removeWitness = (key: 'pWitnessNames' | 'dWitnessNames' | 'swingWitnessNames', idx: number) =>
        () => onChange({ ...caseFormat, [key]: caseFormat[key].filter((_, i) => i !== idx) })

    const sideLabel = caseFormat.criminalCase ? ['Prosecution', 'Defense'] : ['Plaintiff', 'Defense']

    return (
        <form className="tc-form" onSubmit={handleSubmit} noValidate>
            <div className="tc-field">
                <label className="tc-label" htmlFor="caseName">Case name</label>
                <input id="caseName" type="text" autoFocus
                    className={`tc-input${submitted && errors.caseName ? ' tc-input--invalid' : ''}`}
                    value={caseFormat.caseName}
                    placeholder="e.g. People v. Fromholz"
                    onChange={e => onChange({ ...caseFormat, caseName: e.target.value })}
                />
                {submitted && errors.caseName && <span className="tc-field-error">{errors.caseName}</span>}
            </div>

            <label className="tc-checkbox-label">
                <input type="checkbox" checked={caseFormat.criminalCase}
                    onChange={() => onChange({ ...caseFormat, criminalCase: !caseFormat.criminalCase })} />
                Criminal case
            </label>

            {(['P', 'D'] as const).map((side, si) => {
                const namesKey = side === 'P' ? 'pWitnessNames' : 'dWitnessNames'
                const calledKey = side === 'P' ? 'pWitnessesCalled' : 'dWitnessesCalled'
                return (
                    <div key={side} className="tc-section">
                        <span className="tc-section-label">{sideLabel[si]} witnesses</span>
                        <div className="tc-witness-list">
                            {caseFormat[namesKey].map((name, i) => (
                                <div key={i} className="tc-witness-row">
                                    <input type="text"
                                        className={`tc-input${submitted && !name.trim() ? ' tc-input--invalid' : ''}`}
                                        placeholder={`Witness ${i + 1}`} value={name}
                                        onChange={setWitnessName(namesKey, i)}
                                    />
                                    <button type="button" className="tc-remove-btn" onClick={removeWitness(namesKey, i)}>×</button>
                                </div>
                            ))}
                            {submitted && caseFormat[namesKey].some(n => !n.trim()) &&
                                <span className="tc-field-error">All witness names are required</span>}
                        </div>
                        <button type="button" className="tc-add-btn" onClick={addWitness(namesKey)}>
                            + Add witness
                        </button>
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
                <div className="tc-section">
                    <span className="tc-section-label">Swing witnesses</span>
                    <div className="tc-witness-list">
                        {caseFormat.swingWitnessNames.map((name, i) => (
                            <div key={i} className="tc-witness-row">
                                <input type="text"
                                    className={`tc-input${submitted && !name.trim() ? ' tc-input--invalid' : ''}`}
                                    placeholder={`Swing witness ${i + 1}`} value={name}
                                    onChange={setWitnessName('swingWitnessNames', i)}
                                />
                                <button type="button" className="tc-remove-btn" onClick={removeWitness('swingWitnessNames', i)}>×</button>
                            </div>
                        ))}
                        {submitted && caseFormat.swingWitnessNames.some(n => !n.trim()) &&
                            <span className="tc-field-error">All witness names are required</span>}
                    </div>
                    <button type="button" className="tc-add-btn" onClick={addWitness('swingWitnessNames')}>
                        + Add swing witness
                    </button>
                </div>
            )}

            <div className="tc-actions">
                <button type="button" className="tc-cancel-btn" onClick={onBack}>← Back</button>
                <button type="submit" className="org-new-btn">Next →</button>
            </div>
        </form>
    )
}
