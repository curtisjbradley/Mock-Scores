// Email validation helpers.
//
// `EMAIL_REGEX` is the HTML5 Living Standard regex used by browsers to
// validate <input type="email">. It's intentionally not RFC 5322 strict —
// it matches the practical, widely-interoperable subset of valid addresses
// that real users will actually enter.
//
// See https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address
export const EMAIL_REGEX =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

/**
 * Returns true if the given string is a syntactically valid email address
 * by the HTML5 spec. Surrounding whitespace is trimmed before checking.
 */
export function isValidEmail(value: string): boolean {
    return EMAIL_REGEX.test(value.trim())
}

/**
 * Minimum password requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one number
 */
export function validatePassword(password: string): string | null {
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.'
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number.'
    return null
}
