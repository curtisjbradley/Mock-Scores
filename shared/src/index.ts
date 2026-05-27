export interface TournamentPayload {
    tournament: {
        name: string
        location: string
        startDate: string | null
        endDate: string | null
        startTbd: boolean
        endTbd: boolean
    }
    caseFormat: {
        caseName: string
        criminalCase: boolean
        pWitnessesCalled: number | null
        dWitnessesCalled: number | null
        hasSwing: boolean
        pWitnessNames: string[]
        dWitnessNames: string[]
        swingWitnessNames: string[]
    }
    scoringCategories: {
        name: string
        witnessCategory: boolean
        position: number
        fields: {
            label: string
            min: number
            max: number
            multiplier: number
            assignable: boolean
            eligibleForAward: boolean
            visibleToScorers: boolean
            prosecution: boolean
            defense: boolean
            calling: boolean
            crossing: boolean
            position: number
        }[]
    }[]
    standingsConfigId: string | null
}

export interface IStandingsConfig {
    id: string
    statsXml: string
    standingsXml: string
}

export interface IStandingsTemplate {
    id: string
    label: string
    description: string
    config_id: string
}

export interface ScorecardPayload {
    pairingID: string
    scores: ScoreSection[]
    nominations: {
        studentId: string
        rank: number
    }[]
    tiebreaker?: string
}

export interface ScoreSection {
    categoryId: string
    assignmentKey: string
    side: 'P' | 'D'
    studentId: string | null
    score: number
}

export interface IRound {
    round_id: string
    results_public: boolean
    teams_public: boolean
    position: number
    name: string
    round_time: string | null
}

export interface IScorer {
    scorer_id: string;
    first_name: string
    last_name: string
    email: string;
}

export interface IScoringFieldFull {
    id: string;
    label: string;
    min: number;
    max: number;
    multiplier: number;
    assignable: boolean;
    eligibleForAward: boolean;
    visibleToScorers: boolean;
    prosecution: boolean;
    defense: boolean;
    calling: boolean;
    crossing: boolean;
}

export interface IScoringCategory {
    id: string;
    name: string;
    witnessCategory: boolean;
    position: number;
    fields: IScoringFieldFull[];
}

export interface ITournament {
    id: string;
    name: string;
    location: string;
    start_date: Date | null;
    end_date: Date | null;
    created_at: Date;
    case_format_id: string;
    num_teams: number;
    num_rounds: number;
}

export interface ITournamentDetails {
    case_name: string;
    criminal_case: boolean;
    p_witnesses_called: number;
    d_witnesses_called: number;
}
export interface IWitnesses {
    pWitnessNames: string[];
    dWitnessNames: string[];
    swingWitnessNames: string[];
}


export interface IOrganizer {
    id : string;
    name: string;
    email: string;
    role: 'owner' | 'delegate';
    has_joined: boolean;
}

export interface ICourtroom{
    id : string,
    name: string;
    location: string;
}

export interface ITeam {
    id: string;
    tournament_id: string;
    name: string;
    code: string;
    coach_email: string;
    has_joined: boolean;
}