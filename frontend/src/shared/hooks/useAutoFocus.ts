import { useEffect, useRef } from 'react'

/**
 * Returns a ref that programmatically moves focus to the target element after
 * it mounts (or when `active` becomes true).
 *
 * This is the accessible alternative to the `autoFocus` DOM attribute, which
 * jsx-a11y flags because a hard-coded `autoFocus` can steal focus on initial
 * page load in unexpected ways. Moving focus explicitly when a modal or inline
 * editor opens is the intended, predictable behaviour — focus only shifts in
 * response to a user action that reveals the field.
 *
 * @param active When false, focus is not moved. Defaults to true.
 * @example
 * const inputRef = useAutoFocus<HTMLInputElement>()
 * return <input ref={inputRef} />
 */
export function useAutoFocus<T extends HTMLElement = HTMLElement>(active = true) {
    const ref = useRef<T>(null)
    useEffect(() => {
        if (active) ref.current?.focus()
    }, [active])
    return ref
}
