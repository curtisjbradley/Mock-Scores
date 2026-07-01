import { useEffect, useState } from 'react'
import { fetchWitnesses, saveWitnesses, fetchFormat, saveFormat } from '../hooks/useTournamentData'
import type { IWitnesses } from '@mock-scores/shared'
import type { CaseFormatState } from '../types/tournament'
import { emptyCaseFormat } from '../types/tournament'
import Section from './Section'
import WitnessNameList from '../../shared/components/WitnessNameList'

const empty: IWitnesses = { pWitnessNames: [], dWitnessNames: [], swingWitnessNames: [] }

interface WitnessValidationError {
    message: string
}

/**
 * Pure validation function for the witnesses + format state.
 * Returns the first validation error found, or null when the state is valid.
 * Extracted to keep `handleSave` below the cognitive complexity threshold.
 */
function validateWitnessForm(witnesses: IWitnesses, format: CaseFormatState): WitnessValidationError | null {
    const allNames = [...witnesses.pWitnessNames, ...witnesses.dWitnessNames, ...witnesses.swingWitnessNames]
    if (allNames.some(n => !n.trim()))
        return { message: 'Witness names cannot be empty' }

    const swingCount = witnesses.swingWitnessNames.length
    const pMax = witnesses.pWitnessNames.length + swingCount
    const dMax = witnesses.dWitnessNames.length + swingCount
    const pCalled = Number(format.pWitnessesCalled)
    const dCalled = Number(format.dWitnessesCalled)

    if ((format.pWitnessesCalled !== '' && pCalled < 0) || (format.dWitnessesCalled !== '' && dCalled < 0))
        return { message: 'Witnesses called cannot be negative' }

    if ((format.pWitnessesCalled !== '' && pMax > 0 && pCalled > pMax) ||
        (format.dWitnessesCalled !== '' && dMax > 0 && dCalled > dMax))
        return { message: 'Witnesses called cannot exceed available witnesses' }

    return null
}

/**
 * Organizer tab for managing witness names and the number called per side.
 * Also controls whether the case has swing witnesses.
 */
export default function WitnessesTab({ tournamentId }: { tournamentId: string }) {
    const [witnesses, setWitnesses] = useState<IWitnesses>(empty)
    const [format, setFormat] = useState<CaseFormatState>(emptyCaseFormat)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [saveSuccess, setSaveSuccess] = useState(false)

    useEffect(() => {
        Promise.all([fetchWitnesses(tournamentId), fetchFormat(tournamentId)])
            .then(([w, f]) => { setWitnesses(w); setFormat(f); setLoading(false) })
            .catch(() => { setLoading(false); setError('Failed to load witnesses.') })
    }, [tournamentId])

    const setWitnessName = (key: keyof IWitnesses, idx: number, value: string) => {
        const arr = [...witnesses[key]]; arr[idx] = value
        setWitnesses({ ...witnesses, [key]: arr })
    }
    const addWitness = (key: keyof IWitnesses) =>
        setWitnesses({ ...witnesses, [key]: [...witnesses[key], ''] })
    const removeWitness = (key: keyof IWitnesses, idx: number) =>
        setWitnesses({ ...witnesses, [key]: witnesses[key].filter((_, i) => i !== idx) })

    const handleSave = async () => {
        const validationError = validateWitnessForm(witnesses, format)
        if (validationError) { setSaveError(validationError.message); return }

        setSaving(true); setSaveError(null); setSaveSuccess(false)
        try {
            await Promise.all([saveWitnesses(tournamentId, witnesses), saveFormat(tournamentId, format)])
            setSaveSuccess(true)
        } catch (e: unknown) {
            setSaveError(e instanceof Error ? e.message : 'Failed to save')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <p className="dash-saving">Loading…</p>

    const hasSwing = witnesses.swingWitnessNames.length > 0

    return (
        <Section title="Witnesses">
            {(error || saveError) && <div className="tc-error-banner">{error ?? saveError}</div>}
            {saveSuccess && <div className="tc-error-banner dash-save-success">Saved successfully</div>}

            {/* Witnesses-called inputs */}
            <div className="tc-row">
                {(['P', 'D'] as const).map(side => {
                    const key = side === 'P' ? 'pWitnessesCalled' : 'dWitnessesCalled'
                    const swingCount = witnesses.swingWitnessNames.length
                    const max = (side === 'P' ? witnesses.pWitnessNames.length : witnesses.dWitnessNames.length) + swingCount
                    const val = format[key]
                    const invalid = val !== '' && (Number(val) < 0 || (max > 0 && Number(val) > max))
                    return (
                        <div key={side} className="tc-field">
                            <label className="tc-label">{side} witnesses called</label>
                            <input type="number" min={0} max={max || undefined}
                                className={`tc-input${invalid ? ' tc-input--invalid' : ''}`}
                                value={val}
                                onChange={e => setFormat({ ...format, [key]: e.target.value === '' ? '' : Number(e.target.value) })} />
                        </div>
                    )
                })}
            </div>

            {/* Prosecution + defense witness name lists */}
            {(['pWitnessNames', 'dWitnessNames'] as const).map((key, si) => (
                <WitnessNameList
                    key={key}
                    label={`${['P', 'D'][si]} witnesses`}
                    names={witnesses[key]}
                    onChangeName={(i, v) => setWitnessName(key, i, v)}
                    onAdd={() => addWitness(key)}
                    onRemove={(i) => removeWitness(key, i)}
                />
            ))}

            <label className="tc-checkbox-label">
                <input type="checkbox" checked={hasSwing}
                    onChange={() => {
                        setWitnesses({ ...witnesses, swingWitnessNames: hasSwing ? [] : [''] })
                        setFormat({ ...format, hasSwing: !hasSwing })
                    }} />
                <span>Case has swing witnesses</span>
            </label>

            {hasSwing && (
                <WitnessNameList
                    label="Swing witnesses"
                    names={witnesses.swingWitnessNames}
                    placeholder={(i) => `Swing witness ${i + 1}`}
                    onChangeName={(i, v) => setWitnessName('swingWitnessNames', i, v)}
                    onAdd={() => addWitness('swingWitnessNames')}
                    onRemove={(i) => removeWitness('swingWitnessNames', i)}
                    addLabel="Add swing witness"
                />
            )}

            <div className="tc-actions">
                <button type="button" className="btn-confirm" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                </button>
            </div>
        </Section>
    )
}
