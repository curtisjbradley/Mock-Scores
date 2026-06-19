import { useState } from 'react'
import type { TournamentInfo } from '../types/tournament'

interface Props {
    info: TournamentInfo
    onChange: (info: TournamentInfo) => void
    onNext: () => void
    onBack: () => void
}

export default function TournamentDetails({ info, onChange, onNext, onBack }: Props) {
    const [submitted, setSubmitted] = useState(false)

    const errors = {
        name:      !info.name.trim() ? 'Required' : '',
        location:  !info.location.trim() ? 'Required' : '',
        startDate: !info.startTbd && !info.startDate ? 'Required' : '',
        endDate:   !info.endTbd && !info.endDate ? 'Required'
                 : !info.endTbd && !info.startTbd && info.endDate < info.startDate ? 'Must be after start' : '',
    }

    const handleSubmit = (e: { preventDefault(): void }) => {
        e.preventDefault()
        setSubmitted(true)
        if (Object.values(errors).every(e => !e)) onNext()
    }

    return (
        <form className="tc-form" onSubmit={handleSubmit} noValidate>
            <div className="tc-field">
                <label className="tc-label" htmlFor="name">Tournament name</label>
                <input id="name" type="text" autoFocus
                    className={`tc-input${submitted && errors.name ? ' tc-input--invalid' : ''}`}
                    value={info.name}
                    placeholder="e.g. San Luis Obispo County"
                    onChange={e => onChange({ ...info, name: e.target.value })}
                />
                {submitted && errors.name && <span className="tc-field-error">{errors.name}</span>}
            </div>

            <div className="tc-field">
                <label className="tc-label" htmlFor="location">Location</label>
                <input id="location" type="text"
                    className={`tc-input${submitted && errors.location ? ' tc-input--invalid' : ''}`}
                    value={info.location}
                    placeholder="e.g. SLO Superior Court"
                    onChange={e => onChange({ ...info, location: e.target.value })}
                />
                {submitted && errors.location && <span className="tc-field-error">{errors.location}</span>}
            </div>

            <div className="tc-section">
                <span className="tc-section-label">Dates</span>
                <div className="tc-row">
                    {(['startDate', 'endDate'] as const).map(key => {
                        const tbdKey = key === 'startDate' ? 'startTbd' : 'endTbd'
                        return (
                            <div key={key} className="tc-field">
                                <label className="tc-label">{key === 'startDate' ? 'Start' : 'End'}</label>
                                {!info[tbdKey] && (
                                    <input type="date"
                                        className={`tc-input${submitted && errors[key] ? ' tc-input--invalid' : ''}`}
                                        value={info[key]}
                                        onChange={e => onChange({ ...info, [key]: e.target.value })}
                                    />
                                )}
                                <label className="tc-checkbox-label">
                                    <input type="checkbox" checked={info[tbdKey]} onChange={() => onChange({ ...info, [tbdKey]: !info[tbdKey] })} />
                                    TBD
                                </label>
                                {submitted && errors[key] && <span className="tc-field-error">{errors[key]}</span>}
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="tc-actions">
                <button type="button" className="btn-cancel" onClick={onBack}>← Back</button>
                <button type="submit" className="btn-confirm">Next →</button>
            </div>
        </form>
    )
}
