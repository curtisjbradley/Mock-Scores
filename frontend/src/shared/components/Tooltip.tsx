import { useId, useState, type ReactNode } from 'react'
import './styles/tooltip.css'

type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

interface Props {
    /** Content shown inside the floating tooltip bubble. */
    content: ReactNode
    /** The element that triggers the tooltip on hover/focus. */
    children: ReactNode
    /** Which side of the trigger the bubble appears on. Defaults to 'top'. */
    placement?: TooltipPlacement
    /** Extra class names for the wrapper. */
    className?: string
    /** Disable the tooltip entirely (renders only the trigger). */
    disabled?: boolean
}

/**
 * Shared tooltip used across all pages.
 *
 * Wraps a trigger element and reveals a semi-transparent, elevated bubble on
 * hover and on keyboard focus. The bubble uses a high z-index so it floats
 * above other content (including modals and sticky nav).
 *
 * Accessibility:
 * - The trigger is focusable and links to the bubble via `aria-describedby`.
 * - Shows on focus/blur as well as mouse enter/leave.
 * - Escape hides an open tooltip.
 *
 * @example
 * <Tooltip content="Publish results to coaches">
 *   <button className="org-new-btn">Publish</button>
 * </Tooltip>
 */
export default function Tooltip({
    content, children, placement = 'top', className = '', disabled = false,
}: Props) {
    const [open, setOpen] = useState(false)
    const tooltipId = useId()

    if (disabled || content == null || content === '') {
        return <>{children}</>
    }

    const show = () => setOpen(true)
    const hide = () => setOpen(false)

    return (
        // The wrapper only reveals a decorative tooltip on hover/focus; the real
        // interactive element is the focusable child trigger, so the wrapper
        // itself intentionally has no ARIA role.
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <span
            className={`tooltip-wrapper ${className}`.trim()}
            onMouseEnter={show}
            onMouseLeave={hide}
            onFocus={show}
            onBlur={hide}
            onKeyDown={e => { if (e.key === 'Escape') hide() }}
        >
            <span className="tooltip-trigger" aria-describedby={open ? tooltipId : undefined}>
                {children}
            </span>
            <span
                id={tooltipId}
                role="tooltip"
                className={`tooltip-bubble tooltip-bubble--${placement}${open ? ' tooltip-bubble--visible' : ''}`}
            >
                {content}
            </span>
        </span>
    )
}
