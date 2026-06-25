import { isValidEmail } from '../../utils/validation'

interface Props {
    value: string
    onChange: (v: string) => void
    onSave: () => void
    onCancel: () => void
}

/** Inline email edit form used in organizer/team tables. */
export default function InlineEmailEdit({ value, onChange, onSave, onCancel }: Props) {
    return (
        <form className="dash-edit-form" onSubmit={e => { e.preventDefault(); onSave() }}>
            <input
                autoFocus
                type="email"
                value={value}
                onChange={e => onChange(e.target.value)}
                className={`dash-edit-input ${!value || isValidEmail(value) ? 'dash-edit-input--valid' : 'dash-edit-input--invalid'}`}
            />
            <button type="submit" disabled={!isValidEmail(value)} className="dash-edit-save">Save</button>
            <button type="button" className="dash-edit-cancel" onClick={onCancel}>Cancel</button>
        </form>
    )
}
