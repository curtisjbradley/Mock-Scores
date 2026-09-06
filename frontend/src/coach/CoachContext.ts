import { useOutletContext } from 'react-router-dom'
import type {
    ICoach,
    ICoachResultRound,
    ICoachScheduleRound,
    ICoachTournament,
    ICompetitionTeam,
    IStudent,
} from '@mock-scores/shared'

/**
 * Raw payload returned by `GET /coach/tournaments/:id/standings`.
 * The layout fetches this; StandingsPage runs the Blockly computation on it.
 */
export interface StandingsApiPayload {
    config: { statsXml: string; standingsXml: string }
    teams: { id: string; name: string; code: string }[]
    ballots: { p_team_id: string; d_team_id: string; p_points: number; d_points: number; pairing_id: string }[]
}

/** Individual ballot detail for a pairing on the results page. */
export interface BallotDetail {
    p_points: number
    d_points: number
    assignment_id: string
}

/**
 * Master context for the coach dashboard.
 *
 * `CoachLayout` owns every shared-data fetch and every mutation that changes
 * shared data, then exposes the result here via React Router's outlet context.
 * Child pages are pure consumers: they read state and call mutations, but never
 * fetch shared data or resolve the tournament themselves.
 */
export interface CoachContextValue {
    // ── Identity / routing ──────────────────────────────────────────────────
    /**
     * Team id carried in the `/coach/:teamId` URL segment (previewed team in
     * organizer view). Drives page URLs and scopes team-scoped endpoints.
     */
    teamId: string
    /**
     * Tournament id the team belongs to, derived from the team. Used for
     * tournament-scoped endpoints under `/coach/tournaments/:tournamentId/*`.
     */
    tournamentId: string
    /**
     * API base for team-scoped endpoints:
     * `/coach/teams/:teamId` normally, or
     * `/organizer/tournament/:tournamentId/teams/:teamId` in organizer view.
     */
    teamBase: string
    /** True when an organizer is previewing a team's coach view. */
    isOrganizerView: boolean
    /** Base path for this dashboard's pages, e.g. `/coach/:teamId`. */
    base: string

    // ── Shared data ─────────────────────────────────────────────────────────
    tournament: ICoachTournament
    schedule: ICoachScheduleRound[]
    results: ICoachResultRound[]
    coaches: ICoach[]
    students: IStudent[]
    field: ICompetitionTeam[]
    standings: StandingsApiPayload | null
    /** Whether the case format is criminal (affects prosecution/plaintiff labels). */
    isCriminal: boolean

    // ── Coach mutations ───────────────────────────────────────────────────────
    addCoach: (email: string) => Promise<void>
    removeCoach: (coachId: string) => Promise<void>
    makeOwner: (coachId: string) => Promise<void>
    /** Toggles a coach's email-notification preference. */
    toggleNotifications: (coachId: string) => Promise<void>

    // ── Student mutations ─────────────────────────────────────────────────────
    addStudent: (studentName: string, pronouns: string | null) => Promise<void>
    removeStudent: (studentId: string) => Promise<void>

    // ── Lazy loaders ──────────────────────────────────────────────────────────
    /** Loads (and caches) per-pairing ballot detail for the results page. */
    loadBallots: (pairingId: string) => Promise<BallotDetail[]>
}

/**
 * Typed accessor for the coach dashboard master context. Only valid inside a
 * page rendered under `CoachLayout`'s `<Outlet />`.
 */
export function useCoachContext(): CoachContextValue {
    return useOutletContext<CoachContextValue>()
}
