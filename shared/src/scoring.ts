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
    /**
     * Snapshot of the scoresheet segment structure at submission time, captured
     * so a combined/tabulated view can render this ballot's rows deterministically
     * even if the tournament's scoring template later changes (its category/field
     * IDs, and therefore `assignmentKey`s, can drift). Optional for backward
     * compatibility: ballots submitted before this field existed will not have it.
     */
    layout?: BallotLayoutSegment[]
}

/**
 * One row of the captured ballot layout: a single scoring assignment together
 * with its display context, in the order it appeared on the scoresheet.
 */
export interface BallotLayoutSegment {
    /** Stable key for this assignment, matching the `assignmentKey` on its scores. */
    assignmentKey: string
    /** The assignment's display label, e.g. "Attorney Direct Examination". */
    assignmentName: string
    /** The owning category's display name, e.g. "Pretrial" or "Witnesses". */
    categoryName: string
    /** Witness character name when the category is witness-scoped, else null. */
    witnessName: string | null
    /** Which side(s) this assignment is scored on. */
    side: 'D' | 'P' | 'BOTH'
    /** Prosecution student name, if any. */
    pStudentName: string | null
    /** Defense student name, if any. */
    dStudentName: string | null
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
