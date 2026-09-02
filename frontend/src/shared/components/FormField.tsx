import type { InputHTMLAttributes, ReactNode } from 'react'
import { useAutoFocus } from '../hooks/useAutoFocus'

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
    /** HTML id for the input and the associated <label> */
    id?: string
    /** Visible field label */
    label: string
    /** Validation error message; renders below the input when non-empty */
    error?: string
    /** Whether the form was submitted (gates error visibility) */
    submitted?: boolean
    /** Additional content rendered below the input (e.g. checkbox) */
    children?: ReactNode
    /** CSS class prefix for BEM-style class names (default "tc") */
    classPrefix?: string
    /**
     * Move focus to this field when it mounts. Accessible replacement for the
     * `autoFocus` attribute — focus is set programmatically.
     */
    focusOnMount?: boolean
}

/**
 * Reusable labelled form field that renders a label, an input, an optional
 * validation error, and an optional child slot.
 *
 * Designed for the `tc-*` CSS class convention used throughout the tournament
 * creation wizard and settings tab.
 *
 * @example
 * <FormField
 *   id="name"
 *   label="Tournament name"
 *   value={info.name}
 *   submitted={submitted}
 *   error={errors.name}
 *   onChange={e => onChange({ ...info, name: e.target.value })}
 * />
 */
export default function FormField({
    id,
    label,
    error,
    submitted = false,
    children,
    classPrefix = 'tc',
    className,
    focusOnMount,
    ...inputProps
}: FormFieldProps) {
    const hasError = submitted && !!error
    const inputClass = `${classPrefix}-input${hasError ? ` ${classPrefix}-input--invalid` : ''}${className ? ` ${className}` : ''}`
    // Move focus programmatically instead of using the `autoFocus` attribute,
    // which jsx-a11y flags for accessibility reasons.
    const inputRef = useAutoFocus<HTMLInputElement>(!!focusOnMount)

    return (
        <div className={`${classPrefix}-field`}>
            <label className={`${classPrefix}-label`} htmlFor={id}>
                {label}
            </label>
            <input
                ref={inputRef}
                id={id}
                className={inputClass}
                {...inputProps}
            />
            {children}
            {hasError && <span className={`${classPrefix}-field-error`}>{error}</span>}
        </div>
    )
}
