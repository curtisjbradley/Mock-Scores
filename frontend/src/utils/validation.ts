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

export { validatePassword } from '@mock-scores/shared'
