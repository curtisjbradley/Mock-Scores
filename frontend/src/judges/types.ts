/** A single scoreable role within a category (e.g. "Direct Exam by Attorney"). */
export interface ITrialAssignment {
    /** Human-readable label shown in the scoresheet row. */
    assignmentName: string;
    /** Stable key used to build form field IDs and payload keys. */
    assignmentKey: string;
    /** Student ID of the prosecution-side performer, or null if prosecution has no role here. */
    pStudentId: string | null;
    /** Student ID of the defense-side performer, or null if defense has no role here. */
    dStudentId: string | null;
    /** Which side(s) are scored: "P" prosecution only, "D" defense only, "BOTH" for both. */
    side: "D" | "P" | "BOTH";
    /** Minimum valid score (inclusive). */
    minScore: number;
    /** Maximum valid score (inclusive). */
    maxScore: number;
}

/** A named group of assignments shown as a section in the scoresheet (e.g. "P Witness 1"). */
export interface IScoringCategory {
    /** Display name for the category header. */
    categoryName: string;
    /** ID of the witness character associated with this category, or null for non-witness categories. */
    witnessId: string | null;
    /** Ordered list of scoreable assignments within this category. */
    categoryAssignments: ITrialAssignment[];
}

/** Personal information for a student competitor. School identity is intentionally omitted from display. */
export interface IStudentInfo {
    /** Full name of the student. */
    name: string;
    /** Pronouns to display alongside the student's name (e.g. "she/her"), or null if not provided. */
    pronouns: string | null;
    /** ID of the school/team this student belongs to. Used for anonymisation checks, not displayed to scorers. */
    schoolId: string;
}

/** A witness character appearing in the trial. */
export interface IWitnessInfo {
    /** The fictional character name (e.g. "Rio Sacks"). */
    characterName: string;
}

/**
 * The complete data contract for a single scoresheet session.
 * Passed from the backend to the frontend and used throughout all scoring components.
 */
export interface IScoreSheetFormat {
    /** True if the case is criminal (uses "Prosecution"), false for civil (uses "Plaintiff"). */
    isCriminal: boolean;
    /** True if the current user is the presiding judge rather than a scoring judge. */
    isPresider: boolean;
    /**
     * True if the presider only submits a tiebreaker and does not score.
     * When true, the full scoresheet is skipped and only the tiebreaker UI is shown.
     */
    presiderTiebreakerOnly: boolean;
    /** Unique identifier for the tournament. */
    tournamentID: string;
    /** Unique identifier for this specific trial. */
    trialID: string;
    /** ID of the scorer/judge submitting this sheet. */
    scorerID: string;
    /** Display name of the scorer shown on the conflict-check screen. */
    scorerName: string;
    /** Display name of the presiding judge. */
    presiderName: string;
    /** Courtroom identifier (e.g. "4B"). */
    courtroomNumber: string;
    /** Case name displayed in the scoresheet header (e.g. "People v Fromholz"). */
    caseName: string;
    /** Team code for the prosecution/plaintiff side (e.g. "103"). Never the school name. */
    prosecution: string;
    /** Team code for the defense side (e.g. "101"). Never the school name. */
    defense: string;
    /** Map of student ID → student info. Assignments reference students by ID. */
    students: Record<string, IStudentInfo>;
    /** Map of witness ID → witness character info. Categories reference witnesses by ID. */
    witnesses: Record<string, IWitnessInfo>;
    /** Map of category ID → scoring category. Rendered in the order defined by `categoryOrder`. */
    scoringCategories: Record<string, IScoringCategory>;
    /** Ordered list of category IDs defining the display and navigation order of the scoresheet. */
    categoryOrder: string[];
}
