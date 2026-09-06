import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import '../organizer/styles/organizer.css'
import '../organizer/styles/tabs.css'
import '../organizer/styles/standings.css'
import '../organizer/styles/pairings.css'
import '../shared/styles/dashboard.css'
import DashboardSidebar, { type DashboardNavItem } from '../shared/components/DashboardSidebar'
import type {
    ICoach,
    ICoachResultRound,
    ICoachScheduleRound,
    ICoachTournament,
    ICompetitionTeam,
    IStudent,
} from '@mock-scores/shared'
import { apiFetch } from '../auth/auth'
import type { CoachTab } from './constants'
import { resolveCoachTournament } from './coachApi'
import type { BallotDetail, CoachContextValue, StandingsApiPayload } from './CoachContext'
import NotFound from "../error/NotFound.tsx";

// Icon names map to SVGs in `public/icons/`. Field reuses Teams; Coaches reuses
// Organizers (no dedicated asset yet — see docs/icons-todo.md).
const NAV_ITEMS: DashboardNavItem<CoachTab>[] = [
    { key: 'overview',  label: 'Overview',  icon: 'Overview' },
    { key: 'schedule',  label: 'Schedule',  icon: 'Schedule' },
    { key: 'results',   label: 'Results',   icon: 'Results' },
    { key: 'coaches',   label: 'Coaches',   icon: 'Organizers' },
    { key: 'roster',    label: 'Roster',    icon: 'Roster' },
    { key: 'field',     label: 'Field',     icon: 'Teams' },
    { key: 'standings', label: 'Standings', icon: 'Standings' },
]

const VALID_TABS = new Set<CoachTab>(NAV_ITEMS.map(t => t.key))

interface Props { isOrganizerView?: boolean }

interface Format { criminal_case?: boolean }

/**
 * Chrome + master data owner for the coach dashboard.
 *
 * This layout resolves the tournament and fetches every piece of shared data a
 * coach page might need (schedule, results, coaches, roster, field, standings,
 * case format), and owns every mutation that changes that shared data. All of
 * it is handed to child pages through the router `<Outlet />` context (see
 * `CoachContext.ts`). Child pages never fetch shared data themselves.
 */
export default function CoachLayout({ isOrganizerView = false }: Props) {
    // Coach view is scoped by team: `/coach/:teamId`. Organizer preview keeps
    // the tournament id in `:id` and the previewed team in `:schoolId`.
    const { teamId: teamIdParam, id, schoolId } = useParams<{ teamId: string; id: string; schoolId: string }>()
    const navigate = useNavigate()
    const location = useLocation()

    // The team id that drives resolution and URLs.
    const urlTeamId = isOrganizerView ? (schoolId ?? '') : (teamIdParam ?? '')
    // Tournament id from the route in organizer view (derived from the team otherwise).
    const organizerTournamentId = isOrganizerView ? id : undefined

    // ── Resolved identity ─────────────────────────────────────────────────────
    const [tournament, setTournament] = useState<ICoachTournament | null>(null)
    const [teamId, setTeamId] = useState('')
    const [tournamentId, setTournamentId] = useState('')
    const [teamBase, setTeamBase] = useState('')
    const [resolved, setResolved] = useState(false)

    // ── Shared data ───────────────────────────────────────────────────────────
    const [schedule, setSchedule] = useState<ICoachScheduleRound[]>([])
    const [results, setResults] = useState<ICoachResultRound[]>([])
    const [coaches, setCoaches] = useState<ICoach[]>([])
    const [students, setStudents] = useState<IStudent[]>([])
    const [field, setField] = useState<ICompetitionTeam[]>([])
    const [standings, setStandings] = useState<StandingsApiPayload | null>(null)
    const [isCriminal, setIsCriminal] = useState(true)

    // Cache of per-pairing ballot detail for the results page.
    const ballotCache = useRef<Map<string, BallotDetail[]>>(new Map())

    // Resolve the team + its tournament, then fetch everything the pages share.
    useEffect(() => {
        if (!urlTeamId) return
        let active = true
        // Reset caches when the team changes.
        ballotCache.current = new Map()

        resolveCoachTournament(urlTeamId, isOrganizerView, organizerTournamentId)
            .then(info => {
                if (!active) return
                if (!info) { setResolved(true); return }

                setTournament(info.tournament)
                setTeamId(info.teamId)
                setTournamentId(info.tournamentId)
                setTeamBase(info.teamBase)
                setResolved(true)

                // Tournament-scoped endpoints query by tournament id; the team is
                // carried in the `?teamId=` query where the endpoint needs it.
                const tid = info.tournamentId
                const teamQuery = info.teamId ? `?teamId=${info.teamId}` : ''

                apiFetch(`/coach/tournaments/${tid}/schedule${teamQuery}`)
                    .then(r => r.ok ? r.json() : []).then(s => { if (active) setSchedule(s) }).catch(() => {})
                apiFetch(`/coach/tournaments/${tid}/results`)
                    .then(r => r.ok ? r.json() : []).then(r => { if (active) setResults(r) }).catch(() => {})
                apiFetch(`${info.teamBase}/coaches`)
                    .then(r => r.ok ? r.json() : []).then(c => { if (active) setCoaches(c) }).catch(() => {})
                apiFetch(`${info.teamBase}/students`)
                    .then(r => r.ok ? r.json() : []).then(s => { if (active) setStudents(s) }).catch(() => {})
                apiFetch(`/coach/tournaments/${tid}/field`)
                    .then(r => r.ok ? r.json() : []).then(f => { if (active) setField(f) }).catch(() => {})
                apiFetch(`/coach/tournaments/${tid}/standings`)
                    .then(r => r.ok ? r.json() : null).then(d => { if (active) setStandings(d) }).catch(() => {})
                apiFetch(`/coach/tournaments/${tid}/format`)
                    .then(r => r.ok ? r.json() : null)
                    .then((fmt: Format | null) => { if (active && fmt?.criminal_case != null) setIsCriminal(fmt.criminal_case) })
                    .catch(() => {})
            })
            .catch(() => { if (active) setResolved(true) })

        return () => { active = false }
    }, [urlTeamId, isOrganizerView, organizerTournamentId])

    // ── Coach mutations ───────────────────────────────────────────────────────
    const addCoach = useCallback(async (email: string) => {
        const r = await apiFetch(`/coach/teams/${teamId}/coaches`, { method: 'POST', body: JSON.stringify({ email }) })
        if (!r.ok) return
        const c: ICoach | null = await r.json().catch(() => null)
        if (c) setCoaches(prev => [...prev, c])
    }, [teamId])

    const removeCoach = useCallback(async (coachId: string) => {
        const r = await apiFetch(`${teamBase}/coaches/${coachId}`, { method: 'DELETE' })
        if (r.ok) setCoaches(prev => prev.filter(c => c.coach_id !== coachId))
    }, [teamBase])

    const makeOwner = useCallback(async (coachId: string) => {
        const r = await apiFetch(`/organizer/tournament/${tournamentId}/teams/${teamId}/owner`, {
            method: 'PUT', body: JSON.stringify({ coachId }),
        })
        if (r.ok) setCoaches(prev => prev.map(c => ({ ...c, is_owner: c.coach_id === coachId })))
    }, [tournamentId, teamId])

    // ── Student mutations ─────────────────────────────────────────────────────
    const addStudent = useCallback(async (studentName: string, pronouns: string | null) => {
        const r = await apiFetch(`${teamBase}/students`, {
            method: 'POST', body: JSON.stringify({ student_name: studentName, pronouns }),
        })
        if (!r.ok) return
        const s: IStudent | null = await r.json().catch(() => null)
        if (s) setStudents(prev => [...prev, s])
    }, [teamBase])

    const removeStudent = useCallback(async (studentId: string) => {
        const r = await apiFetch(`${teamBase}/students/${studentId}`, { method: 'DELETE' })
        if (r.ok) setStudents(prev => prev.filter(s => s.student_id !== studentId))
    }, [teamBase])

    // ── Lazy loaders ──────────────────────────────────────────────────────────
    const loadBallots = useCallback(async (pairingId: string): Promise<BallotDetail[]> => {
        const cached = ballotCache.current.get(pairingId)
        if (cached) return cached
        const res = await apiFetch(`/coach/tournaments/${tournamentId}/pairings/${pairingId}/ballots`)
        const data: BallotDetail[] = res.ok ? await res.json() : []
        ballotCache.current.set(pairingId, data)
        return data
    }, [tournamentId])

    // Base path for this dashboard's pages.
    const base = isOrganizerView
        ? `/organizer/${organizerTournamentId}/school/${urlTeamId}`
        : `/coach/${teamId}`

    // Derive the active tab from the last path segment.
    const lastSegment = location.pathname.split('/').filter(Boolean).pop() as CoachTab | undefined
    const activeTab: CoachTab = lastSegment && VALID_TABS.has(lastSegment) ? lastSegment : 'overview'

    if (!resolved) return null;
    if (!tournament) return <NotFound back_message={"View All Teams"} backlink={"/coach"} message={"The team you are looking for does not exist."}/>

    const title = tournament.team_code || tournament.team_name || 'Team'
    const subtitle = tournament.team_name

    const contextValue: CoachContextValue = {
        tournamentId,
        teamId,
        teamBase,
        isOrganizerView,
        base,
        tournament,
        schedule,
        results,
        coaches,
        students,
        field,
        standings,
        isCriminal,
        addCoach,
        removeCoach,
        makeOwner,
        addStudent,
        removeStudent,
        loadBallots,
    }

    return (
        <main className="org-main">
            <div className="dash-shell">
                <DashboardSidebar
                    items={NAV_ITEMS}
                    active={activeTab}
                    onChange={(tab) => navigate(`${base}/${tab}`)}
                    title={title}
                    subtitle={subtitle}
                    ariaLabel="Coach dashboard sections"
                />

                <div className="dash-content">
                    <button
                        className="org-back-btn"
                        onClick={() => navigate(isOrganizerView ? `/organizer/${tournamentId}?page=teams` : '/coach')}
                    >
                        {isOrganizerView ? 'Back to tournament' : 'All tournaments'}
                    </button>

                    <Outlet context={contextValue} />
                </div>
            </div>
        </main>
    )
}
