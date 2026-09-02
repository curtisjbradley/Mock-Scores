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
    /**
     * When set, the new tournament copies its scoring categories, fields, and
     * award categories from this scoring template (server-side). In this case
     * `scoringCategories` and `awardCategories` are omitted. When null, the
     * manual branch is used and those arrays carry the definitions instead.
     */
    scoringTemplateId?: string | null
    scoringCategories?: {
        name: string
        witnessCategory: boolean
        position: number
        fields: {
            label: string
            min: number
            max: number
            multiplier: number
            assignable: boolean
            /**
             * Links this field to an award category. During tournament creation
             * this may reference an award category's client-side `tempId` from
             * `awardCategories` below (the backend remaps it to the real UUID),
             * or a persisted award category UUID. Null when not eligible.
             */
            awardCategoryId: string | null
            visibleToScorers: boolean
            prosecution: boolean
            defense: boolean
            calling: boolean
            crossing: boolean
            position: number
        }[]
    }[]
    /**
     * Individual award categories to create with the tournament (manual branch).
     * Each `tempId` is a client-side identifier that scoring fields reference via
     * their `awardCategoryId`; the backend maps it to the generated UUID on insert.
     */
    awardCategories?: {
        tempId: string
        name: string
        minNominees: number
        maxNominees: number
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
    awards: boolean
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
    courtroomID: string | null
}
