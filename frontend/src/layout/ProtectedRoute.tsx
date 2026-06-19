import { useEffect, useState } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { getSession } from '../auth/auth'
import LoadingPage from './LoadingPage'

const ProtectedRoute = () => {
    const [status, setStatus] = useState<'loading' | 'authed' | 'unauthed'>('loading')
    const location = useLocation()

    useEffect(() => {
        getSession().then(s => setStatus(s ? 'authed' : 'unauthed'))
    }, [])

    if (status === 'loading') return <LoadingPage loadingText="Checking authentication..." />
    if (status === 'unauthed') return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />
    return <Outlet />
}

export default ProtectedRoute
