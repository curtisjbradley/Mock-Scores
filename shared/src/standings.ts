export interface IStandingsBallot {
    pointsFor: number;
    pointsAgainst: number;
}

export interface IStandingsPairing {
    opponent: string;
    ballots: IStandingsBallot[];
    won_presider_tiebreaker: boolean;
    /** Number of scorers (submitted ballots) on this pairing. */
    num_scorers: number;
}

export interface IStandingsTeam {
    name: string;
    code: string;
    pairings: IStandingsPairing[];
}

export interface IAwardNomination {
    student_name: string;
    student_id: string;
    team_id: string;
    team_code: string;
    team_name: string;
    award_name: string;
    award_category_id: string;
    scorer_id: string;
    scorer_name: string;
    side: "P" | "D";
    pairing_id: string;
    round_id: string;
    round_name: string;
    ballot_id: string;
    tournament_id: string;
    rank: number;
}