import { useEffect } from 'react'
import type { ReactNode } from 'react'

interface Props {
    onClose: () => void
    /** When false, backdrop click and Escape are ignored (e.g. during a pending operation). */
    dismissible?: boolean
    children: ReactNode
}

/**
 * Shared modal backdrop wrapper.
 *
 * Accessibility:
 * - The backdrop uses `role="presentation"` and only closes on a click that
 *   originates on the backdrop itself (not on the modal content).
 * - Closing is also wired to the Escape key, which is the expected keyboard
 *   affordance for dismissing a dialog. This keeps the backdrop click a
 *   convenience while ensuring keyboard users have an equivalent path.
 */
export default function ModalBackdrop({ onClose, dismissible = true, children }: Props) {
    useEffect(() => {
        if (!dismissible) return
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [dismissible, onClose])

    return (
        <div
            className="modal-backdrop"
            role="presentation"
            onClick={e => { if (dismissible && e.target === e.currentTarget) onClose() }}
        >
            {children}
        </div>
    )
}
