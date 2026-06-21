import { RequestHandler, Response } from 'express';
import { AuthenticatedRequest, TournamentRequest, RoundRequest, ScorerRequest, OrganizerRequest, TeamRequest } from './express.d';

type Handler<R> = (req: R, res: Response) => Promise<Response>
const wrap = <R>(fn: Handler<R>): RequestHandler => fn as unknown as RequestHandler;

export const authedHandler     = (fn: Handler<AuthenticatedRequest>): RequestHandler => wrap(fn);
export const tournamentHandler = (fn: Handler<TournamentRequest>): RequestHandler => wrap(fn);
export const roundHandler      = (fn: Handler<RoundRequest>): RequestHandler => wrap(fn);
export const scorerHandler     = (fn: Handler<ScorerRequest>): RequestHandler => wrap(fn);
export const organizerHandler  = (fn: Handler<OrganizerRequest>): RequestHandler => wrap(fn);
export const teamHandler       = (fn: Handler<TeamRequest>): RequestHandler => wrap(fn);
