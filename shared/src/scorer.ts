export interface IScorer {
    scorer_id: string;
    name: string;
    /** Email is optional: paper (offline) scorers may have none. Required for online scorers. */
    email: string | null;
    /** True for offline/paper judges who score on paper and are never emailed a link. */
    is_paper: boolean;
    /** Whether this judge is willing to preside (AMTA 10.19(2)(a)). */
    willing_to_preside: boolean;
    /** Scorer IDs this judge prefers to score alongside (soft hint for auto-assign). */
    prefers_to_score_with?: string[];
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
