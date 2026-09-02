import type { ICourtroom, ITeam } from '@mock-scores/shared'
import TeamSelectOptions from '../../shared/components/TeamSelectOptions'
import AddButton from '../../shared/components/AddButton'

interface AddMatchupFormProps {
    teams: ITeam[]
    courtrooms: ICourtroom[]
    addPros: string
    addDef: string
    addCourtroom: string
    prosError: string
    defError: string
    onProsChange: (v: string) => void
    onDefChange: (v: string) => void
    onCourtroomChange: (v: string) => void
    onSubmit: () => void
}

/**
 * The "Add matchup" form shown inside RoundView.
 * Extracted to reduce RoundView's component-level complexity and JSX depth.
 */
export default function AddMatchupForm({
    teams, courtrooms,
    addPros, addDef, addCourtroom,
    prosError, defError,
    onProsChange, onDefChange, onCourtroomChange,
    onSubmit,
}: AddMatchupFormProps) {
    const teamFields = [
        { label: 'Prosecution', value: addPros, onChange: onProsChange, error: prosError },
        { label: 'Defense',     value: addDef,  onChange: onDefChange,  error: defError },
    ] as const

    return (
        <div className="rv-add-form">
            <h2 className="rv-add-form-title">New matchup</h2>
            <div className="rv-add-form-fields">
                {teamFields.map(f => (
                    <div key={f.label} className="rv-field-group">
                        <label className="rv-field-label">
                            {f.label}
                            <select
                                className={`rv-select${f.error ? ' rv-select-invalid' : ''}`}
                                value={f.value}
                                onChange={e => f.onChange(e.target.value)}
                            >
                                <TeamSelectOptions teams={teams} />
                            </select>
                        </label>
                        {f.error && <span className="rv-field-error">{f.error}</span>}
                    </div>
                ))}

                <div className="rv-field-group">
                    <label className="rv-field-label">
                        Courtroom
                        <select
                            className={`rv-select`}
                            value={addCourtroom}
                            onChange={e => onCourtroomChange(e.target.value)}
                        >
                            <option value="">TBD</option>
                            {courtrooms.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name}{c.location ? ` (${c.location})` : ''}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>
            <div className="rv-add-form-actions">
                <AddButton onClick={onSubmit}>Add matchup</AddButton>
            </div>
        </div>
    )
}
