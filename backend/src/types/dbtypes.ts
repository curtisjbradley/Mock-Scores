// Row interfaces for all database tables

export interface IAuthRow {
    user_id: string;
    password_hash: string;
    email: string;
    created_at: Date;
    first_name: string;
    last_name: string;
}

export interface ITournamentFormatRow {
    format_id: string;
    case_name: string;
    criminal_case: boolean;
    p_witnesses_called: number;
    d_witnesses_called: number;
    has_swing: boolean;
}

export interface ITournamentRow {
    id: string;
    name: string;
    location: string;
    start_date: Date | null;
    end_date: Date | null;
    created_at: Date;
    case_format_id: string;
    num_rounds: number;
    num_teams: number;
}

export interface ICaseWitnessRow {
    id: string;
    case_format: string;
    side: 'P' | 'D' | 'S';
    name: string;
}

export interface IScoringCategoryRow {
    id: string;
    tournament_id: string;
    name: string;
    witness_category: boolean;
    position: number;
}

export interface IScoringFieldRow {
    id: string;
    category_id: string;
    label: string;
    min_score: number;
    max_score: number;
    multiplier: number;
    assignable: boolean;
    eligible_for_award: boolean;
    visible_to_scorers: boolean;
    prosecution: boolean;
    defense: boolean;
    calling: boolean;
    crossing: boolean;
    position: number;
}

export interface ITournamentOwnerRow {
    id : string,
    tournament_id: string;
    delegate_id: string;
    role: 'owner' | 'delegate';
}

export interface ITournamentDelegateInviteRow {
    id: string;
    tournament_id: string;
    name: string;
    email: string;
}

export interface IScorerRow {
    scorer_id: string;
    tournament_id: string;
    first_name: string;
    last_name: string;
    email: string;
}

export interface ICourtroomRow {
    id: string;
    tournament_id: string;
    name: string;
    location: string | null;
}

export interface ITeamRow {
    id: string;
    tournament_id: string;
    name: string;
    code: string;
}

export interface ITeamInviteRow {
    id: string;
    team_id: string;
    invite_email: string;
    name: string;
    code: string;
}

export interface ITeamCoachRow {
    coach_id: string;
    team_id: string;
    is_owner: boolean;
}

export interface IRoundRow {
    round_id: string;
    tournament_id: string;
    results_public: boolean;
    teams_public: boolean;
    position: number;
    name: string;
    round_time: Date | null;
}

export interface IPairingRow {
    pairing_id: string;
    round_id: string;
    p_team: string;
    d_team: string;
    courtroom: string | null;
}

export interface IPaperScorerRow {
    scorer_id: string;
    pairing_id: string;
    name: string;
}

export interface IScorerPairingAssignmentRow {
    assignment_id: string;
    registered_scorer_id: string | null;
    paper_scorer_id: string | null;
    pairing_id: string;
}

export interface IScorerPresiderAssignmentRow {
    presider_assignment_id: string;
    scorer_assignment_id: string;
    pairing_id: string;
    show_scores: boolean;
}

export interface ITeamRosteredStudentRow {
    student_id: string;
    team_id: string;
    student_name: string;
}
