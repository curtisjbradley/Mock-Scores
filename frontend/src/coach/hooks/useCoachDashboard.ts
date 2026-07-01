import { useCoachTournamentData } from './useCoachTournamentData'
import { useCoachStandings } from './useCoachStandings'
import type { CoachTab } from '../constants'

/**
 * Composes coach dashboard data from two focused sub-hooks:
 * - {@link useCoachTournamentData} — tournament info, schedule, results,
 *   coaches, roster, competition field, and CRUD operations.
 * - {@link useCoachStandings} — lazy standings computation via Blockly.
 *
 * Consuming components should prefer importing the sub-hooks directly when
 * they only need one slice. This facade exists for the `CoachDashboard`
 * component which currently needs both slices in one place.
 *
 * @param id - Tournament ID from the route param
 * @param tab - Currently active tab (drives lazy loading in sub-hooks)
 * @param isOrganizerView - True when an organizer is previewing a team's view
 * @param schoolId - Team ID used in organizer view to scope the team endpoints
 */
export function useCoachDashboard(
    id: string | undefined,
    tab: CoachTab,
    isOrganizerView: boolean,
    schoolId: string | undefined,
) {
    const tournamentData = useCoachTournamentData(id, tab, isOrganizerView, schoolId)
    const standings = useCoachStandings(id, tab, tournamentData.tournament)

    return {
        ...tournamentData,
        ...standings,
    }
}
