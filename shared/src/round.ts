export interface IRound {
    round_id: string
    results_public: boolean
    teams_public: boolean
    position: number
    name: string
    round_time: string | null
}

export interface IPairing {
    pairing_id: string
    round_id: string
    p_team: string
    d_team: string
    courtroom: string | null
}

export interface IPairingScorer {
    assignment_id: string;
    type: 'registered' | 'paper';
    scorer_id: string;
    name: string;
    is_presider: boolean;
    /** True when the presider is set to only score the tiebreaker (show_scores=false). */
    presider_only_tiebreaker: boolean;
    conflict_reported: boolean;
    p_points: number | null;
    d_points: number | null;
}

export interface IBallotStatus {
    pairing_id: string;
    total_scorers: number;
    submitted: number;
}
