import { apiFetch } from '../auth/auth'
import type { ICoachTournament } from '@mock-scores/shared'

/**
 * Resolved tournament + team info that every coach page needs.
 */
export interface CoachTournamentInfo {
    tournament: ICoachTournament
    /**
     * The coach's team id. In the coach view this is the id carried in the
     * `/coach/:teamId` URL segment; in organizer preview it is the previewed
     * team (`schoolId`). Used to build URLs and scope team endpoints.
     */
    teamId: string
    /**
     * The tournament id the team belongs to. Used for tournament-scoped
     * endpoints under `/coach/tournaments/:tournamentId/*`, which query by
     * tournament id even though the coach dashboard is navigated by team.
     */
    tournamentId: string
    /**
     * API base for team-scoped endpoints:
     * `/coach/teams/:teamId` normally, or
     * `/organizer/tournament/:tournamentId/teams/:teamId` in organizer view.
     */
    teamBase: string
}

/**
 * Resolves the tournament and the relevant team for the coach dashboard.
 *
 * In the coach view the dashboard is scoped to a *team* (`/coach/:teamId`): a
 * team belongs to exactly one tournament, so the tournament id is derived from
 * the team. In organizer preview the tournament id comes from the route and the
 * team is the previewed `schoolId`.
 *
 * @param teamId - Team id from the `/coach/:teamId` route param (coach view),
 *                 or the previewed team (`schoolId`) in organizer view
 * @param isOrganizerView - True when an organizer previews a team's view
 * @param organizerTournamentId - Tournament id from the route in organizer view
 * @returns Resolved info, or null if it could not be resolved
 */
export async function resolveCoachTournament(
    teamId: string,
    isOrganizerView: boolean,
    organizerTournamentId: string | undefined,
): Promise<CoachTournamentInfo | null> {
    if (isOrganizerView) {
        const tournamentId = organizerTournamentId ?? ''
        const [t, teams] = await Promise.all([
            apiFetch(`/organizer/tournament/${tournamentId}`).then(r => r.ok ? r.json() : null),
            apiFetch(`/organizer/tournament/${tournamentId}/teams`).then(r => r.ok ? r.json() : []),
        ])
        if (!t) return null
        const team = (teams as { id: string; name: string; code: string }[]).find(tm => tm.id === teamId)
        const tournament: ICoachTournament = {
            ...t,
            team_id: teamId,
            team_name: team?.name ?? '',
            team_code: team?.code ?? '',
        }
        return { tournament, teamId, tournamentId, teamBase: `/organizer/tournament/${tournamentId}/teams/${teamId}` }
    }

    const tournaments = await apiFetch('/coach/tournaments').then(r => r.ok ? r.json() : [])
    const tournament = (tournaments as ICoachTournament[]).find(t => t.team_id === teamId) ?? null
    if (!tournament) return null
    return { tournament, teamId, tournamentId: tournament.id, teamBase: `/coach/teams/${teamId}` }
}
