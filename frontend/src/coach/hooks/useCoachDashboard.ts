import { useEffect, useState } from 'react'
import * as Blockly from 'blockly'
import { apiFetch } from '../../auth/auth'
import { computeStandings } from '../../organizer/blockly/standingsEngine'
import { extractStandingsConfig, parseColumnsFromXml } from '../../organizer/blockly/standingsGenerator'
import { standingsBlockDefs } from '../../organizer/blockly/standingsBlocks'
import { tiebreakerBlockDefs } from '../../organizer/blockly/tiebreakerBlocks'
import type {
    ICoachTournament, ICoachScheduleRound, ICoachResultRound,
    ICoach, IStudent, ICompetitionTeam, IStandingsTeam,
} from '@mock-scores/shared'
import type { CoachTab } from '../constants'

interface CoachDashboardData {
    tournament: ICoachTournament | null
    schedule: ICoachScheduleRound[]
    results: ICoachResultRound[]
    coaches: ICoach[]
    students: IStudent[]
    field: ICompetitionTeam[]
    standingsRows: ReturnType<typeof computeStandings>
    standingsCols: { stat: string; label: string }[]
    standingsXml: string | null
    teamId: string
    teamBase: string
    addCoach: (email: string) => void
    removeCoach: (coachId: string) => void
    makeOwner: (coachId: string) => void
    addStudent: (name: string, pronouns: string | null) => void
    removeStudent: (studentId: string) => void
}

export function useCoachDashboard(
    id: string | undefined,
    tab: CoachTab,
    isOrganizerView: boolean,
    schoolId: string | undefined,
): CoachDashboardData {
    const orgApiBase = isOrganizerView ? `/api/organizer/tournament/${id}` : null

    const [tournament, setTournament] = useState<ICoachTournament | null>(null)
    const [schedule, setSchedule] = useState<ICoachScheduleRound[]>([])
    const [results, setResults] = useState<ICoachResultRound[]>([])
    const [coaches, setCoaches] = useState<ICoach[]>([])
    const [students, setStudents] = useState<IStudent[]>([])
    const [field, setField] = useState<ICompetitionTeam[]>([])
    const [standingsRows, setStandingsRows] = useState<ReturnType<typeof computeStandings>>([])
    const [standingsCols, setStandingsCols] = useState<{ stat: string; label: string }[]>([])
    const [standingsXml, setStandingsXml] = useState<string | null>(null)

    // Initial load: tournament info + schedule + results
    useEffect(() => {
        if (!id) return
        if (isOrganizerView) {
            Promise.all([
                apiFetch(`/api/organizer/tournament/${id}`).then(r => r.ok ? r.json() : null),
                apiFetch(`/api/coach/tournaments/${id}/schedule`).then(r => r.ok ? r.json() : []),
                apiFetch(`/api/coach/tournaments/${id}/results`).then(r => r.ok ? r.json() : []),
                apiFetch(`/api/organizer/tournament/${id}/teams`).then(r => r.ok ? r.json() : []),
            ]).then(([t, s, r, teams]) => {
                const team = (teams as { id: string; name: string; code: string }[]).find(tm => tm.id === schoolId)
                if (t) setTournament({ ...t, team_id: schoolId ?? '', team_name: team?.name ?? '', team_code: team?.code ?? '' })
                setSchedule(s); setResults(r)
            }).catch(() => {})
        } else {
            Promise.all([
                apiFetch('/api/coach/tournaments').then(r => r.ok ? r.json() : []),
                apiFetch(`/api/coach/tournaments/${id}/schedule`).then(r => r.ok ? r.json() : []),
                apiFetch(`/api/coach/tournaments/${id}/results`).then(r => r.ok ? r.json() : []),
            ]).then(([ts, s, r]) => {
                setTournament((ts as ICoachTournament[]).find(t => t.id === id) ?? null)
                setSchedule(s); setResults(r)
            }).catch(() => {})
        }
    }, [id, isOrganizerView, schoolId])

    // Lazy tab data loads
    useEffect(() => {
        if (!id || !tournament) return
        const teamId = isOrganizerView ? (schoolId ?? '') : tournament.team_id
        const teamBase = orgApiBase ? `${orgApiBase}/teams/${teamId}` : `/api/coach/teams/${teamId}`
        if (tab === 'coaches' && coaches.length === 0)
            apiFetch(`${teamBase}/coaches`).then(r => r.ok ? r.json() : []).then(setCoaches).catch(() => {})
        if (tab === 'roster' && students.length === 0)
            apiFetch(`${teamBase}/students`).then(r => r.ok ? r.json() : []).then(setStudents).catch(() => {})
        if (tab === 'field' && field.length === 0)
            apiFetch(`/api/coach/tournaments/${id}/field`).then(r => r.ok ? r.json() : []).then(setField).catch(() => {})
        if (tab === 'standings' && standingsRows.length === 0) {
            apiFetch(`/api/coach/tournaments/${id}/standings`).then(r => r.ok ? r.json() : null).then(data => {
                if (!data?.config) return
                try { Blockly.common.defineBlocks(standingsBlockDefs) } catch { /* already defined */ }
                try { Blockly.common.defineBlocks(tiebreakerBlockDefs) } catch { /* already defined */ }
                const statsWs = new Blockly.Workspace()
                const standingsWs = new Blockly.Workspace()
                Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(data.config.statsXml), statsWs)
                Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(data.config.standingsXml), standingsWs)
                const config = extractStandingsConfig(statsWs, standingsWs)
                statsWs.dispose(); standingsWs.dispose()
                const teamMap = new Map<string, IStandingsTeam>()
                for (const t of data.teams as { id: string; name: string; code: string }[])
                    teamMap.set(t.id, { name: t.name, code: t.code, pairings: [] })
                const pairingMap = new Map<string, { p: string; d: string; pPts: number; dPts: number }>()
                for (const b of data.ballots as { p_team_id: string; d_team_id: string; p_points: number; d_points: number; pairing_id: string }[]) {
                    const existing = pairingMap.get(b.pairing_id)
                    if (existing) { existing.pPts += b.p_points; existing.dPts += b.d_points }
                    else pairingMap.set(b.pairing_id, { p: b.p_team_id, d: b.d_team_id, pPts: b.p_points, dPts: b.d_points })
                }
                for (const [, { p, d, pPts, dPts }] of pairingMap) {
                    const pTeam = teamMap.get(p); const dTeam = teamMap.get(d)
                    if (pTeam && dTeam) {
                        pTeam.pairings.push({ opponent: dTeam.code, ballots: [{ pointsFor: pPts, pointsAgainst: dPts }], won_presider_tiebreaker: false })
                        dTeam.pairings.push({ opponent: pTeam.code, ballots: [{ pointsFor: dPts, pointsAgainst: pPts }], won_presider_tiebreaker: false })
                    }
                }
                setStandingsCols(parseColumnsFromXml(data.config.statsXml))
                setStandingsRows(computeStandings([...teamMap.values()], config))
                setStandingsXml(data.config.standingsXml)
            }).catch((e) => { console.error('Standings computation failed:', e) })
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, id, tournament])

    const teamId = tournament
        ? (isOrganizerView ? (schoolId ?? '') : tournament.team_id)
        : ''
    const teamBase = orgApiBase ? `${orgApiBase}/teams/${teamId}` : `/api/coach/teams/${teamId}`

    const addCoach = (email: string) =>
        apiFetch(`/api/coach/teams/${teamId}/coaches`, { method: 'POST', body: JSON.stringify({ email }) })
            .then(r => r.ok ? r.json() : null).then(c => { if (c) setCoaches(p => [...p, c]) }).catch(() => {})

    const removeCoach = (coachId: string) =>
        apiFetch(`${teamBase}/coaches/${coachId}`, { method: 'DELETE' })
            .then(r => { if (r.ok) setCoaches(p => p.filter(c => c.coach_id !== coachId)) }).catch(() => {})

    const makeOwner = (coachId: string) =>
        apiFetch(`/api/organizer/tournament/${id}/teams/${teamId}/owner`, { method: 'PUT', body: JSON.stringify({ coachId }) })
            .then(r => { if (r.ok) setCoaches(p => p.map(c => ({ ...c, is_owner: c.coach_id === coachId }))) }).catch(() => {})

    const addStudent = (name: string, pronouns: string | null) =>
        apiFetch(`${teamBase}/students`, { method: 'POST', body: JSON.stringify({ student_name: name, pronouns }) })
            .then(r => r.ok ? r.json() : null).then(s => { if (s) setStudents(p => [...p, s]) }).catch(() => {})

    const removeStudent = (studentId: string) =>
        apiFetch(`${teamBase}/students/${studentId}`, { method: 'DELETE' })
            .then(r => { if (r.ok) setStudents(p => p.filter(s => s.student_id !== studentId)) }).catch(() => {})

    return {
        tournament, schedule, results, coaches, students, field,
        standingsRows, standingsCols, standingsXml,
        teamId, teamBase,
        addCoach, removeCoach, makeOwner, addStudent, removeStudent,
    }
}
