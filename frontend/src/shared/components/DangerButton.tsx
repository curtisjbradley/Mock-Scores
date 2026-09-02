import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './styles/danger-button.css'

export type DangerButtonVariant = 'subtle' | 'outline' | 'solid' | 'icon'

interface DangerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    /**
     * Visual style:
     * - `subtle`  — borderless text-style danger action (list-row "Remove")
     * - `outline` — outlined danger button (secondary destructive action)
     * - `solid`   — filled danger button (primary destructive action)
     * - `icon`    — small square icon button, e.g. "×" to remove a row
     *
     * Defaults to `subtle`.
     */
    variant?: DangerButtonVariant
    children: ReactNode
}

/**
 * Shared button for remove/delete actions. Consolidates the various
 * `dash-remove-btn` / `tc-remove-btn` / `tc-delete-btn` / `account-delete`
 * buttons that were duplicated across the app.
 *
 * Forwards all native button props (onClick, disabled, type, aria-*, etc.).
 * Defaults `type` to "button" so it never accidentally submits a form.
 *
 * @example
 * <DangerButton onClick={remove}>Remove</DangerButton>
 * <DangerButton variant="solid" onClick={del}>Delete tournament</DangerButton>
 */
export default function DangerButton({
    variant = 'subtle',
    type = 'button',
    className,
    children,
    ...rest
}: DangerButtonProps) {
    const classes = `ds-danger-btn ds-danger-btn--${variant}${className ? ` ${className}` : ''}`
    return (
        <button type={type} className={classes} {...rest}>
            {children}
        </button>
    )
}
