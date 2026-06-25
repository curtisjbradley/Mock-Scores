import { useState } from 'react'

/**
 * Manages the confirm-remove modal pattern:
 * holds the item pending removal and exposes open/clear helpers.
 */
export function useConfirmRemove<T>() {
    const [pending, setPending] = useState<T | null>(null)
    return {
        pending,
        open: (item: T) => setPending(item),
        clear: () => setPending(null),
    }
}
