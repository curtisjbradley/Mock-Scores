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
