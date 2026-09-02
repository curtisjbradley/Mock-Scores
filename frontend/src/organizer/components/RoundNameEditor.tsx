import { useState } from 'react'
import type { IRound } from '@mock-scores/shared'
import { useAutoFocus } from '../../shared/hooks/useAutoFocus'

interface RoundNameEditorProps {
    round: IRound | null
    onSave: (name: string) => void
}

/**
 * Inline-editable round name. Shows the round name as a clickable button;
 * clicking it switches to an input that saves on blur, Enter, or Escape.
 *
 * Extracted from `RoundView` to reduce that component's hook count and
 * cognitive complexity.
 */
export default function RoundNameEditor({ round, onSave }: RoundNameEditorProps) {
    const [editing, setEditing] = useState(false)
    const [value, setValue] = useState('')
    const inputRef = useAutoFocus<HTMLInputElement>(editing)

    const commit = () => { onSave(value); setEditing(false) }

    if (editing) {
        return (
            <form onSubmit={e => { e.preventDefault(); commit() }}>
                <input
                    ref={inputRef}
                    className="rv-name-input"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onBlur={commit}
                    onKeyDown={e => e.key === 'Escape' && setEditing(false)}
                />
            </form>
        )
    }

    return (
        <button
            className="rv-name-btn"
            onClick={() => { setValue(round?.name ?? ''); setEditing(true) }}
        >
            {round?.name ?? '…'} <span className="rv-edit-icon">✎</span>
        </button>
    )
}
