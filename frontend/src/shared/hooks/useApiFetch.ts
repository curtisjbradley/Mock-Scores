import { useEffect, useReducer } from 'react'
import { apiFetch } from '../../auth/auth'

interface State<T> {
    data: T | null
    loading: boolean
    error: string | null
}

type Action<T> =
    | { type: 'start' }
    | { type: 'done'; data: T }
    | { type: 'error'; error: string }

function reducer<T>(state: State<T>, action: Action<T>): State<T> {
    switch (action.type) {
        case 'start': return { ...state, loading: true, error: null }
        case 'done':  return { data: action.data, loading: false, error: null }
        case 'error': return { ...state, loading: false, error: action.error }
    }
}

/**
 * Fetches data from `url` using the authenticated `apiFetch` helper and
 * tracks loading/error state via a reducer.
 *
 * Returns `refetch` — a stable callback that re-triggers the fetch without
 * changing the URL (useful for manual refresh after a mutation).
 *
 * @param url - API path to fetch; changing this value re-triggers the effect
 * @param fallback - Value used as `data` before the first successful response
 *
 * @example
 * const { data, loading, error, refetch } = useApiFetch('/api/tournaments', []);
 */
export function useApiFetch<T>(url: string, fallback: T) {
    const [state, dispatch] = useReducer(reducer<T>, { data: null, loading: true, error: null })
    const [tick, refetch] = useReducer((n: number) => n + 1, 0)

    useEffect(() => {
        let cancelled = false
        dispatch({ type: 'start' })
        apiFetch(url)
            .then(r => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
            .then((d: T) => { if (!cancelled) dispatch({ type: 'done', data: d }) })
            .catch((e: unknown) => {
                if (!cancelled) dispatch({ type: 'error', error: e instanceof Error ? e.message : 'Failed to load' })
            })
        return () => { cancelled = true }
    }, [url, tick])

    return { ...state, fallback, refetch }
}
