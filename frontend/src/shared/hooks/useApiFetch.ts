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
