import './styles/save-cancel-actions.css'

interface SaveCancelActionsProps {
    /** Called when the Save button is clicked. */
    onSave: () => void
    /** Called when the Cancel button is clicked. */
    onCancel: () => void
    /** Disables both buttons while a save is in flight. */
    saving?: boolean
    /** Label for the confirm button (defaults to "Save"). */
    saveLabel?: string
    /** Label for the cancel button (defaults to "Cancel"). */
    cancelLabel?: string
}

/**
 * Save/cancel action bar shared by the coach Assign-Roles and
 * Witness-Call-Order flows. Reuses the existing `tab-actions` layout and
 * `btn-confirm`/`btn-cancel` button styles.
 */
export default function SaveCancelActions({
    onSave,
    onCancel,
    saving = false,
    saveLabel = 'Save',
    cancelLabel = 'Cancel',
}: SaveCancelActionsProps) {
    return (
        <div className="tab-actions coach-tab-actions">
            <button className="btn-confirm" onClick={onSave} disabled={saving}>{saveLabel}</button>
            <button className="btn-cancel" onClick={onCancel} disabled={saving}>{cancelLabel}</button>
        </div>
    )
}
