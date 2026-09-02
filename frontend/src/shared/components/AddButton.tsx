import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type AddButtonVariant = 'primary' | 'dashed'

interface AddButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    /**
     * Visual style:
     * - `primary` — solid primary dashboard action button (`org-new-btn`),
     *   used for list "+ Add X" actions on dashboards.
     * - `dashed`  — dashed outline add button (`tc-add-btn`), used inside the
     *   tournament creation wizard to add rows/categories.
     *
     * Defaults to `primary`.
     */
    variant?: AddButtonVariant
    children: ReactNode
}

/**
 * Shared button for "add / create" actions. Consolidates the `org-new-btn`
 * and `tc-add-btn` buttons duplicated across the app.
 *
 * Renders the existing CSS class names so contextual style overrides
 * (e.g. `.roster-add-form .org-new-btn`) keep working. Forwards all native
 * button props and defaults `type` to "button" so it never accidentally
 * submits a form (pass `type="submit"` when needed).
 *
 * @example
 * <AddButton onClick={openAddModal}>+ Add scorer</AddButton>
 * <AddButton variant="dashed" onClick={onAddField}>+ Add field</AddButton>
 */
export default function AddButton({
    variant = 'primary',
    type = 'button',
    className,
    children,
    ...rest
}: AddButtonProps) {
    const base = variant === 'dashed' ? 'tc-add-btn' : 'org-new-btn'
    const classes = `${base}${className ? ` ${className}` : ''}`
    return (
        <button type={type} className={classes} {...rest}>
            {children}
        </button>
    )
}
