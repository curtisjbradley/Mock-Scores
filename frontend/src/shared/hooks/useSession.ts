import { useEffect, useState } from 'react'
import { getSession, type Session } from '../../auth/auth'

/** Returns the current session and re-fetches when localStorage changes. */
export function useSession(): Session | null {
    const [session, setSession] = useState<Session | null>(null)

    useEffect(() => {
        getSession().then(setSession)
        const onStorage = () => getSession().then(setSession)
        window.addEventListener('storage', onStorage)
        return () => window.removeEventListener('storage', onStorage)
    }, [])

    return session
}
