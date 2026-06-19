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

    const hasBlankWitness = [...caseFormat.pWitnessNames, ...caseFormat.dWitnessNames, ...(caseFormat.hasSwing ? caseFormat.swingWitnessNames : [])].some(n => !n.trim())

    const errors = {
        caseName: !caseFormat.caseName.trim() ? 'Required' : '',
        witnessNames: hasBlankWitness ? 'All witness names are required' : '',
        pWitnessesCalled: caseFormat.pWitnessesCalled === '' ? 'Required' : pCalled < 0 ? 'Must be ≥ 0' : pCalled > pAvailable ? `Only ${pAvailable} have been defined` : '',
        dWitnessesCalled: caseFormat.dWitnessesCalled === '' ? 'Required' : dCalled < 0 ? 'Must be ≥ 0' : dCalled > dAvailable ? `Only ${dAvailable} have been defined` : '',
    }

    const handleSubmit = (e: { preventDefault(): void }) => {
        e.preventDefault()
        setSubmitted(true)
        if (!errors.caseName && !errors.witnessNames && !errors.pWitnessesCalled && !errors.dWitnessesCalled) onNext()
    }

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
                const names = caseFormat[namesKey]
                const setName = (i: number, val: string) => {
                    const arr = [...names]; arr[i] = val
                    onChange({ ...caseFormat, [namesKey]: arr })
                }
                return (
                    <div key={side} className="tc-section">
                        <span className="tc-section-label">{sideLabel[si]} witnesses</span>
                        <div className="tc-witness-list">
                            {names.map((name, i) => (
                                <div key={i} className="tc-witness-row">
                                    <input type="text"
                                        className={`tc-input${submitted && !name.trim() ? ' tc-input--invalid' : ''}`}
                                        placeholder={`Witness ${i + 1}`} value={name}
                                        onChange={e => setName(i, e.target.value)} />
                                    <button type="button" className="tc-remove-btn"
                                        onClick={() => onChange({ ...caseFormat, [namesKey]: names.filter((_, j) => j !== i) })}>×</button>
                                </div>
                            ))}
                        </div>
                        <button type="button" className="tc-add-btn"
                            onClick={() => onChange({ ...caseFormat, [namesKey]: [...names, ''] })}>+ Add witness</button>
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
                                    onChange={e => { const arr = [...caseFormat.swingWitnessNames]; arr[i] = e.target.value; onChange({ ...caseFormat, swingWitnessNames: arr }) }} />
                                <button type="button" className="tc-remove-btn"
                                    onClick={() => onChange({ ...caseFormat, swingWitnessNames: caseFormat.swingWitnessNames.filter((_, j) => j !== i) })}>×</button>
                            </div>
                        ))}
                    </div>
                    <button type="button" className="tc-add-btn"
                        onClick={() => onChange({ ...caseFormat, swingWitnessNames: [...caseFormat.swingWitnessNames, ''] })}>+ Add swing witness</button>
                </div>
            )}

            {submitted && errors.witnessNames && <span className="tc-field-error">{errors.witnessNames}</span>}

            <div className="tc-actions">
                <button type="button" className="btn-cancel" onClick={onBack}>← Back</button>
                <button type="submit" className="btn-confirm">Next →</button>
            </div>
        </form>
    )
}
