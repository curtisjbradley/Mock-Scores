export interface IOrganizer {
    id: string;
    name: string;
    email: string;
    role: 'owner' | 'delegate';
    has_joined: boolean;
}

export interface ICourtroom {
    id: string;
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
