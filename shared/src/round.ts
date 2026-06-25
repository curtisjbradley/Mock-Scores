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
}
