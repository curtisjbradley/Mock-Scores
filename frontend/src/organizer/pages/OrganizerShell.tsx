import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import '../../shared/styles/dashboard.css'
import type { ITournament } from '@mock-scores/shared'
import { apiFetch } from '../../auth/auth'
import '../../shared/styles/dashboard.css'

import DashboardSidebar, { type DashboardNavItem } from '../../shared/components/DashboardSidebar'
import { type OrganizerScreen, VALID_SCREENS } from '../constants'

const NAV_ITEMS: DashboardNavItem<OrganizerScreen>[] = [
    { key: 'overview',   label: 'Overview',   icon: 'Overview' },
    { key: 'rounds',     label: 'Rounds',     icon: 'Rounds' },
    { key: 'standings',  label: 'Standings',  icon: 'Standings' },
    { key: 'teams',      label: 'Teams',      icon: 'Teams' },
    { key: 'scorers',    label: 'Scorers',    icon: 'Scorers' },
    { key: 'courtrooms', label: 'Courtrooms', icon: 'Courtrooms' },
    { key: 'organizers', label: 'Organizers', icon: 'Organizers' },
    { key: 'structure',  label: 'Structure',  icon: 'Settings' },
]

/** Shared organizer dashboard frame for tournament pages, including round management. */
export default function OrganizerShell() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const location = useLocation()
    const [searchParams] = useSearchParams()
    const [tournament, setTournament] = useState<ITournament | null>(null)

    useEffect(() => {
        if (!id) return
        apiFetch(`/organizer/tournament/${id}`)
            .then(response => {
                if (response.status === 403) {
                    navigate('/403')
                    return null
                }
                return response.ok ? response.json() : null
            })
            .then((data: ITournament | null) => setTournament(data))
            .catch(console.error)
    }, [id, navigate])

    const active = useMemo<OrganizerScreen>(() => {
        if (location.pathname.includes('/round/')) return 'rounds'
        if (location.pathname.includes('/scorers/')) return 'scorers'
        const requested = searchParams.get('page')
        return requested && VALID_SCREENS.has(requested) ? requested as OrganizerScreen : 'overview'
    }, [location.pathname, searchParams])

    const navigateToScreen = (screen: OrganizerScreen) => {
        if (!id) return
        navigate(`/organizer/${id}${screen === 'overview' ? '' : `?page=${screen}`}`)
    }

    return (
        <div className="dash-shell">
            <DashboardSidebar
                items={NAV_ITEMS}
                active={active}
                onChange={navigateToScreen}
                title={tournament?.name ?? 'Tournament'}
                subtitle={tournament?.location ?? undefined}
                storageKey="organizer-sidebar-collapsed"
                ariaLabel="Tournament dashboard sections"
            />
            <main className="dash-content"><Outlet /></main>
        </div>
    )
}
