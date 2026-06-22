import { Component } from 'react'
import type { ChangeEvent } from 'react'
import { fetchWitnesses, saveWitnesses, fetchFormat, saveFormat } from '../hooks/useTournamentData'
import type { IWitnesses } from '@mock-scores/shared'
import type { CaseFormatState } from '../types/tournament'
import { emptyCaseFormat } from '../types/tournament'
import Section from './Section'

interface State {
    witnesses: IWitnesses
    format: CaseFormatState
    loading: boolean
    error: string | null
    saving: boolean
    saveError: string | null
    saveSuccess: boolean
}

const empty: IWitnesses = { pWitnessNames: [], dWitnessNames: [], swingWitnessNames: [] }

export default class WitnessesTab extends Component<{ tournamentId: string }, State> {
    state: State = { witnesses: empty, format: emptyCaseFormat, loading: true, error: null, saving: false, saveError: null, saveSuccess: false }

    componentDidMount() {
        Promise.all([
            fetchWitnesses(this.props.tournamentId),
            fetchFormat(this.props.tournamentId),
        ]).then(([witnesses, format]) => this.setState({ witnesses, format, loading: false }))
          .catch(() => this.setState({ loading: false, error: 'Failed to load witnesses.' }))
    }

    set = (key: keyof IWitnesses, idx: number) => (e: ChangeEvent<HTMLInputElement>) => {
        const arr = [...this.state.witnesses[key]]; arr[idx] = e.target.value
        this.setState({ witnesses: { ...this.state.witnesses, [key]: arr } })
    }
    add = (key: keyof IWitnesses) => () =>
        this.setState({ witnesses: { ...this.state.witnesses, [key]: [...this.state.witnesses[key], ''] } })
    remove = (key: keyof IWitnesses, idx: number) => () =>
        this.setState({ witnesses: { ...this.state.witnesses, [key]: this.state.witnesses[key].filter((_, i) => i !== idx) } })

    handleSave = async () => {
        const { format, witnesses } = this.state
        const allNames = [...witnesses.pWitnessNames, ...witnesses.dWitnessNames, ...witnesses.swingWitnessNames]
        if (allNames.some(n => !n.trim())) {
            this.setState({ saveError: 'Witness names cannot be empty' })
            return
        }
        const swingCount = witnesses.swingWitnessNames.length
        const pMax = witnesses.pWitnessNames.length + swingCount
        const dMax = witnesses.dWitnessNames.length + swingCount
        if ((format.pWitnessesCalled !== '' && Number(format.pWitnessesCalled) < 0) ||
            (format.dWitnessesCalled !== '' && Number(format.dWitnessesCalled) < 0)) {
            this.setState({ saveError: 'Witnesses called cannot be negative' })
            return
        }
        if ((format.pWitnessesCalled !== '' && pMax > 0 && Number(format.pWitnessesCalled) > pMax) ||
            (format.dWitnessesCalled !== '' && dMax > 0 && Number(format.dWitnessesCalled) > dMax)) {
            this.setState({ saveError: 'Witnesses called cannot exceed available witnesses' })
            return
        }
        this.setState({ saving: true, saveError: null, saveSuccess: false })
        try {
            await Promise.all([
                saveWitnesses(this.props.tournamentId, this.state.witnesses),
                saveFormat(this.props.tournamentId, this.state.format),
            ])
            this.setState({ saveSuccess: true })
        } catch (e: unknown) {
            this.setState({ saveError: e instanceof Error ? e.message : 'Failed to save' })
        } finally {
            this.setState({ saving: false })
        }
    }

    render() {
        const { loading, error, saveError, saveSuccess, saving, witnesses, format } = this.state
        if (loading) return <p className="dash-saving">Loading…</p>
        const hasSwing = witnesses.swingWitnessNames.length > 0
        const setFmt = (f: Partial<CaseFormatState>) => this.setState({ format: { ...format, ...f } })

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
                                <input type="number" min={0} max={max || undefined} className={`tc-input${invalid ? ' tc-input--invalid' : ''}`}
                                    value={val}
                                    onChange={e => setFmt({ [key]: e.target.value === '' ? '' : Number(e.target.value) })} />
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
                                    <input type="text" className={`tc-input${!name.trim() ? ' tc-input--invalid' : ''}`} placeholder={`Witness ${i + 1}`} value={name} onChange={this.set(key, i)} />
                                    <button type="button" className="tc-remove-btn" onClick={this.remove(key, i)}>×</button>
                                </div>
                            ))}
                        </div>
                        <button type="button" className="tc-add-btn" onClick={this.add(key)}>+ Add witness</button>
                    </div>
                ))}

                <label className="tc-checkbox-label">
                    <input type="checkbox" checked={hasSwing}
                        onChange={() => {
                            this.setState({ witnesses: { ...witnesses, swingWitnessNames: hasSwing ? [] : [''] } })
                            setFmt({ hasSwing: !hasSwing })
                        }} />
                    <span>Case has swing witnesses</span>
                </label>

                {hasSwing && (
                    <div className="tc-section">
                        <span className="tc-section-label">Swing witnesses</span>
                        <div className="tc-witness-list">
                            {witnesses.swingWitnessNames.map((name, i) => (
                                <div key={i} className="tc-witness-row">
                                    <input type="text" className={`tc-input${!name.trim() ? ' tc-input--invalid' : ''}`} placeholder={`Swing witness ${i + 1}`} value={name} onChange={this.set('swingWitnessNames', i)} />
                                    <button type="button" className="tc-remove-btn" onClick={this.remove('swingWitnessNames', i)}>×</button>
                                </div>
                            ))}
                        </div>
                        <button type="button" className="tc-add-btn" onClick={this.add('swingWitnessNames')}>+ Add swing witness</button>
                    </div>
                )}

                <div className="tc-actions">
                    <button type="button" className="btn-confirm" onClick={this.handleSave} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </Section>
        )
    }
}
