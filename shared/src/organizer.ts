import type { EmailStatus } from './email.js'

export interface IOrganizer {
    id: string;
    name: string;
    email: string;
    role: 'owner' | 'delegate';
    has_joined: boolean;
    /** Delivery status of the most recent invite email to this organizer, if any. */
    email_status?: EmailStatus | null;
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
    /** Delivery status of the most recent invite email to this team's coach, if any. */
    email_status?: EmailStatus | null;
}
export interface ITournamentSummary {
    teams: {
        total: number;
        withRosters: number;
        withoutRosters: number;
        withDefaultAssignments: number;
        withoutDefaultAssignments: number;
        withDefaultCallOrders: number;
        withoutDefaultCallOrders: number;
        withCoaches: number;
        withoutCoaches: number;
    };

    rounds: {
        total: number;
        withPairings: number;
        withoutPairings: number;
    };

    pairings: {
        total: number;
        withScorers: number;
        withoutScorers: number;
        withPresiders: number;
        withoutPresiders: number;
        withCourtrooms: number;
        withoutCourtrooms: number;
        courtroomsDoubleBooked: number;
        pairingsInDoubleBookedCourtrooms: number;
    };

    ballots: {
        submitted: number;
        paperAwaitingInput: number;
    };

    scorers: {
        total: number;
        withConflicts: number;
    };
}