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

export interface IScoreSheetFormat {
    isCriminal: boolean;
    ballotOptions: {
        showTiebreaker: boolean;
        fillableScorers : boolean;
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
}

export interface IScoringUser {
    firstName: string;
    lastName: string;
    scorerID: string;
}
