import { useEffect, useState } from 'react'
import { fetchWitnesses, saveWitnesses, fetchFormat, saveFormat } from '../hooks/useTournamentData'
import type { IWitnesses } from '@mock-scores/shared'
import type { CaseFormatState } from '../types/tournament'
import { emptyCaseFormat } from '../types/tournament'
import Section from './Section'

const empty: IWitnesses = { pWitnessNames: [], dWitnessNames: [], swingWitnessNames: [] }

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
        const allNames = [...witnesses.pWitnessNames, ...witnesses.dWitnessNames, ...witnesses.swingWitnessNames]
        if (allNames.some(n => !n.trim())) { setSaveError('Witness names cannot be empty'); return }
        const swingCount = witnesses.swingWitnessNames.length
        const pMax = witnesses.pWitnessNames.length + swingCount
        const dMax = witnesses.dWitnessNames.length + swingCount
        if ((format.pWitnessesCalled !== '' && Number(format.pWitnessesCalled) < 0) ||
            (format.dWitnessesCalled !== '' && Number(format.dWitnessesCalled) < 0)) {
            setSaveError('Witnesses called cannot be negative'); return
        }
        if ((format.pWitnessesCalled !== '' && pMax > 0 && Number(format.pWitnessesCalled) > pMax) ||
            (format.dWitnessesCalled !== '' && dMax > 0 && Number(format.dWitnessesCalled) > dMax)) {
            setSaveError('Witnesses called cannot exceed available witnesses'); return
        }
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

            {(['pWitnessNames', 'dWitnessNames'] as const).map((key, si) => (
                <div key={key} className="tc-section">
                    <span className="tc-section-label">{['P', 'D'][si]} witnesses</span>
                    <div className="tc-witness-list">
                        {witnesses[key].map((name, i) => (
                            <div key={i} className="tc-witness-row">
                                <input type="text"
                                    className={`tc-input${!name.trim() ? ' tc-input--invalid' : ''}`}
                                    placeholder={`Witness ${i + 1}`} value={name}
                                    onChange={e => setWitnessName(key, i, e.target.value)} />
                                <button type="button" className="tc-remove-btn" onClick={() => removeWitness(key, i)}>×</button>
                            </div>
                        ))}
                    </div>
                    <button type="button" className="tc-add-btn" onClick={() => addWitness(key)}>+ Add witness</button>
                </div>
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
                <div className="tc-section">
                    <span className="tc-section-label">Swing witnesses</span>
                    <div className="tc-witness-list">
                        {witnesses.swingWitnessNames.map((name, i) => (
                            <div key={i} className="tc-witness-row">
                                <input type="text"
                                    className={`tc-input${!name.trim() ? ' tc-input--invalid' : ''}`}
                                    placeholder={`Swing witness ${i + 1}`} value={name}
                                    onChange={e => setWitnessName('swingWitnessNames', i, e.target.value)} />
                                <button type="button" className="tc-remove-btn" onClick={() => removeWitness('swingWitnessNames', i)}>×</button>
                            </div>
                        ))}
                    </div>
                    <button type="button" className="tc-add-btn" onClick={() => addWitness('swingWitnessNames')}>+ Add swing witness</button>
                </div>
            )}

            <div className="tc-actions">
                <button type="button" className="btn-confirm" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                </button>
            </div>
        </Section>
    )
}
