import type { TournamentInfo } from '../../organizer/types/tournament'

interface DateRangePickerProps {
    /** Tournament info object slice that owns the date fields */
    info: TournamentInfo
    /** Whether validation has been submitted (gates error visibility) */
    submitted?: boolean
    /** Validation errors for startDate and endDate */
    errors: {
        startDate: string
        endDate: string
    }
    /** Called whenever any date field changes */
    onChange: (updated: TournamentInfo) => void
}

interface DateFieldProps {
    label: string
    dateKey: 'startDate' | 'endDate'
    tbdKey: 'startTbd' | 'endTbd'
    info: TournamentInfo
    submitted: boolean
    error: string
    onChange: (updated: TournamentInfo) => void
}

/**
 * A single start-or-end date input with a TBD checkbox.
 * Extracted from `DateRangePicker` to keep each piece below the complexity
 * threshold — the .map() arrow that previously built both fields had 8 cyclomatic
 * from the conditional class name, TBD branch, and two onChange handlers.
 */
function DateField({ label, dateKey, tbdKey, info, submitted, error, onChange }: DateFieldProps) {
    return (
        <div className="tc-field">
            <label className="tc-label">{label}</label>
            {!info[tbdKey] && (
                <input
                    type="date"
                    className={`tc-input${submitted && error ? ' tc-input--invalid' : ''}`}
                    value={info[dateKey]}
                    onChange={e => onChange({ ...info, [dateKey]: e.target.value })}
                />
            )}
            <label className="tc-checkbox-label">
                <input
                    type="checkbox"
                    checked={info[tbdKey]}
                    onChange={() => onChange({ ...info, [tbdKey]: !info[tbdKey] })}
                />
                TBD
            </label>
            {submitted && error && <span className="tc-field-error">{error}</span>}
        </div>
    )
}

/**
 * Renders the "Dates" section with Start / End date inputs and TBD checkboxes.
 * Shared between the tournament creation wizard (TournamentDetails) and the
 * tournament settings tab (TournamentSettingsTab).
 *
 * @example
 * <DateRangePicker
 *   info={info}
 *   submitted={submitted}
 *   errors={{ startDate: errors.startDate, endDate: errors.endDate }}
 *   onChange={setInfo}
 * />
 */
export default function DateRangePicker({ info, submitted = false, errors, onChange }: DateRangePickerProps) {
    return (
        <div className="tc-section">
            <span className="tc-section-label">Dates</span>
            <div className="tc-row">
                <DateField
                    label="Start"
                    dateKey="startDate"
                    tbdKey="startTbd"
                    info={info}
                    submitted={submitted}
                    error={errors.startDate}
                    onChange={onChange}
                />
                <DateField
                    label="End"
                    dateKey="endDate"
                    tbdKey="endTbd"
                    info={info}
                    submitted={submitted}
                    error={errors.endDate}
                    onChange={onChange}
                />
            </div>
        </div>
    )
}
