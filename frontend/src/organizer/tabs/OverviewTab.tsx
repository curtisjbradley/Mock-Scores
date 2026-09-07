import {useEffect, useState} from 'react'
import type {IRound, ITournamentSummary} from '@mock-scores/shared'
import { apiFetch } from '../../auth/auth'
import type { OrganizerScreen } from '../constants'
import LoadingPage from "../../layout/LoadingPage.tsx";
import AddButton from "../../shared/components/AddButton.tsx";
import {DashboardStatusCard} from "../components/DashboardStatusCard.tsx";
import {formatDate} from "../../utils/format.ts";
import {useNavigate} from "react-router-dom";
interface Props {
    tournamentId: string
    /** Navigate to another dashboard section (used by the quick-link cards). */
    onNavigate: (screen: OrganizerScreen) => void
}



/** A round is "upcoming" when it has a time in the future, or no time set yet. */
function findNextRound(rounds: IRound[]): IRound | null {
    const now = Date.now()
    const timed = rounds
        .filter(r => r.round_time && new Date(r.round_time).getTime() >= now)
        .sort((a, b) => new Date(a.round_time!).getTime() - new Date(b.round_time!).getTime())
    if (timed.length > 0) return timed[0]
    const sorted = [...rounds].sort((a, b) => a.position - b.position)
    return sorted.find(r => !r.round_time) ?? null
}

/**
 * Landing page for the organizer tournament dashboard. Surfaces at-a-glance
 * operational information — teams, rounds, publish progress, ballot completion,
 * and the next round — with quick links into the detailed management sections.
 */
export default function OverviewTab({ tournamentId, onNavigate }: Props) {
    const [loading, setLoading] = useState<boolean>(true);
    const [rounds, setRounds] = useState<IRound[]>([])
    const [overview, setOverview] = useState<ITournamentSummary | null>(null);

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            apiFetch(`/organizer/tournament/${tournamentId}/rounds`)
                .then(r => r.ok ? r.json() : [])
                .catch(() => []),
            apiFetch(`/organizer/tournament/${tournamentId}/overview`)
                .then(r => r.ok ? r.json() : null)
                .catch(() => null)
        ])
            .then(([roundsData, overviewData]: [IRound[], ITournamentSummary | null]) => {
                if (cancelled) return;
                setRounds(roundsData);
                setOverview(overviewData);
            }).finally(() => setLoading(false));

        return () => {
            cancelled = true;
        };
    }, [tournamentId]);

    const nextRound = findNextRound(rounds)
    const navigate=  useNavigate()

    if (loading && rounds.length == 0) {
        return (<LoadingPage loadingText={"Getting tournament information..."}/>)
    }

    return (
        <div className="dash-overview">
            <div className="dash-overview-grid">
                <DashboardStatusCard title={"Next Round"}
                button ={
                    nextRound?.round_id ?<AddButton onClick={() => {navigate(`/organizer/${tournamentId}/round/${nextRound?.round_id}`)}}> Manage Round</AddButton>
                        : <AddButton onClick={() => onNavigate('rounds')}>Manage Rounds</AddButton>

                }>
                    {nextRound ?
                        <>
                        <h3>{nextRound.name}</h3>
                        {nextRound.round_time && <h4>{formatDate(nextRound?.round_time)} @ {new Date(nextRound.round_time).toLocaleTimeString()}</h4>}
                        </>
                     :
                        <p>
                            No upcoming rounds
                        </p>

                    }
                </DashboardStatusCard>

                {overview &&
                    <>
                {(overview.rounds.withoutPairings > 0) &&
                <DashboardStatusCard title={"Rounds Without Pairings"} button = {<AddButton onClick={() => onNavigate('rounds')}>Manage Rounds</AddButton>}>
                    <span className={"dash-stat-alert-value"}>{overview.rounds.withoutPairings}</span>
                    <span className={"dash-stat-alert-sub"}>Rounds</span>
                </DashboardStatusCard>}
                        {(overview.teams.withoutRosters > 0) &&
                            <DashboardStatusCard title={"Teams Without Rosters"} button = {<AddButton onClick={() => onNavigate('teams')}>Manage Teams</AddButton>}>
                                <span className={"dash-stat-alert-value"}>{overview.teams.withoutRosters}</span>
                                {/*TODO: Add a page listing all these teams */}
                                <span className={"dash-stat-alert-sub"}>Teams</span>
                            </DashboardStatusCard>}
                        {(overview.teams.withoutDefaultAssignments > 0) &&
                            <DashboardStatusCard title={"Teams Without Default Assignments"} button = {<AddButton onClick={() => onNavigate('teams')}>Manage Teams</AddButton>}>
                                <span className={"dash-stat-alert-value"}>{overview.teams.withoutDefaultAssignments}</span>
                                {/*TODO: Add a page listing all these teams */}
                                <span className={"dash-stat-alert-sub"}>Teams</span>
                            </DashboardStatusCard>}
                        {(overview.teams.withoutCoaches > 0) &&
                            <DashboardStatusCard title={"Unregistered Coaches"} button = {<AddButton onClick={() => onNavigate('teams')}>Manage Coaches</AddButton>}>
                                <span className={"dash-stat-alert-value"}>{overview.teams.withoutCoaches}</span>
                                {/*TODO: Add a page listing all these teams */}
                                <span className={"dash-stat-alert-sub"}>Coaches</span>
                            </DashboardStatusCard>}
                        {(overview.teams.withoutDefaultCallOrders > 0) &&
                            <DashboardStatusCard title={"Teams without call orders"} button = {<AddButton onClick={() => onNavigate('teams')}>Manage Teams</AddButton>}>
                                <span className={"dash-stat-alert-value"}>{overview.teams.withoutDefaultCallOrders}</span>
                                {/*TODO: Add a page listing all these teams */}
                                <span className={"dash-stat-alert-sub"}>Teams</span>
                            </DashboardStatusCard>}
                        {(overview.ballots.paperAwaitingInput > 0) &&
                            <DashboardStatusCard title={"Paper Ballots Awaiting Scores"} button = {<AddButton onClick={() => onNavigate('rounds')}>Manage Rounds</AddButton>}>
                                <span className={"dash-stat-alert-value"}>{overview.ballots.paperAwaitingInput}</span>
                                {/*TODO: Add a page listing all these teams */}
                                <span className={"dash-stat-alert-sub"}>Teams</span>
                            </DashboardStatusCard>}
                        {(overview.pairings.withoutCourtrooms > 0) &&
                            <DashboardStatusCard title={"Pairings without Courtrooms"} button = {<AddButton onClick={() => onNavigate('rounds')}>Manage Rounds</AddButton>}>
                                <span className={"dash-stat-alert-value"}>{overview.pairings.withoutCourtrooms}</span>
                                {/*TODO: Add a page listing all these teams */}
                                <span className={"dash-stat-alert-sub"}>Pairings</span>
                            </DashboardStatusCard>}
                        {(overview.pairings.withoutScorers > 0) &&
                            <DashboardStatusCard title={"Pairings without Scorers"} button = {<AddButton onClick={() => onNavigate('rounds')}>Manage Rounds</AddButton>}>
                                <span className={"dash-stat-alert-value"}>{overview.pairings.withoutScorers}</span>
                                {/*TODO: Add a page listing all these teams */}
                                <span className={"dash-stat-alert-sub"}>Pairings</span>
                            </DashboardStatusCard>}
                        {(overview.pairings.withoutPresiders > 0) &&
                            <DashboardStatusCard title={"Pairings without Presiders"} button = {<AddButton onClick={() => onNavigate('rounds')}>Manage Rounds</AddButton>}>
                                <span className={"dash-stat-alert-value"}>{overview.pairings.withoutPresiders}</span>
                                {/*TODO: Add a page listing all these teams */}
                                <span className={"dash-stat-alert-sub"}>Pairings</span>
                            </DashboardStatusCard>}
                        {(overview.scorers.withConflicts > 0) &&
                            <DashboardStatusCard title={"Scorers assigned to conflicts"} button = {<AddButton onClick={() => onNavigate('rounds')}>Manage Rounds</AddButton>}>
                                <span className={"dash-stat-alert-value"}>{overview.scorers.withConflicts}</span>
                                {/*TODO: Add a page listing all these teams */}
                                <span className={"dash-stat-alert-sub"}>Scorers</span>
                            </DashboardStatusCard>}
                    </>
                }


            </div>
        </div>
    )
}
