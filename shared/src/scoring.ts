export interface IScoringFieldFull {
    id: string;
    label: string;
    min: number;
    max: number;
    multiplier: number;
    assignable: boolean;
    eligibleForAward: boolean;
    /** ID of the individual award category this field is eligible for, or null */
    awardCategoryId: string | null;
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

export interface ScoreSection {
    categoryId: string
    assignmentKey: string
    side: 'P' | 'D'
    studentId: string | null
    score: number
}

export interface ScorecardPayload {
    pairingID: string
    scores: ScoreSection[]
    nominations: {
        awardCategoryId: string
        studentId: string
        rank: number
    }[]
    tiebreaker: string
}

/** Individual award category as configured by the organizer */
export interface IIndividualAwardCategory {
    id: string
    name: string
    minNominees: number
    maxNominees: number
}
