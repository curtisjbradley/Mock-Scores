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
    status: 'active' | 'completed' | 'archived';
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

export interface IDuplicateOptions {
    scorers: boolean
    courtrooms: boolean
    scoringCategories: boolean
    witnesses: boolean
    format: boolean
    tiebreaker: boolean
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

export interface IPairingCreationPayload {
    prosectionID: string
    defenseID: string
    courtroomID: string
}
