import type { ITeam } from './organizer.js'

export interface IScorer {
    scorer_id: string;
    name: string;
    /** Email is optional: paper (offline) scorers may have none. Required for online scorers. */
    email: string | null;
    /** True for offline/paper judges who score on paper and are never emailed a link. */
    is_paper: boolean;
    /** Whether this judge is willing to preside (AMTA 10.19(2)(a)). */
    willing_to_preside: boolean;
    /** Organizer-only context about this scorer. */
    notes: string;
    /** Scorer IDs this judge prefers to score alongside (soft hint for auto-assign). */
    prefers_to_score_with?: string[];
}

/** One tournament pairing to which a scorer has been assigned. */
export interface IScorerAssignmentSummary {
    assignment_id: string;
    pairing_id: string;
    round_id: string;
    round_name: string;
    prosecution_id: string;
    defense_id: string;
    prosecution: string;
    defense: string;
    courtroom_id: string | null;
    courtroom: string | null;
    other_scorers: IScorerAssignmentOtherScorer[];
    is_presider: boolean;
    ballot_id: string | null;
}

/** A fellow scorer assigned to the same pairing. */
export interface IScorerAssignmentOtherScorer {
    scorer_id: string;
    name: string;
}

/** A tournament pairing available for direct scorer assignment. */
export interface IScorerAssignablePairing {
    pairing_id: string;
    round_id: string;
    round_name: string;
    prosecution: string;
    defense: string;
    courtroom: string | null;
    scorer_count: number;
}

/** Complete organizer context for one scorer-management page. */
export interface IScorerDetail {
    scorer: IScorer;
    scorers: IScorer[];
    assignments: IScorerAssignmentSummary[];
    available_pairings: IScorerAssignablePairing[];
    conflicts: IConflict[];
    teams: ITeam[];
}

export interface IConflict {
    id: string;
    scorer_id: string;
    team_id: string;
    team_name: string;
}

/** A directional "wants to score with" preference between two scorers. */
export interface ICoscoringPreference {
    id: string;
    scorer_id: string;
    preferred_scorer_id: string;
}
