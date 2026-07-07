import { useEffect, useState } from 'react'
import { apiFetch } from '../../auth/auth'
import type {
    ICoachTournament, ICoachScheduleRound, ICoachResultRound,
    ICoach, IStudent, ICompetitionTeam,
} from '@mock-scores/shared'
import type { CoachTab } from '../constants'

interface CoachTournamentData {
    tournament: ICoachTournament | null
    schedule: ICoachScheduleRound[]
    results: ICoachResultRound[]
    coaches: ICoach[]
    students: IStudent[]
    field: ICompetitionTeam[]
    teamId: string
    teamBase: string
    addCoach: (email: string) => void
    removeCoach: (coachId: string) => void
    makeOwner: (coachId: string) => void
    addStudent: (name: string, pronouns: string | null) => void
    removeStudent: (studentId: string) => void
}

/**
 * Loads and manages all tournament/team data for the coach dashboard.
 * Handles both the regular coach view and the organizer-as-coach view.
 *
 * Lazy-loads tab-specific data (coaches, roster, field) only when the
 * relevant tab is first visited.
 *
 * @param id - Tournament ID from the route param
 * @param tab - Currently active tab (controls lazy loading)
 * @param isOrganizerView - True when an organizer is previewing a team's view
 * @param schoolId - Team ID used in organizer view to scope the team endpoints
 */
export function useCoachTournamentData(
    id: string | undefined,
    tab: CoachTab,
    isOrganizerView: boolean,
    schoolId: string | undefined,
): CoachTournamentData {
    const orgApiBase = isOrganizerView ? `/api/organizer/tournament/${id}` : null

    const [tournament, setTournament] = useState<ICoachTournament | null>(null)
    const [schedule, setSchedule] = useState<ICoachScheduleRound[]>([])
    const [results, setResults] = useState<ICoachResultRound[]>([])
    const [coaches, setCoaches] = useState<ICoach[]>([])
    const [students, setStudents] = useState<IStudent[]>([])
    const [field, setField] = useState<ICompetitionTeam[]>([])

    // Initial load: tournament info + schedule + results
    useEffect(() => {
        if (!id) return
        if (isOrganizerView) {
            Promise.all([
                apiFetch(`/api/organizer/tournament/${id}`).then(r => r.ok ? r.json() : null),
                apiFetch(`/api/coach/tournaments/${id}/schedule${schoolId ? `?teamId=${schoolId}` : ''}`).then(r => r.ok ? r.json() : []),
                apiFetch(`/api/coach/tournaments/${id}/results`).then(r => r.ok ? r.json() : []),
                apiFetch(`/api/organizer/tournament/${id}/teams`).then(r => r.ok ? r.json() : []),
            ]).then(([t, s, r, teams]) => {
                const team = (teams as { id: string; name: string; code: string }[]).find(tm => tm.id === schoolId)
                if (t) setTournament({ ...t, team_id: schoolId ?? '', team_name: team?.name ?? '', team_code: team?.code ?? '' })
                setSchedule(s)
                setResults(r)
            }).catch(() => {})
        } else {
            Promise.all([
                apiFetch('/api/coach/tournaments').then(r => r.ok ? r.json() : []),
                apiFetch(`/api/coach/tournaments/${id}/schedule`).then(r => r.ok ? r.json() : []),
                apiFetch(`/api/coach/tournaments/${id}/results`).then(r => r.ok ? r.json() : []),
            ]).then(([ts, s, r]) => {
                const myTournament = (ts as ICoachTournament[]).find(t => t.id === id) ?? null
                setTournament(myTournament)
                // Re-fetch schedule with the resolved teamId so filtering is correct
                if (myTournament?.team_id) {
                    apiFetch(`/api/coach/tournaments/${id}/schedule?teamId=${myTournament.team_id}`)
                        .then(r => r.ok ? r.json() : s)
                        .then(setSchedule)
                        .catch(() => setSchedule(s))
                } else {
                    setSchedule(s)
                }
                setResults(r)
            }).catch(() => {})
        }
    }, [id, isOrganizerView, schoolId])

    // Lazy-load tab-specific data on first visit
    useEffect(() => {
        if (!id || !tournament) return
        const teamId = isOrganizerView ? (schoolId ?? '') : tournament.team_id
        const teamBase = orgApiBase ? `${orgApiBase}/teams/${teamId}` : `/api/coach/teams/${teamId}`

        /** Fetches a list endpoint and sets state only if data is not already loaded. */
        const lazyLoad = <T,>(condition: boolean, url: string, setter: (data: T) => void) => {
            if (!condition) return
            apiFetch(url).then(r => r.ok ? r.json() : []).then(setter).catch(() => {})
        }

        lazyLoad(tab === 'coaches' && coaches.length === 0, `${teamBase}/coaches`, setCoaches)
        lazyLoad(tab === 'roster'  && students.length === 0, `${teamBase}/students`, setStudents)
        lazyLoad(tab === 'field'   && field.length === 0,    `/api/coach/tournaments/${id}/field`, setField)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, id, tournament])

    const teamId = tournament
        ? (isOrganizerView ? (schoolId ?? '') : tournament.team_id)
        : ''
    const teamBase = orgApiBase ? `${orgApiBase}/teams/${teamId}` : `/api/coach/teams/${teamId}`

    const addCoach = (email: string) =>
        apiFetch(`/api/coach/teams/${teamId}/coaches`, { method: 'POST', body: JSON.stringify({ email }) })
            .then(r => r.ok ? r.json() : null)
            .then(c => { if (c) setCoaches(p => [...p, c]) })
            .catch(() => {})

    const removeCoach = (coachId: string) =>
        apiFetch(`${teamBase}/coaches/${coachId}`, { method: 'DELETE' })
            .then(r => { if (r.ok) setCoaches(p => p.filter(c => c.coach_id !== coachId)) })
            .catch(() => {})

    const makeOwner = (coachId: string) =>
        apiFetch(`/api/organizer/tournament/${id}/teams/${teamId}/owner`, { method: 'PUT', body: JSON.stringify({ coachId }) })
            .then(r => { if (r.ok) setCoaches(p => p.map(c => ({ ...c, is_owner: c.coach_id === coachId }))) })
            .catch(() => {})

    const addStudent = (name: string, pronouns: string | null) =>
        apiFetch(`${teamBase}/students`, { method: 'POST', body: JSON.stringify({ student_name: name, pronouns }) })
            .then(r => r.ok ? r.json() : null)
            .then(s => { if (s) setStudents(p => [...p, s]) })
            .catch(() => {})

    const removeStudent = (studentId: string) =>
        apiFetch(`${teamBase}/students/${studentId}`, { method: 'DELETE' })
            .then(r => { if (r.ok) setStudents(p => p.filter(s => s.student_id !== studentId)) })
            .catch(() => {})

    return {
        tournament, schedule, results, coaches, students, field,
        teamId, teamBase,
        addCoach, removeCoach, makeOwner, addStudent, removeStudent,
    }
}
