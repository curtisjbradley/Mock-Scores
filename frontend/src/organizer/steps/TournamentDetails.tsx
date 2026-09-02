import { useState } from 'react'
import type { TournamentInfo } from '../types/tournament'
import FormField from '../../shared/components/FormField'
import DateRangePicker from '../../shared/components/DateRangePicker'
import Tooltip from "../../shared/components/Tooltip.tsx";

interface Props {
    info: TournamentInfo
    onChange: (info: TournamentInfo) => void
    onNext: () => void
    onBack: () => void
}

/** Returns the end-date validation error string, or '' when valid. */
function endDateError(info: TournamentInfo): string {
    if (!info.endTbd && !info.endDate) return 'Required'
    if (!info.endTbd && !info.startTbd && info.endDate < info.startDate) return 'Must be after start'
    return ''
}

/** Derives validation errors from the current TournamentInfo state. */
function getErrors(info: TournamentInfo) {
    return {
        name:      !info.name.trim() ? 'Required' : '',
        location:  !info.location.trim() ? 'Required' : '',
        startDate: !info.startTbd && !info.startDate ? 'Required' : '',
        endDate:   endDateError(info),
    }
}

/**
 * Step 1 of the tournament creation wizard: basic tournament details
 * (name, location, dates). Validates on submit and calls onNext when clean.
 */
export default function TournamentDetails({ info, onChange, onNext, onBack }: Props) {
    const [submitted, setSubmitted] = useState(false)

    const errors = getErrors(info)

    const handleSubmit = (e: { preventDefault(): void }) => {
        e.preventDefault()
        setSubmitted(true)
        if (Object.values(errors).every(e => !e)) onNext()
    }

    return (
        <form className="tc-form" onSubmit={handleSubmit} noValidate>
            <FormField
                id="name"
                label="Tournament name"
                focusOnMount
                value={info.name}
                placeholder="e.g. San Luis Obispo County"
                submitted={submitted}
                error={errors.name}
                onChange={e => onChange({ ...info, name: e.target.value })}
            />

            <FormField
                id="location"
                label="Location"
                value={info.location}
                placeholder="e.g. SLO Superior Court"
                submitted={submitted}
                error={errors.location}
                onChange={e => onChange({ ...info, location: e.target.value })}
            />

            <DateRangePicker
                info={info}
                submitted={submitted}
                errors={{ startDate: errors.startDate, endDate: errors.endDate }}
                onChange={onChange}
            />
            <Tooltip content={ <p className="tc-field-hint">
                When enabled, coaches can see award nominations on ballots. Turn off to hide them.
            </p>} >
            <label className="tc-checkbox-label">
                <input
                    type="checkbox"
                    checked={info.shareIndividualRankings}
                    onChange={() => onChange({ ...info, shareIndividualRankings: !info.shareIndividualRankings })}
                />
                Share individual rankings
            </label>
            </Tooltip>


            <div className="tc-actions">
                <button type="button" className="btn-cancel" onClick={onBack}>← Back</button>
                <button type="submit" className="btn-confirm">Next →</button>
            </div>
        </form>
    )
}
