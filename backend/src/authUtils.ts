import { jwtVerify, SignJWT } from 'jose';
import {NextFunction, Request, Response} from 'express';
import db from "./db";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'JWT_SECRET');
const JWT_EXPIRY = process.env.JWT_EXPIRY ?? '7d';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ISessionPayload {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
}

export async function signToken(userId: string, email: string, firstName: string, lastName: string): Promise<string> {
    return new SignJWT({ userId, email, firstName, lastName })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(JWT_EXPIRY)
        .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<ISessionPayload | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return {
            userId: payload.userId as string,
            email: payload.email as string,
            firstName: payload.firstName as string,
            lastName: payload.lastName as string,
        };
    } catch {
        return null;
    }
}

export function bearerToken(req: Request): string | undefined {
    const auth = req.headers.authorization;
    return auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
}


export async function verifyUser (req: Request, res: Response, next: NextFunction) {
    if(req == null){
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
    const token = bearerToken(req);

    if (token == null){
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
    const session =  await verifyToken(token);

    if (session == null || session.userId == null || session.email == null){
        return res.status(401).json({ message: 'Invalid or expired token' });
    }

    req.session = session;

    next()
}


export async function verifyTournamentAccess(req: Request, res: Response, next: NextFunction) {
    const {tournamentId} = req.params
    const tournament = Array.isArray(tournamentId) ? tournamentId[0] : tournamentId;

    if(!tournament){
        return res.status(404).json({ message: 'Invalid tournamentId specified' });
    }
    if(!req.session){
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
    if(!uuidRegex.test(tournament)) {
        return res.status(400).json({ message: 'Tournament id is not a valid uuid' });
    }

    const roles : string[]= (await db.query("select role from tournament_owners where tournament = $1 and delegate_email = $2", [tournamentId,req.session.email])).rows.map(role => role.role)
    if(roles.length == 0){
        return res.status(403).json({ message: 'Not authorized' });
    }

    req.tournament = tournament
    next()
}