import type { ReactNode } from 'react'

interface Props {
    onClose: () => void
    children: ReactNode
}

/**
 * Shared modal backdrop wrapper.
 * Closes on backdrop click; renders the modal content as children.
 */
export default function ModalBackdrop({ onClose, children }: Props) {
    return (
        <div
            className="modal-backdrop"
            role="presentation"
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
            {children}
        </div>
    )
}
