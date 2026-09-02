export interface IScoringFieldFull {
    id: string;
    label: string;
    min: number;
    max: number;
    multiplier: number;
    assignable: boolean;
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

/**
 * A scoring template as served for the tournament creation wizard's picker.
 *
 * Only the identifier and display fields are sent to the client. When an
 * organizer selects a preset, the client sends the template `id` and the
 * backend copies the template's scoring categories, fields, and award
 * categories into the new tournament server-side. The "Manual" option is
 * represented client-side (absence of a template), not here.
 */
export interface IScoringTemplate {
    id: string
    label: string
    description: string
}
