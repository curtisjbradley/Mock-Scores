export interface ICoachTournament {
    id: string;
    name: string;
    location: string;
    start_date: Date | null;
    end_date: Date | null;
    num_teams: number;
    num_rounds: number;
    team_id: string;
    team_name: string;
    team_code: string;
}

export interface ICoachSchedulePairing {
    pairing_id: string;
    p_team_id: string;
    p_team_name: string;
    p_team_code: string;
    d_team_id: string;
    d_team_name: string;
    d_team_code: string;
    courtroom_name: string | null;
    has_assignments: boolean;
    has_call_order: boolean;
}

export interface ICoachScheduleRound {
    round_id: string;
    name: string;
    round_time: string | null;
    pairings: ICoachSchedulePairing[];
}

export interface ICoachResultPairing {
    pairing_id: string;
    p_team_name: string;
    p_team_code: string;
    d_team_name: string;
    d_team_code: string;
    p_points: number;
    d_points: number;
}

export interface ICoachResultRound {
    round_id: string;
    name: string;
    round_time: string | null;
    pairings: ICoachResultPairing[];
}

export interface ICoach {
    coach_id: string;
    name: string;
    email: string;
    is_owner: boolean;
    has_joined: boolean;
}

export interface IStudent {
    student_id: string;
    team_id: string;
    student_name: string;
    pronouns: string | null;
}

export interface IWitnessCallOrder {
    id: string;
    pairing_id: string;
    team_id: string;
    witness_id: string;
    witness_name: string;
    position: number;
}

export interface IStudentAssignment {
    id: string;
    pairing_id: string;
    team_id: string;
    field_id: string;
    field_label: string;
    witness_id: string | null;
    student_id: string;
    student_name: string;
}

export interface ICompetitionTeam {
    id: string;
    name: string;
    code: string;
}
