import type { InputHTMLAttributes, ReactNode } from 'react'

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
    ...inputProps
}: FormFieldProps) {
    const hasError = submitted && !!error
    const inputClass = `${classPrefix}-input${hasError ? ` ${classPrefix}-input--invalid` : ''}${className ? ` ${className}` : ''}`

    return (
        <div className={`${classPrefix}-field`}>
            <label className={`${classPrefix}-label`} htmlFor={id}>
                {label}
            </label>
            <input
                id={id}
                className={inputClass}
                {...inputProps}
            />
            {children}
            {hasError && <span className={`${classPrefix}-field-error`}>{error}</span>}
        </div>
    )
}
