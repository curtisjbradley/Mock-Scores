export interface TournamentPayload {
    tournament: {
        name: string
        location: string
        startDate: string | null
        endDate: string | null
        startTbd: boolean
        endTbd: boolean
    }
    caseFormat: {
        caseName: string
        criminalCase: boolean
        pWitnessesCalled: number | null
        dWitnessesCalled: number | null
        hasSwing: boolean
        pWitnessNames: string[]
        dWitnessNames: string[]
        swingWitnessNames: string[]
    }
    scoringCategories: {
        name: string
        witnessCategory: boolean
        position: number
        fields: {
            label: string
            min: number
            max: number
            multiplier: number
            assignable: boolean
            eligibleForAward: boolean
            visibleToScorers: boolean
            prosecution: boolean
            defense: boolean
            calling: boolean
            crossing: boolean
            position: number
        }[]
    }[]
    standingsConfigId: string | null
}

export interface IPairingCreationPayload {
    prosectionID: string,
    defenseID: string,
    courtroomID: string
}

export interface IStandingsConfig {
    id: string
    statsXml: string
    standingsXml: string
}

export interface IStandingsTemplate {
    id: string
    label: string
    description: string
    config_id: string
}

export interface ScorecardPayload {
    pairingID: string
    scores: ScoreSection[]
    nominations: {
        studentId: string
        rank: number
    }[]
    tiebreaker?: string
}

export interface ScoreSection {
    categoryId: string
    assignmentKey: string
    side: 'P' | 'D'
    studentId: string | null
    score: number
}

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

export interface IScorer {
    scorer_id: string;
    first_name: string
    last_name: string
    email: string;
}

export interface IPairingScorer {
    assignment_id: string;
    type: 'registered' | 'paper';
    scorer_id: string;
    name: string;
    is_presider: boolean;
}

export interface IScoringFieldFull {
    id: string;
    label: string;
    min: number;
    max: number;
    multiplier: number;
    assignable: boolean;
    eligibleForAward: boolean;
    visibleToScorers: boolean;
    prosecution: boolean;
    defense: boolean;
    calling: boolean;
    crossing: boolean;
}

export interface IScoringCategory {
    id: string;
    name: string;
    witnessCategory: boolean;
    position: number;
    fields: IScoringFieldFull[];
}

export interface ITournament {
    id: string;
    name: string;
    location: string;
    start_date: Date | null;
    end_date: Date | null;
    created_at: Date;
    case_format_id: string;
    num_teams: number;
    num_rounds: number;
}

export interface ITournamentDetails {
    case_name: string;
    criminal_case: boolean;
    p_witnesses_called: number;
    d_witnesses_called: number;
}
export interface IWitnesses {
    pWitnessNames: string[];
    dWitnessNames: string[];
    swingWitnessNames: string[];
}


export interface IOrganizer {
    id : string;
    name: string;
    email: string;
    role: 'owner' | 'delegate';
    has_joined: boolean;
}

export interface ICourtroom{
    id : string,
    name: string;
    location: string;
}

export interface ITeam {
    id: string;
    tournament_id: string;
    name: string;
    code: string;
    coach_email: string;
    has_joined: boolean;
}

export interface IConflict {
    id: string;
    scorer_id: string;
    team_id: string;
    team_name: string;
}

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
    p_team_name: string;
    p_team_code: string;
    d_team_name: string;
    d_team_code: string;
    courtroom_name: string | null;
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
    student_id: string;
    student_name: string;
}

export interface ICompetitionTeam {
    id: string;
    name: string;
    code: string;
}

export interface IStandingsBallot {
    pointsFor: number;
    pointsAgainst: number;
}

export interface IStandingsPairing {
    opponent: string; // team code
    ballots: IStandingsBallot[];
    won_presider_tiebreaker: boolean;
}

export interface IStandingsTeam {
    name: string;
    code: string;
    pairings: IStandingsPairing[];
}
