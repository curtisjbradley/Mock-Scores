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
        showTiebreaker: boolean;
        fillableScores : boolean;
    }
    pairingID: string;
    scorer : IScoringUser;

    presiderName: string;
    courtroomNumber: string;
    caseName: string;
    prosecutionCode: string;
    defenseCode: string;
    students: Record<string, IStudentInfo>;
    witnesses: Record<string, IWitnessInfo>;
    scoringCategories: Record<string, IScoreCategory>;
    categoryOrder: string[];
    /** Award categories for post-ballot nomination step. Empty object if none configured. */
    awardCategories: Record<string, IAwardCategoryInfo>;
}

export interface IScoringUser {
    firstName: string;
    lastName: string;
    scorerID: string;
    isPaper: boolean;
}
