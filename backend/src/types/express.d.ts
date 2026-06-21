import 'express';
import { Request } from 'express';
import { ISessionPayload } from '../authUtils';
import { IOrganizer, IRound, IScorer, ITeam } from '@mock-scores/shared';

declare module 'express' {
    interface Request {
        session?: ISessionPayload
        tournament?: string
        scorer?: IScorer
        round?: IRound
        selectedOrganizer?: IOrganizer
        selectedTeam?: ITeam
    }
}

export interface AuthenticatedRequest extends Request {
    session: ISessionPayload
}

export interface TournamentRequest extends AuthenticatedRequest {
    tournament: string
}

export interface RoundRequest extends TournamentRequest {
    round: IRound
}

export interface ScorerRequest extends TournamentRequest {
    scorer: IScorer
}

export interface OrganizerRequest extends TournamentRequest {
    selectedOrganizer: IOrganizer
}

export interface TeamRequest extends TournamentRequest {
    selectedTeam: ITeam
}
