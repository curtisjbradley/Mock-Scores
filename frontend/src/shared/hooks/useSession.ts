import { useEffect, useState } from 'react'
import { getSession, type Session } from '../../auth/auth'

/**
 * Returns the current session and re-fetches whenever the in-memory access
 * token changes (via the `auth-changed` custom event dispatched by
 * `setAccessToken` in auth.ts).
 *
 * On page load, `getSession()` attempts a silent refresh using the HttpOnly
 * refresh cookie before concluding the user is unauthenticated.
 */
export function useSession(): Session | null {
    const [session, setSession] = useState<Session | null>(null)

    useEffect(() => {
        getSession().then(setSession)
        const onAuthChanged = () => getSession().then(setSession)
        window.addEventListener('auth-changed', onAuthChanged)
        return () => window.removeEventListener('auth-changed', onAuthChanged)
    }, [])

    return session
}
