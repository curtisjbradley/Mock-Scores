export interface IStandingsBallot {
    pointsFor: number;
    pointsAgainst: number;
}

export interface IStandingsPairing {
    opponent: string;
    ballots: IStandingsBallot[];
    won_presider_tiebreaker: boolean;
}

export interface IStandingsTeam {
    name: string;
    code: string;
    pairings: IStandingsPairing[];
}
