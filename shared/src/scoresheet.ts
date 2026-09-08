export interface ITrialAssignment {
    assignmentName: string;
    assignmentKey: string;
    pStudentId: string | null;
    dStudentId: string | null;
    side: 'D' | 'P' | 'BOTH';
    minScore: number;
    maxScore: number;
}

export interface IScoreCategory {
    categoryName: string;
    witnessId: string | null;
    categoryAssignments: ITrialAssignment[];
}

export interface IStudentInfo {
    name: string;
    pronouns: string | null;
    schoolId: string;
}

export interface IWitnessInfo {
    characterName: string;
}

/** Award category info sent to the scorer for post-ballot nominations */
export interface IAwardCategoryInfo {
    name: string;
    minNominees: number;
    maxNominees: number;
    /** Student IDs eligible for nomination in this category (scored on linked fields) */
    eligibleStudentIds: string[];
}

export interface IScoreSheetFormat {
    isCriminal: boolean;
    ballotOptions: {
        fillableScores: boolean;
        showTiebreaker: boolean;
    }
    pairingID: string;
    scorer : IScoringUser;

    presiderName: string;
    courtroomNumber: string;
    caseName: string;
    /** Tournament display name, shown on the scoresheet and printable ballot. */
    tournamentName: string;
    prosecutionCode: string;
    defenseCode: string;
    prosecutionId: string;
    defenseId: string;
    students: Record<string, IStudentInfo>;
    witnesses: Record<string, IWitnessInfo>;
    scoringCategories: Record<string, IScoreCategory>;
    categoryOrder: string[];
    /** Award categories for post-ballot nomination step. Empty object if none configured. */
    awardCategories: Record<string, IAwardCategoryInfo>;
    /**
     * True once the organizer has locked the round. Scoring is only open when locked;
     * the scoresheet UI disables score entry and submission until this is true, and the
     * server rejects ballot submissions for unlocked rounds.
     */
    roundLocked: boolean;
}

export interface IScoringUser {
    firstName: string;
    lastName: string;
    scorerID: string;
    isPaper: boolean;
}
