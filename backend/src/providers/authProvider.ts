import { dbQuery } from '../db';
import bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import {
    signToken,
    signRefreshToken,
    verifyRefreshToken,
    hashJti,
    refreshTokenTtlMs,
} from '../authUtils';
import type { IAuthRow } from '../types/dbtypes';
import { AlreadyExistsError, DbError, NotFoundError } from '../errors';
import { sendEmail, welcomeEmail } from '../email';

interface IStatusResponse { status: number; message: string; }

/** Tokens returned from a successful login or Google auth. */
export interface IAuthTokens {
    /** Short-lived JWT (15 min). Return in response body; store in JS memory only. */
    accessToken: string;
    /** Long-lived opaque token. Caller is responsible for setting the HttpOnly cookie. */
    refreshToken: string;
}

export class AuthProvider {
    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Redeems any pending tournament-delegate or team invites for a newly
     * registered user.
     */
    private async redeemInvites(email: string, userId: string): Promise<void> {
        const tournamentInvites = await dbQuery<{ tournament_id: string }>(
            'DELETE FROM tournament_delegate_invites WHERE email = $1 RETURNING tournament_id',
            [email],
        );
        if (!tournamentInvites) throw new DbError('redeemInvites tournament');
        tournamentInvites.rows.forEach(row =>
            dbQuery(
                'INSERT INTO tournament_owners (tournament_id, delegate_id, role) VALUES ($1, $2, $3)',
                [row.tournament_id, userId, 'delegate'],
            ),
        );

        const teamInvites = await dbQuery<{ team_id: string }>(
            'DELETE FROM team_invites WHERE invite_email = $1 RETURNING team_id',
            [email],
        );
        if (!teamInvites) throw new DbError('redeemInvites team');
        teamInvites.rows.forEach(row =>
            dbQuery(
                'INSERT INTO team_coaches (team_id, coach_id, is_owner) VALUES ($1, $2, $3)',
                [row.team_id, userId, 'delegate'],
            ),
        );
    }

    /**
     * Issues a new refresh token JWT, stores its `jti` hash in the DB, and
     * returns the raw signed token for the HttpOnly cookie.
     *
     * Only the SHA-256 hash of the `jti` is persisted — a DB dump alone
     * cannot be used to forge sessions.
     */
    private async issueRefreshToken(userId: string): Promise<string> {
        const { token, jti } = await signRefreshToken(userId);
        const jtiHash = hashJti(jti);
        const expiresAt = new Date(Date.now() + refreshTokenTtlMs());
        const result = await dbQuery(
            'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
            [userId, jtiHash, expiresAt.toISOString()],
        );
        if (result === null) throw new DbError('issueRefreshToken');
        return token;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Registers a new user account. Returns a 201 status response on success.
     * Throws `AlreadyExistsError` when the email is already registered.
     */
    async registerUser(
        email: string,
        password: string,
        firstName: string,
        lastName: string,
    ): Promise<IStatusResponse> {
        const existing = await dbQuery('SELECT user_id FROM auth WHERE email = $1', [email]);
        if (existing === null) throw new DbError('registerUser lookup');
        if (existing.rows.length > 0) throw new AlreadyExistsError('email');

        const passwordHash = await bcrypt.hash(password, 10);
        const result = (await dbQuery<{ user_id: string }>(
            'INSERT INTO auth (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING user_id',
            [email, passwordHash, firstName, lastName],
        ))?.rows[0];
        if (!result) throw new DbError('registerUser insert');

        await this.redeemInvites(email, result.user_id);
        return { status: 201, message: 'User Created' };
    }

    /**
     * Authenticates with email + password and returns an access/refresh token pair.
     * Returns an error status response for invalid credentials.
     */
    async loginUser(
        email: string,
        password: string,
    ): Promise<IStatusResponse | IAuthTokens> {
        const result = await dbQuery<IAuthRow>(
            'SELECT user_id, email, password_hash, first_name, last_name FROM auth WHERE email = $1',
            [email],
        );
        if (result === null) throw new DbError('loginUser');
        const user = result.rows[0];
        if (!user || !(await bcrypt.compare(password, user.password_hash)))
            return { status: 401, message: 'Invalid Username / Password' };

        const [accessToken, refreshToken] = await Promise.all([
            signToken(user.user_id, user.email, user.first_name, user.last_name),
            this.issueRefreshToken(user.user_id),
        ]);
        return { accessToken, refreshToken };
    }

    /**
     * Finds or creates a Google OAuth account and returns an access/refresh token pair.
     */
    async googleAuth(
        email: string,
        firstName: string,
        lastName: string,
    ): Promise<IAuthTokens> {
        const result = await dbQuery<IAuthRow>(
            'SELECT user_id, email, first_name, last_name FROM auth WHERE email = $1',
            [email],
        );
        if (result === null) throw new DbError('googleAuth lookup');

        let user = result.rows[0];

        if (!user) {
            const inserted = await dbQuery<IAuthRow>(
                `INSERT INTO auth (email, first_name, last_name)
                 VALUES ($1, $2, $3)
                 RETURNING user_id, email, first_name, last_name`,
                [email, firstName, lastName],
            );
            if (!inserted?.rows[0]) throw new DbError('googleAuth insert');
            user = inserted.rows[0];

            Promise.resolve()
                .then(() => {
                    const template = welcomeEmail(firstName);
                    sendEmail(email, template.subject, template.html, template.text);
                })
                .catch((err: Error) => console.error(err));

            await this.redeemInvites(email, user.user_id);
        }

        const [accessToken, refreshToken] = await Promise.all([
            signToken(user.user_id, user.email, user.first_name, user.last_name),
            this.issueRefreshToken(user.user_id),
        ]);
        return { accessToken, refreshToken };
    }

    /**
     * Validates a refresh token JWT cookie, rotates it (delete old, insert new),
     * and returns a fresh access/refresh token pair.
     *
     * Two-step verification:
     *   1. Cryptographic — `verifyRefreshToken` checks the JWT signature and
     *      expiry using `REFRESH_SECRET`. No DB round-trip needed for this step.
     *   2. Revocation — the SHA-256 hash of the token's `jti` is looked up in
     *      the DB. If the row is missing the token has already been rotated or
     *      explicitly revoked.
     *
     * Returns null when the token is missing, forged, expired, or revoked.
     * Single-use rotation limits the blast radius of a stolen refresh token.
     */
    async refreshSession(rawToken: string): Promise<IAuthTokens | null> {
        // Step 1: verify JWT signature and expiry — cheap, no DB needed
        const payload = await verifyRefreshToken(rawToken);
        if (!payload) return null;

        const jtiHash = hashJti(payload.jti);

        // Step 2: check revocation via jti hash
        const row = (await dbQuery<{
            user_id: string; email: string; first_name: string; last_name: string; expires_at: string;
        }>(
            `SELECT rt.user_id, rt.expires_at, a.email, a.first_name, a.last_name
             FROM refresh_tokens rt
             JOIN auth a ON a.user_id = rt.user_id
             WHERE rt.token_hash = $1`,
            [jtiHash],
        ))?.rows[0];

        if (!row) return null; // rotated or revoked

        // Belt-and-suspenders: also check DB expiry (covers clock-skew edge cases)
        if (new Date(row.expires_at) < new Date()) {
            await dbQuery('DELETE FROM refresh_tokens WHERE token_hash = $1', [jtiHash]);
            return null;
        }

        // Rotate: delete used token and issue a new one
        await dbQuery('DELETE FROM refresh_tokens WHERE token_hash = $1', [jtiHash]);

        const [accessToken, refreshToken] = await Promise.all([
            signToken(row.user_id, row.email, row.first_name, row.last_name),
            this.issueRefreshToken(row.user_id),
        ]);
        return { accessToken, refreshToken };
    }

    /**
     * Revokes a specific refresh token by verifying its JWT and deleting the
     * `jti` hash from the DB. Called on logout.
     * A missing, forged, or already-expired token is silently ignored.
     */
    async revokeRefreshToken(rawToken: string): Promise<void> {
        const payload = await verifyRefreshToken(rawToken);
        if (!payload) return; // already expired or forged — nothing to revoke
        const jtiHash = hashJti(payload.jti);
        await dbQuery('DELETE FROM refresh_tokens WHERE token_hash = $1', [jtiHash]);
    }

    /**
     * Revokes ALL refresh tokens for a user. Use when the user changes their
     * password or requests a full sign-out from all devices.
     */
    async revokeAllRefreshTokens(userId: string): Promise<void> {
        await dbQuery('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
    }

    /**
     * Creates a password reset token for the given email. If the email doesn't
     * exist, returns silently (no information leakage). The token is hashed
     * before storage. Replaces any existing reset token for the user.
     */
    async createPasswordResetToken(email: string): Promise<{
        token: string; firstName: string; email: string;
    } | null> {
        const user = (await dbQuery<IAuthRow>(
            'SELECT user_id, first_name, email FROM auth WHERE LOWER(email) = LOWER($1)',
            [email],
        ))?.rows[0];
        if (!user) return null; // silent — don't reveal whether email exists

        // Google-only users (no password_hash) can still reset to set a password
        const token = randomBytes(32).toString('hex');
        const tokenHash = createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // UPSERT: only one active token per user (UNIQUE on user_id)
        const result = await dbQuery(
            `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at, created_at = now()`,
            [user.user_id, tokenHash, expiresAt.toISOString()],
        );
        if (!result) throw new DbError('createPasswordResetToken');

        return { token, firstName: user.first_name, email: user.email };
    }

    /**
     * Validates a password reset token and sets the new password.
     * Revokes all refresh tokens for the user (forced re-login everywhere).
     * Deletes the reset token after use.
     */
    async resetPassword(token: string, newPassword: string): Promise<IStatusResponse> {
        const tokenHash = createHash('sha256').update(token).digest('hex');
        const row = (await dbQuery<{ user_id: string; expires_at: string }>(
            'SELECT user_id, expires_at FROM password_reset_tokens WHERE token_hash = $1',
            [tokenHash],
        ))?.rows[0];

        if (!row) return { status: 400, message: 'Invalid or expired reset link' };
        if (new Date(row.expires_at) < new Date()) {
            await dbQuery('DELETE FROM password_reset_tokens WHERE token_hash = $1', [tokenHash]);
            return { status: 400, message: 'Reset link has expired' };
        }

        const hash = await bcrypt.hash(newPassword, 10);
        const updated = await dbQuery('UPDATE auth SET password_hash = $1 WHERE user_id = $2', [hash, row.user_id]);
        if (!updated) throw new DbError('resetPassword update');

        // Clean up: delete the used token and revoke all sessions
        await dbQuery('DELETE FROM password_reset_tokens WHERE user_id = $1', [row.user_id]);
        await this.revokeAllRefreshTokens(row.user_id);

        return { status: 200, message: 'Password has been reset' };
    }

    /** Changes a user's password and revokes all existing refresh tokens. */
    async changePassword(
        userId: string,
        currentPassword: string,
        newPassword: string,
    ): Promise<IStatusResponse> {
        const result = await dbQuery<IAuthRow>('SELECT password_hash FROM auth WHERE user_id=$1', [userId]);
        if (!result) throw new DbError('changePassword lookup');
        const user = result.rows[0];
        if (!user || !user.password_hash || !(await bcrypt.compare(currentPassword, user.password_hash)))
            return { status: 401, message: 'Current password is incorrect' };

        const hash = await bcrypt.hash(newPassword, 10);
        const updated = await dbQuery('UPDATE auth SET password_hash=$1 WHERE user_id=$2', [hash, userId]);
        if (!updated) throw new DbError('changePassword update');

        // Invalidate all sessions on password change
        await this.revokeAllRefreshTokens(userId);
        return { status: 200, message: 'Password updated' };
    }

    /**
     * Permanently deletes a user account and all associated data.
     * CASCADE constraints handle refresh_tokens, password_reset_tokens,
     * tournament_owners, and team_coaches.
     */
    async deleteAccount(userId: string): Promise<void> {
        const result = await dbQuery('DELETE FROM auth WHERE user_id = $1', [userId]);
        if (!result) throw new DbError('deleteAccount');
        if (result.rowCount === 0) throw new NotFoundError('Account not found');
    }

    /**
     * Creates an email verification token for the given user. Stores a SHA-256
     * hash; returns the raw token so the caller can build the verification URL.
     * The token expires in 24 hours. Previous tokens for the same user are
     * deleted to keep the table clean.
     */
    async createEmailVerificationToken(userId: string): Promise<string> {
        // Remove any existing tokens for this user
        await dbQuery('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);

        const token = randomBytes(32).toString('hex');
        const tokenHash = createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        const result = await dbQuery(
            'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
            [userId, tokenHash, expiresAt.toISOString()],
        );
        if (!result) throw new DbError('createEmailVerificationToken');

        return token;
    }

    /**
     * Creates an email verification token for the user identified by email.
     * Convenience wrapper that resolves user_id from email first.
     * Returns the raw token and user info, or null if the email doesn't exist.
     */
    async createEmailVerificationTokenByEmail(email: string): Promise<{
        token: string; userId: string; firstName: string;
    } | null> {
        const user = (await dbQuery<{ user_id: string; first_name: string; email_verified: boolean }>(
            'SELECT user_id, first_name, email_verified FROM auth WHERE LOWER(email) = LOWER($1)',
            [email],
        ))?.rows[0];
        if (!user) return null;
        if (user.email_verified) return null; // already verified

        const token = await this.createEmailVerificationToken(user.user_id);
        return { token, userId: user.user_id, firstName: user.first_name };
    }

    /**
     * Validates an email verification token, marks the user as verified, and
     * deletes the token. Returns a status/message response.
     */
    async verifyEmail(token: string): Promise<IStatusResponse> {
        const tokenHash = createHash('sha256').update(token).digest('hex');
        const row = (await dbQuery<{ user_id: string; expires_at: string }>(
            'SELECT user_id, expires_at FROM email_verification_tokens WHERE token_hash = $1',
            [tokenHash],
        ))?.rows[0];

        if (!row) return { status: 400, message: 'Invalid or expired verification link' };
        if (new Date(row.expires_at) < new Date()) {
            await dbQuery('DELETE FROM email_verification_tokens WHERE token_hash = $1', [tokenHash]);
            return { status: 400, message: 'Verification link has expired' };
        }

        const updated = await dbQuery(
            'UPDATE auth SET email_verified = true WHERE user_id = $1',
            [row.user_id],
        );
        if (!updated) throw new DbError('verifyEmail update');

        // Clean up the used token
        await dbQuery('DELETE FROM email_verification_tokens WHERE user_id = $1', [row.user_id]);

        return { status: 200, message: 'Email verified successfully' };
    }
}
