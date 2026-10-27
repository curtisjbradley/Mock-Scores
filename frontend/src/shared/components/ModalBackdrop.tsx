import { useEffect, useRef } from 'react'
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
    const backdropRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
        const focusFirstElement = () => {
            const dialog = backdropRef.current?.querySelector<HTMLElement>('[role="dialog"]')
            if (dialog && !dialog.hasAttribute('tabindex')) dialog.tabIndex = -1
            const focusable = dialog?.querySelector<HTMLElement>(
                'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
            )
            ;(focusable ?? dialog)?.focus()
        }
        focusFirstElement()

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && dismissible) onClose()
            if (e.key !== 'Tab') return

            const dialog = backdropRef.current?.querySelector<HTMLElement>('[role="dialog"]')
            if (!dialog) return
            if (!dialog.hasAttribute('tabindex')) dialog.tabIndex = -1
            const focusable = [...dialog.querySelectorAll<HTMLElement>(
                'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
            )]
            if (focusable.length === 0) { e.preventDefault(); dialog.focus(); return }
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
        }
        document.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('keydown', onKeyDown)
            previousFocus?.focus()
        }
    }, [dismissible, onClose])

    return (
        <div
            className="modal-backdrop"
            ref={backdropRef}
            role="presentation"
            onClick={e => { if (dismissible && e.target === e.currentTarget) onClose() }}
        >
            {children}
        </div>
    )
}
