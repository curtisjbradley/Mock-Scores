export interface IScorer {
    scorer_id: string;
    first_name: string
    last_name: string
    email: string;
}

export interface IConflict {
    id: string;
    scorer_id: string;
    team_id: string;
    team_name: string;
}
