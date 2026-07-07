import { jwtVerify, SignJWT } from 'jose';
import { NextFunction, Request, Response } from 'express';
import { randomBytes, createHash } from 'crypto';
import { dbQuery } from './db';

// ── Secrets & config ──────────────────────────────────────────────────────────

/**
 * Secret for short-lived access tokens (Bearer header).
 * Set JWT_SECRET in your environment.
 */
const ACCESS_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET ?? 'JWT_SECRET',
);

/**
 * Separate secret for long-lived refresh tokens (HttpOnly cookie).
 * Using a distinct secret means a compromised access-token secret cannot be
 * used to forge refresh tokens, and vice versa.
 * Set REFRESH_TOKEN_SECRET in your environment.
 */
const REFRESH_SECRET = new TextEncoder().encode(
    process.env.REFRESH_TOKEN_SECRET ?? 'REFRESH_SECRET',
);

/** Access token lifetime — 15 minutes. */
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY ?? "5m";

/** Refresh token lifetime — 7 days. */
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY ?? '7d';

/** Refresh token TTL as milliseconds (used for cookie Max-Age and DB expiry). */
const default_refresh_ms = 7 * 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = parseInt(process.env.REFRESH_TOKEN_TTL_MS ?? default_refresh_ms.toString()) ?? default_refresh_ms;

export const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Payload types ─────────────────────────────────────────────────────────────

export interface ISessionPayload {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
}

// ── Access token ──────────────────────────────────────────────────────────────

/**
 * Signs a short-lived (15 min) access token.
 *
 * Returned in the JSON body of login/refresh responses and stored only in
 * JavaScript memory on the frontend — never in localStorage or a cookie.
 */
export async function signToken(
    userId: string,
    email: string,
    firstName: string,
    lastName: string,
): Promise<string> {
    return new SignJWT({ userId, email, firstName, lastName })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(ACCESS_TOKEN_EXPIRY)
        .sign(ACCESS_SECRET);
}

/**
 * Verifies an access token and returns its payload, or null when
 * invalid or expired.
 */
export async function verifyToken(token: string): Promise<ISessionPayload | null> {
    try {
        const { payload } = await jwtVerify(token, ACCESS_SECRET);
        return {
            userId:    payload.userId    as string,
            email:     payload.email     as string,
            firstName: payload.firstName as string,
            lastName:  payload.lastName  as string,
        };
    } catch {
        return null;
    }
}

// ── Refresh token ─────────────────────────────────────────────────────────────
//
// The refresh token is a signed JWT (HS256, separate secret) containing:
//   - `sub`  — the user ID
//   - `jti`  — a unique random ID used as the revocation key in the DB
//
// Verification is two-step:
//   1. Cryptographic: jose verifies the signature and expiry locally —
//      no DB round-trip needed to prove the token is genuine.
//   2. Revocation: the SHA-256 hash of `jti` is looked up in `refresh_tokens`.
//      If the row is missing the token has been rotated or revoked.
//
// Storing only the hash of `jti` (not the full token) means a DB dump cannot
// be used to forge sessions.

export interface IRefreshPayload {
    /** User ID (`sub` claim). */
    userId: string;
    /** Unique token ID used as the DB revocation key. */
    jti: string;
}

/**
 * Signs a long-lived (7 day) refresh token JWT.
 *
 * Returns both the signed token (for the HttpOnly cookie) and the `jti`
 * (for inserting into the DB as a hash).
 */
export async function signRefreshToken(userId: string): Promise<{ token: string; jti: string }> {
    const jti = randomBytes(32).toString('hex');
    const token = await new SignJWT({ userId })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(userId)
        .setJti(jti)
        .setIssuedAt()
        .setExpirationTime(REFRESH_TOKEN_EXPIRY)
        .sign(REFRESH_SECRET);
    return { token, jti };
}

/**
 * Cryptographically verifies a refresh token JWT.
 *
 * Returns the decoded payload when the signature and expiry are valid, or
 * null otherwise. Does NOT check the DB — callers must check revocation
 * separately via `hashJti`.
 */
export async function verifyRefreshToken(token: string): Promise<IRefreshPayload | null> {
    try {
        const { payload } = await jwtVerify(token, REFRESH_SECRET);
        const userId = (payload.sub ?? payload['userId']) as string | undefined;
        const jti    = payload.jti as string | undefined;
        if (!userId || !jti) return null;
        return { userId, jti };
    } catch {
        return null;
    }
}

/**
 * Returns the SHA-256 hex hash of a `jti` value.
 * This is what gets stored in and looked up from the `refresh_tokens` table.
 */
export function hashJti(jti: string): string {
    return createHash('sha256').update(jti).digest('hex');
}

/**
 * Returns the refresh token TTL in milliseconds.
 * Used to set both the DB `expires_at` and the cookie `Max-Age`.
 */
export function refreshTokenTtlMs(): number {
    return REFRESH_TOKEN_TTL_MS;
}

// ── Cookie helpers ────────────────────────────────────────────────────────────

/** Name of the HttpOnly refresh token cookie. */
export const REFRESH_COOKIE = 'rt';

/** Name of the readable CSRF token cookie (double-submit pattern). */
export const CSRF_COOKIE = 'csrf_token';

/**
 * Generates a cryptographically random CSRF token.
 */
export function generateCsrfToken(): string {
    return randomBytes(32).toString('hex');
}

/**
 * Options for the CSRF token cookie.
 * NOT httpOnly — JS must be able to read it to send it as a header.
 * Same path and sameSite settings as the refresh cookie so they travel together.
 */
export function csrfCookieOptions() {
    const isProd = process.env.NODE_ENV === 'production';
    return {
        httpOnly: false,
        secure:   isProd,
        sameSite: (isProd ? 'strict' : 'lax') as 'strict' | 'lax',
        path:     '/',
        maxAge:   Math.floor(REFRESH_TOKEN_TTL_MS / 1000),
    };
}

/**
 * Options for the refresh token cookie:
 * - `httpOnly`  — JS cannot read it (eliminates XSS-based token theft)
 * - `secure`    — only transmitted over HTTPS in production
 * - `sameSite`  — 'lax' in dev (avoids Vite proxy issues), 'strict' in prod
 * - `path`      — '/' so the browser sends it on all same-origin requests;
 *                 the cookie is still only useful at /api/auth/refresh, but
 *                 scoping to /api/auth caused Chrome to drop it in some
 *                 redirect flows with Vite's dev proxy.
 */
export function refreshCookieOptions() {
    const isProd = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure:   isProd,
        sameSite: (isProd ? 'strict' : 'lax') as 'strict' | 'lax',
        path:     '/',
        maxAge:   Math.floor(REFRESH_TOKEN_TTL_MS / 1000),
    };
}

// ── Express middleware ────────────────────────────────────────────────────────

export function bearerToken(req: Request): string | undefined {
    const auth = req.headers.authorization;
    return auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
}

/**
 * Verifies the Bearer access token and attaches the decoded session to
 * `req.session`. Returns 401 on any failure.
 */
export async function verifyUser(req: Request, res: Response, next: NextFunction) {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ message: 'Invalid or expired token' });

    const session = await verifyToken(token);
    if (!session?.userId || !session.email)
        return res.status(401).json({ message: 'Invalid or expired token' });

    req.session = session;
    next();
}

/**
 * Verifies the caller has at least delegate access to the requested tournament.
 */
export async function verifyTournamentAccess(req: Request, res: Response, next: NextFunction) {
    const { tournamentId } = req.params;
    const tournament = Array.isArray(tournamentId) ? tournamentId[0] : tournamentId;

    if (!tournament)          return res.status(404).json({ message: 'Invalid tournamentId specified' });
    if (!req.session)         return res.status(401).json({ message: 'Invalid or expired token' });
    if (!uuidRegex.test(tournament)) return res.status(400).json({ message: 'Tournament id is not a valid uuid' });

    const roles = await dbQuery<{ role: string }>(
        'SELECT role FROM tournament_owners WHERE tournament_id = $1 AND delegate_id = $2',
        [tournamentId, req.session.userId],
    );
    if (roles === null)       return res.status(500).json({ message: 'Unable to reach database' });
    if (roles.rowCount === 0) return res.status(403).json({ message: 'Not authorized' });

    req.tournament = tournament;
    next();
}

/**
 * Verifies the caller is the tournament owner (role = 'owner').
 */
export async function verifyTournamentOwner(req: Request, res: Response, next: NextFunction) {
    const { tournamentId } = req.params;
    const tournament = Array.isArray(tournamentId) ? tournamentId[0] : tournamentId;

    if (!req.session)                         return res.status(401).json({ message: 'Invalid or expired token' });
    if (!tournament || !uuidRegex.test(tournament)) return res.status(400).json({ message: 'Invalid tournament id' });

    const row = (await dbQuery<{ role: string }>(
        'SELECT role FROM tournament_owners WHERE tournament_id=$1 AND delegate_id=$2',
        [tournament, req.session.userId],
    ))?.rows[0];

    if (!row)                 return res.status(403).json({ message: 'Not authorized' });
    if (row.role !== 'owner') return res.status(403).json({ message: 'Only owners can perform this action' });

    req.tournament = tournament;
    next();
}
