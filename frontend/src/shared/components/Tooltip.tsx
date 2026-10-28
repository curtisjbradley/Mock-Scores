import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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
 *   <button className="btn-primary">Publish</button>
 * </Tooltip>
 */
export default function Tooltip({
    content, children, placement = 'top', className = '', disabled = false,
}: Props) {
    const [open, setOpen] = useState(false)
    const tooltipId = useId()
    const triggerRef = useRef<HTMLSpanElement>(null)
    const [position, setPosition] = useState({ left: 0, top: 0 })

    useLayoutEffect(() => {
        if (!open) return
        const updatePosition = () => {
            const rect = triggerRef.current?.getBoundingClientRect()
            if (!rect) return
            switch (placement) {
                case 'top': setPosition({ left: rect.left + rect.width / 2, top: rect.top - 8 }); break
                case 'bottom': setPosition({ left: rect.left + rect.width / 2, top: rect.bottom + 8 }); break
                case 'left': setPosition({ left: rect.left - 8, top: rect.top + rect.height / 2 }); break
                case 'right': setPosition({ left: rect.right + 8, top: rect.top + rect.height / 2 }); break
            }
        }
        updatePosition()
        window.addEventListener('resize', updatePosition)
        // Capture scroll events from nested scroll containers as well as the page.
        window.addEventListener('scroll', updatePosition, true)
        return () => {
            window.removeEventListener('resize', updatePosition)
            window.removeEventListener('scroll', updatePosition, true)
        }
    }, [open, placement])

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
            <span ref={triggerRef} className="tooltip-trigger" aria-describedby={open ? tooltipId : undefined}>
                {children}
            </span>
            {open && createPortal(
                <span
                    id={tooltipId}
                    role="tooltip"
                    className={`tooltip-bubble tooltip-bubble--${placement} tooltip-bubble--visible`}
                    style={{ left: position.left, top: position.top } as CSSProperties}
                >
                    {content}
                </span>,
                document.body,
            )}
        </span>
    )
}
