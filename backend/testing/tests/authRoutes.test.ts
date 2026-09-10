jest.mock('../../src/email', () => jest.requireActual('../mocks/email'));

// Mock verifyRefreshToken so /refresh tests don't require real signed JWTs.
// The default mock returns a valid payload; individual tests override it
// via mockResolvedValueOnce to test the null/rejection path.
jest.mock('../../src/authUtils', () => ({
    ...jest.requireActual('../../src/authUtils'),
    verifyRefreshToken: jest.fn().mockResolvedValue({ userId: 'u1', jti: 'mock-jti' }),
    hashJti: jest.fn().mockReturnValue('hashed-jti'),
}));

import request from 'supertest';
import testApp from '../../src/appService';
import { dbQuery } from '../../src/db';
import bcrypt from 'bcrypt';
import { signToken, verifyRefreshToken } from '../../src/authUtils';
import { AuthProvider } from '../../src/providers/authProvider';
import { DbError } from '../../src/errors';
import { OAuth2Client } from 'google-auth-library';

jest.mock('bcrypt');

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;
const mockBcryptHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;
const mockBcryptCompare = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>;
const mockVerifyRefreshToken = verifyRefreshToken as jest.MockedFunction<typeof verifyRefreshToken>;

beforeEach(() => jest.clearAllMocks());

// Re-apply the default after clearAllMocks resets it
beforeEach(() => {
    mockVerifyRefreshToken.mockResolvedValue({ userId: 'u1', jti: 'mock-jti' });
});

// Token for session/change-password tests — regenerated before each test
// to prevent expiry on slow machines (ACCESS_TOKEN_EXPIRY is 5 min).
let sharedToken: string;
beforeEach(async () => {
    sharedToken = await signToken('user-1', 'test@test.com', 'Test', 'User');
});
const validToken = () => sharedToken;

// ─── POST /api/auth/register ──────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
    it('returns 400 when email is missing', async () => {
        const res = await request(testApp).post('/auth/register').send({ password: 'pass', firstName: 'A', lastName: 'B' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/email and password/i);
    });

    it('returns 400 when password is missing', async () => {
        const res = await request(testApp).post('/auth/register').send({ email: 'a@b.com', firstName: 'A', lastName: 'B' });
        expect(res.status).toBe(400);
    });

    it('returns 400 when firstName is missing', async () => {
        const res = await request(testApp).post('/auth/register').send({ email: 'a@b.com', password: 'pass', lastName: 'B' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/first and last name/i);
    });

    it('returns 400 when lastName is blank', async () => {
        const res = await request(testApp).post('/auth/register').send({ email: 'a@b.com', password: 'pass', firstName: 'A', lastName: '   ' });
        expect(res.status).toBe(400);
    });

    it('returns 409 when email already in use', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ user_id: 'existing' }], rowCount: 1 } as any);
        const res = await request(testApp).post('/auth/register').send({ email: 'a@b.com', password: 'Password1', firstName: 'A', lastName: 'B' });
        expect(res.status).toBe(409);
    });

    it('returns 201 on successful registration', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [{ user_id: 'u1' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        (mockBcryptHash as jest.Mock).mockResolvedValueOnce('hashed');

        const res = await request(testApp).post('/auth/register').send({ email: 'new@b.com', password: 'Password1', firstName: 'New', lastName: 'User' });
        expect(res.status).toBe(201);
    });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
    it('returns 400 when email is missing', async () => {
        const res = await request(testApp).post('/auth/login').send({ password: 'pass' });
        expect(res.status).toBe(400);
    });

    it('returns 400 when password is missing', async () => {
        const res = await request(testApp).post('/auth/login').send({ email: 'a@b.com' });
        expect(res.status).toBe(400);
    });

    it('returns 401 for invalid credentials', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(testApp).post('/auth/login').send({ email: 'a@b.com', password: 'wrong' });
        expect(res.status).toBe(401);
    });

    it('returns 200 with accessToken and sets rt cookie on successful login', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ user_id: 'u1', email: 'a@b.com', password_hash: 'hash', first_name: 'Alice', last_name: 'Smith' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // INSERT refresh_token
        (mockBcryptCompare as jest.Mock).mockResolvedValueOnce(true);

        const res = await request(testApp).post('/auth/login').send({ email: 'a@b.com', password: 'Password1' });
        expect(res.status).toBe(200);
        expect(typeof res.body.accessToken).toBe('string');
        const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
        expect(cookies?.some(c => c.startsWith('rt='))).toBe(true);
        expect(cookies?.some(c => c.includes('HttpOnly'))).toBe(true);
    });
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
describe('POST /api/auth/refresh', () => {
    it('returns 401 when no refresh cookie is present', async () => {
        const res = await request(testApp).post('/auth/refresh');
        expect(res.status).toBe(401);
    });

    it('returns 401 when verifyRefreshToken rejects the JWT', async () => {
        // Simulate a forged or expired token — crypto verification fails
        mockVerifyRefreshToken.mockResolvedValueOnce(null);
        const res = await request(testApp).post('/auth/refresh')
            .set('Cookie', 'rt=forged-or-expired-token');
        expect(res.status).toBe(401);
    });

    it('returns 401 when jti hash is not found in DB (rotated/revoked)', async () => {
        // JWT is valid but the jti was already rotated out of the DB
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(testApp).post('/auth/refresh')
            .set('Cookie', 'rt=valid-but-revoked-token');
        expect(res.status).toBe(401);
    });

    it('returns 200 with new accessToken and rotated rt cookie on valid refresh', async () => {
        const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ user_id: 'u1', email: 'a@b.com', first_name: 'Alice', last_name: 'Smith', expires_at: future }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)  // DELETE old token
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // INSERT new token

        const res = await request(testApp).post('/auth/refresh')
            .set('Cookie', 'rt=valid-refresh-token');
        expect(res.status).toBe(200);
        expect(typeof res.body.accessToken).toBe('string');
        const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
        expect(cookies?.some(c => c.startsWith('rt='))).toBe(true);
    });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
describe('POST /api/auth/logout', () => {
    it('returns 204 and clears the rt cookie', async () => {
        // verifyRefreshToken succeeds → revokeRefreshToken deletes by jti hash
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const res = await request(testApp).post('/auth/logout')
            .set('Cookie', 'rt=sometoken');
        expect(res.status).toBe(204);
        const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
        expect(cookies?.some(c => c.startsWith('rt=;') || c.includes('Expires=Thu, 01 Jan 1970'))).toBe(true);
    });

    it('returns 204 even when no cookie is present', async () => {
        const res = await request(testApp).post('/auth/logout');
        expect(res.status).toBe(204);
    });

    it('returns 204 when verifyRefreshToken rejects (expired cookie)', async () => {
        mockVerifyRefreshToken.mockResolvedValueOnce(null);
        const res = await request(testApp).post('/auth/logout')
            .set('Cookie', 'rt=expired-token');
        expect(res.status).toBe(204);
    });
});

// ─── GET /api/auth/session ────────────────────────────────────────────────────
describe('GET /api/auth/session', () => {
    it('returns 401 with no token', async () => {
        const res = await request(testApp).get('/auth/session');
        expect(res.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
        const res = await request(testApp).get('/auth/session').set('Authorization', 'Bearer bad.token.here');
        expect(res.status).toBe(401);
    });

    it('returns 200 with session data for valid token', async () => {
        const token = validToken();
        const res = await request(testApp).get('/auth/session').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ userId: 'user-1', email: 'test@test.com', firstName: 'Test', lastName: 'User' });
    });
});

// ─── POST /api/auth/change-password ──────────────────────────────────────────
describe('POST /api/auth/change-password', () => {
    it('returns 401 with no token', async () => {
        const res = await request(testApp).post('/auth/change-password').send({ currentPassword: 'old', newPassword: 'newpass123' });
        expect(res.status).toBe(401);
    });

    it('returns 400 when fields are missing', async () => {
        const token = validToken();
        const res = await request(testApp).post('/auth/change-password').set('Authorization', `Bearer ${token}`).send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/missing required fields/i);
    });

    it('returns 400 when new password is too short', async () => {
        const token = validToken();
        const res = await request(testApp).post('/auth/change-password').set('Authorization', `Bearer ${token}`).send({ currentPassword: 'old', newPassword: 'short' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/at least 8 characters/i);
    });

    it('returns 401 when current password is wrong', async () => {
        const token = validToken();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ password_hash: 'hash' }], rowCount: 1 } as any);
        (mockBcryptCompare as jest.Mock).mockResolvedValueOnce(false);

        const res = await request(testApp).post('/auth/change-password').set('Authorization', `Bearer ${token}`).send({ currentPassword: 'wrong', newPassword: 'Newpass123' });
        expect(res.status).toBe(401);
    });

    it('returns 200 on successful password change and clears rt cookie', async () => {
        const token = validToken();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ password_hash: 'oldhash' }], rowCount: 1 } as any) // SELECT password
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)                              // UPDATE password
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);                             // DELETE all refresh tokens
        (mockBcryptCompare as jest.Mock).mockResolvedValueOnce(true);
        (mockBcryptHash as jest.Mock).mockResolvedValueOnce('newhash');

        const res = await request(testApp).post('/auth/change-password').set('Authorization', `Bearer ${token}`).send({ currentPassword: 'oldpass', newPassword: 'Newpass123' });
        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/password updated/i);
    });
});

// ─── DELETE /api/auth/account ─────────────────────────────────────────────────
describe('DELETE /api/auth/account', () => {
    it('returns 401 with no token', async () => {
        const res = await request(testApp).delete('/auth/account');
        expect(res.status).toBe(401);
    });

    it('returns 204 on successful account deletion', async () => {
        const token = validToken();
        // deleteAccount: DELETE FROM auth
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

        const res = await request(testApp).delete('/auth/account').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(204);
    });

    it('returns 404 when account not found', async () => {
        const token = validToken();
        // deleteAccount: no rows deleted
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

        const res = await request(testApp).delete('/auth/account').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    it('returns 500 on db error', async () => {
        const token = validToken();
        // deleteAccount: null result
        mockDbQuery.mockResolvedValueOnce(null as any);

        const res = await request(testApp).delete('/auth/account').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(500);
    });
});

// ─── POST /api/auth/forgot-password ───────────────────────────────────────────
describe('POST /api/auth/forgot-password', () => {
    it('returns 400 when email is missing', async () => {
        const res = await request(testApp).post('/auth/forgot-password').send({});
        expect(res.status).toBe(400);
    });

    it('returns 400 for invalid email format', async () => {
        const res = await request(testApp).post('/auth/forgot-password').send({ email: 'not-an-email' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid email/i);
    });

    it('returns 200 when email exists (sends reset email)', async () => {
        // createPasswordResetToken: SELECT user
        mockDbQuery.mockResolvedValueOnce({ rows: [{ user_id: 'u1', first_name: 'Test', email: 'test@test.com' }], rowCount: 1 } as any);
        // createPasswordResetToken: INSERT token
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

        const res = await request(testApp).post('/auth/forgot-password').send({ email: 'test@test.com' });
        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/reset link/i);
    });

    it('returns 200 when email does not exist (no leakage)', async () => {
        // createPasswordResetToken: SELECT user returns empty
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

        const res = await request(testApp).post('/auth/forgot-password').send({ email: 'unknown@test.com' });
        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/reset link/i);
    });
});

// ─── POST /api/auth/reset-password ────────────────────────────────────────────
describe('POST /api/auth/reset-password', () => {
    it('returns 400 when token is missing', async () => {
        const res = await request(testApp).post('/auth/reset-password').send({ newPassword: 'Newpass123' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/token.*password/i);
    });

    it('returns 400 when newPassword is missing', async () => {
        const res = await request(testApp).post('/auth/reset-password').send({ token: 'abc123' });
        expect(res.status).toBe(400);
    });

    it('returns 400 when new password fails validation', async () => {
        const res = await request(testApp).post('/auth/reset-password').send({ token: 'abc123', newPassword: 'short' });
        expect(res.status).toBe(400);
    });

    it('returns 400 for invalid/expired token', async () => {
        // resetPassword: SELECT token_hash returns empty
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

        const res = await request(testApp).post('/auth/reset-password').send({ token: 'abc123def456', newPassword: 'ValidPass123!' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid|expired/i);
    });

    it('returns 200 on successful password reset', async () => {
        // resetPassword: SELECT token row (valid, not expired)
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ user_id: 'u1', expires_at: new Date(Date.now() + 3600000).toISOString() }],
            rowCount: 1,
        } as any);
        // UPDATE auth SET password_hash
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        // DELETE FROM password_reset_tokens
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        // DELETE FROM refresh_tokens (revokeAll)
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        (mockBcryptHash as jest.Mock).mockResolvedValueOnce('newhash');

        const res = await request(testApp).post('/auth/reset-password').send({ token: 'validtoken123', newPassword: 'ValidPass123!' });
        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/password.*reset/i);
    });
});

// ─── POST /api/auth/verify-email ──────────────────────────────────────────────
describe('POST /api/auth/verify-email', () => {
    it('returns 400 when token is missing', async () => {
        const res = await request(testApp).post('/auth/verify-email').send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/token/i);
    });

    it('returns 400 for invalid/expired token', async () => {
        // verifyEmail: SELECT token_hash returns empty
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

        const res = await request(testApp).post('/auth/verify-email').send({ token: 'badtoken' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid|expired/i);
    });

    it('returns 400 when token is expired', async () => {
        // verifyEmail: SELECT returns expired token
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ user_id: 'u1', expires_at: new Date(Date.now() - 1000).toISOString() }],
            rowCount: 1,
        } as any);
        // DELETE expired token
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

        const res = await request(testApp).post('/auth/verify-email').send({ token: 'expiredtoken' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/expired/i);
    });

    it('returns 200 on successful verification', async () => {
        // verifyEmail: SELECT valid token
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ user_id: 'u1', expires_at: new Date(Date.now() + 3600000).toISOString() }],
            rowCount: 1,
        } as any);
        // UPDATE auth SET email_verified=true
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        // DELETE FROM email_verification_tokens
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

        const res = await request(testApp).post('/auth/verify-email').send({ token: 'validtoken' });
        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/verified/i);
    });
});

// ─── POST /api/auth/resend-verification ───────────────────────────────────────
describe('POST /api/auth/resend-verification', () => {
    it('returns 401 with no token', async () => {
        const res = await request(testApp).post('/auth/resend-verification');
        expect(res.status).toBe(401);
    });

    it('returns 200 when email is already verified', async () => {
        const token = validToken();
        // createEmailVerificationTokenByEmail: SELECT user where email_verified=true
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ user_id: 'u1', first_name: 'Test', email_verified: true }],
            rowCount: 1,
        } as any);

        const res = await request(testApp).post('/auth/resend-verification').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/already verified/i);
    });

    it('returns 200 and sends verification email when not yet verified', async () => {
        const token = validToken();
        // createEmailVerificationTokenByEmail: SELECT user not verified
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ user_id: 'u1', first_name: 'Test', email_verified: false }],
            rowCount: 1,
        } as any);
        // createEmailVerificationToken: DELETE existing tokens
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        // createEmailVerificationToken: INSERT new token
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

        const res = await request(testApp).post('/auth/resend-verification').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/verification email sent/i);
    });
});


// ─── Additional branch coverage ──────────────────────────────────────────────

// Silence the app's catch-all error logger only while exercising intentional
// unexpected-error branches. This keeps Jest output clean without globally
// masking console.error for unrelated tests.
async function withSilencedConsoleError<T>(fn: () => PromiseLike<T>): Promise<T> {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
        return await fn();
    } finally {
        consoleSpy.mockRestore();
    }
}

describe('auth route error and async branches', () => {
    it('covers successful register verification-email creation', async () => {
        const registerSpy = jest.spyOn(AuthProvider.prototype, 'registerUser') as jest.Mock;
        const verifySpy = jest.spyOn(AuthProvider.prototype, 'createEmailVerificationTokenByEmail') as jest.Mock;
        try {
            registerSpy.mockResolvedValueOnce({ status: 201, message: 'Registered' });
            verifySpy.mockResolvedValueOnce({ token: 'verify-token', firstName: 'Alice' });
            const res = await request(testApp).post('/auth/register').send({
                email: 'alice@example.com', password: 'Password1', firstName: 'Alice', lastName: 'Smith',
            });
            expect(res.status).toBe(201);
            await new Promise(setImmediate);
        } finally {
            registerSpy.mockRestore();
            verifySpy.mockRestore();
        }
    });

    it('covers verification-email promise rejection after registration', async () => {
        const registerSpy = jest.spyOn(AuthProvider.prototype, 'registerUser') as jest.Mock;
        const verifySpy = jest.spyOn(AuthProvider.prototype, 'createEmailVerificationTokenByEmail') as jest.Mock;
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            registerSpy.mockResolvedValueOnce({ status: 201, message: 'Registered' });
            verifySpy.mockRejectedValueOnce(new Error('email token failed'));
            const res = await request(testApp).post('/auth/register').send({
                email: 'alice@example.com', password: 'Password1', firstName: 'Alice', lastName: 'Smith',
            });
            expect(res.status).toBe(201);
            await new Promise(setImmediate);
            expect(consoleSpy).toHaveBeenCalled();
        } finally {
            registerSpy.mockRestore();
            verifySpy.mockRestore();
            consoleSpy.mockRestore();
        }
    });

    it('rethrows an unexpected register error to the app error handler', async () => {
        const spy = (jest.spyOn(AuthProvider.prototype, 'registerUser') as jest.Mock).mockRejectedValueOnce(new Error('boom'));
        try {
            const res = await withSilencedConsoleError(() =>
                request(testApp).post('/auth/register').send({
                    email: 'a@b.com', password: 'Password1', firstName: 'A', lastName: 'B',
                })
            );
            expect(res.status).toBe(500);
        } finally { spy.mockRestore(); }
    });

    it('covers login DbError and unexpected-error branches', async () => {
        let spy = (jest.spyOn(AuthProvider.prototype, 'loginUser') as jest.Mock).mockRejectedValueOnce(new DbError('forced'));
        let res = await request(testApp).post('/auth/login').send({ email: 'a@b.com', password: 'Password1' });
        expect(res.status).toBe(500);
        spy.mockRestore();

        spy = (jest.spyOn(AuthProvider.prototype, 'loginUser') as jest.Mock).mockRejectedValueOnce(new Error('boom'));
        res = await withSilencedConsoleError(() =>
            request(testApp).post('/auth/login').send({ email: 'a@b.com', password: 'Password1' })
        );
        expect(res.status).toBe(500);
        spy.mockRestore();
    });

    it('covers refresh DbError and unexpected-error branches', async () => {
        let spy = (jest.spyOn(AuthProvider.prototype, 'refreshSession') as jest.Mock).mockRejectedValueOnce(new DbError('forced'));
        let res = await request(testApp).post('/auth/refresh').set('Cookie', 'rt=test-token');
        expect(res.status).toBe(500);
        spy.mockRestore();

        spy = (jest.spyOn(AuthProvider.prototype, 'refreshSession') as jest.Mock).mockRejectedValueOnce(new Error('boom'));
        res = await withSilencedConsoleError(() =>
            request(testApp).post('/auth/refresh').set('Cookie', 'rt=test-token')
        );
        expect(res.status).toBe(500);
        spy.mockRestore();
    });

    it('covers change-password DbError and unexpected-error branches', async () => {
        const token = validToken();
        let spy = (jest.spyOn(AuthProvider.prototype, 'changePassword') as jest.Mock).mockRejectedValueOnce(new DbError('forced'));
        let res = await request(testApp).post('/auth/change-password')
            .set('Authorization', `Bearer ${token}`)
            .send({ currentPassword: 'old', newPassword: 'Newpass123' });
        expect(res.status).toBe(500);
        spy.mockRestore();

        spy = (jest.spyOn(AuthProvider.prototype, 'changePassword') as jest.Mock).mockRejectedValueOnce(new Error('boom'));
        res = await withSilencedConsoleError(() =>
            request(testApp).post('/auth/change-password')
                .set('Authorization', `Bearer ${token}`)
                .send({ currentPassword: 'old', newPassword: 'Newpass123' })
        );
        expect(res.status).toBe(500);
        spy.mockRestore();
    });

    it('covers unexpected account-deletion error', async () => {
        const spy = (jest.spyOn(AuthProvider.prototype, 'deleteAccount') as jest.Mock).mockRejectedValueOnce(new Error('boom'));
        try {
            const res = await withSilencedConsoleError(() =>
                request(testApp).delete('/auth/account')
                    .set('Authorization', `Bearer ${validToken()}`)
            );
            expect(res.status).toBe(500);
        } finally { spy.mockRestore(); }
    });

    it('covers forgot-password DbError and unexpected-error branches', async () => {
        let spy = (jest.spyOn(AuthProvider.prototype, 'createPasswordResetToken') as jest.Mock).mockRejectedValueOnce(new DbError('forced'));
        let res = await request(testApp).post('/auth/forgot-password').send({ email: 'a@b.com' });
        expect(res.status).toBe(500);
        spy.mockRestore();

        spy = (jest.spyOn(AuthProvider.prototype, 'createPasswordResetToken') as jest.Mock).mockRejectedValueOnce(new Error('boom'));
        res = await withSilencedConsoleError(() =>
            request(testApp).post('/auth/forgot-password').send({ email: 'a@b.com' })
        );
        expect(res.status).toBe(500);
        spy.mockRestore();
    });

    it('covers reset-password DbError and unexpected-error branches', async () => {
        let spy = (jest.spyOn(AuthProvider.prototype, 'resetPassword') as jest.Mock).mockRejectedValueOnce(new DbError('forced'));
        let res = await request(testApp).post('/auth/reset-password').send({ token: 't', newPassword: 'Newpass123' });
        expect(res.status).toBe(500);
        spy.mockRestore();

        spy = (jest.spyOn(AuthProvider.prototype, 'resetPassword') as jest.Mock).mockRejectedValueOnce(new Error('boom'));
        res = await withSilencedConsoleError(() =>
            request(testApp).post('/auth/reset-password').send({ token: 't', newPassword: 'Newpass123' })
        );
        expect(res.status).toBe(500);
        spy.mockRestore();
    });

    it('covers verify-email DbError and unexpected-error branches', async () => {
        let spy = (jest.spyOn(AuthProvider.prototype, 'verifyEmail') as jest.Mock).mockRejectedValueOnce(new DbError('forced'));
        let res = await request(testApp).post('/auth/verify-email').send({ token: 't' });
        expect(res.status).toBe(500);
        spy.mockRestore();

        spy = (jest.spyOn(AuthProvider.prototype, 'verifyEmail') as jest.Mock).mockRejectedValueOnce(new Error('boom'));
        res = await withSilencedConsoleError(() =>
            request(testApp).post('/auth/verify-email').send({ token: 't' })
        );
        expect(res.status).toBe(500);
        spy.mockRestore();
    });

    it('covers resend-verification DbError and unexpected-error branches', async () => {
        const token = validToken();
        let spy = (jest.spyOn(AuthProvider.prototype, 'createEmailVerificationTokenByEmail') as jest.Mock).mockRejectedValueOnce(new DbError('forced'));
        let res = await request(testApp).post('/auth/resend-verification').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(500);
        spy.mockRestore();

        spy = (jest.spyOn(AuthProvider.prototype, 'createEmailVerificationTokenByEmail') as jest.Mock).mockRejectedValueOnce(new Error('boom'));
        res = await withSilencedConsoleError(() =>
            request(testApp).post('/auth/resend-verification').set('Authorization', `Bearer ${token}`)
        );
        expect(res.status).toBe(500);
        spy.mockRestore();
    });
});

describe('POST /api/auth/refresh — production CSRF branches', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
    });

    it('returns 403 when the CSRF cookie is absent', async () => {
        process.env.NODE_ENV = 'production';
        const res = await request(testApp).post('/auth/refresh').set('Cookie', 'rt=test-token');
        expect(res.status).toBe(403);
    });

    it('returns 403 when the CSRF header is absent', async () => {
        process.env.NODE_ENV = 'production';
        const res = await request(testApp).post('/auth/refresh')
            .set('Cookie', ['rt=test-token', 'csrf_token=abc']);
        expect(res.status).toBe(403);
    });

    it('returns 403 when CSRF cookie and header differ', async () => {
        process.env.NODE_ENV = 'production';
        const res = await request(testApp).post('/auth/refresh')
            .set('Cookie', ['rt=test-token', 'csrf_token=abc'])
            .set('X-CSRF-Token', 'xyz');
        expect(res.status).toBe(403);
    });

    it('continues when CSRF cookie and header match', async () => {
        process.env.NODE_ENV = 'production';
        const spy = jest.spyOn(AuthProvider.prototype, 'refreshSession') as jest.Mock;
        try {
            spy.mockResolvedValueOnce({ accessToken: 'access', refreshToken: 'refresh' });
            const res = await request(testApp).post('/auth/refresh')
                .set('Cookie', ['rt=test-token', 'csrf_token=abc'])
                .set('X-CSRF-Token', 'abc');
            expect(res.status).toBe(200);
            expect(res.body.accessToken).toBe('access');
        } finally { spy.mockRestore(); }
    });
});

describe('POST /api/auth/google/login', () => {
    it('returns 400 when OAuth token is missing', async () => {
        const res = await request(testApp).post('/auth/google/login').send({});
        expect(res.status).toBe(400);
    });

    it('returns 401 when Google payload has no email', async () => {
        const oauthSpy = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken') as jest.Mock;
        try {
            oauthSpy.mockResolvedValueOnce({ getPayload: () => ({ name: 'No Email' }) });
            const res = await request(testApp).post('/auth/google/login').send({ token: 'google-token' });
            expect(res.status).toBe(401);
        } finally { oauthSpy.mockRestore(); }
    });

    it('uses the name fallback and returns auth tokens', async () => {
        const oauthSpy = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken') as jest.Mock;
        const googleSpy = jest.spyOn(AuthProvider.prototype, 'googleAuth') as jest.Mock;
        try {
            oauthSpy.mockResolvedValueOnce({ getPayload: () => ({ email: 'g@example.com', name: 'Google User' }) });
            googleSpy.mockResolvedValueOnce({ accessToken: 'access', refreshToken: 'refresh' });
            const res = await request(testApp).post('/auth/google/login').send({ token: 'google-token' });
            expect(res.status).toBe(200);
            expect(googleSpy).toHaveBeenCalledWith('g@example.com', 'Google', 'User');
        } finally {
            oauthSpy.mockRestore();
            googleSpy.mockRestore();
        }
    });

    it('uses given/family names when supplied', async () => {
        const oauthSpy = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken') as jest.Mock;
        const googleSpy = jest.spyOn(AuthProvider.prototype, 'googleAuth') as jest.Mock;
        try {
            oauthSpy.mockResolvedValueOnce({ getPayload: () => ({ email: 'g@example.com', given_name: 'Given', family_name: 'Family' }) });
            googleSpy.mockResolvedValueOnce({ accessToken: 'access', refreshToken: 'refresh' });
            const res = await request(testApp).post('/auth/google/login').send({ token: 'google-token' });
            expect(res.status).toBe(200);
            expect(googleSpy).toHaveBeenCalledWith('g@example.com', 'Given', 'Family');
        } finally {
            oauthSpy.mockRestore();
            googleSpy.mockRestore();
        }
    });

    it('uses empty names when the payload has no name fields', async () => {
        const oauthSpy = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken') as jest.Mock;
        const googleSpy = jest.spyOn(AuthProvider.prototype, 'googleAuth') as jest.Mock;
        try {
            oauthSpy.mockResolvedValueOnce({ getPayload: () => ({ email: 'g@example.com' }) });
            googleSpy.mockResolvedValueOnce({ accessToken: 'access', refreshToken: 'refresh' });
            const res = await request(testApp).post('/auth/google/login').send({ token: 'google-token' });
            expect(res.status).toBe(200);
            expect(googleSpy).toHaveBeenCalledWith('g@example.com', '', '');
        } finally {
            oauthSpy.mockRestore();
            googleSpy.mockRestore();
        }
    });

    it('returns 500 when googleAuth throws DbError', async () => {
        const oauthSpy = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken') as jest.Mock;
        const googleSpy = (jest.spyOn(AuthProvider.prototype, 'googleAuth') as jest.Mock).mockRejectedValueOnce(new DbError('forced'));
        try {
            oauthSpy.mockResolvedValueOnce({ getPayload: () => ({ email: 'g@example.com', name: 'Google User' }) });
            const res = await request(testApp).post('/auth/google/login').send({ token: 'google-token' });
            expect(res.status).toBe(500);
        } finally {
            oauthSpy.mockRestore();
            googleSpy.mockRestore();
        }
    });

    it('returns 401 when Google token verification rejects', async () => {
        const oauthSpy = (jest.spyOn(OAuth2Client.prototype, 'verifyIdToken') as jest.Mock).mockRejectedValueOnce(new Error('invalid'));
        try {
            const res = await request(testApp).post('/auth/google/login').send({ token: 'bad-token' });
            expect(res.status).toBe(401);
        } finally { oauthSpy.mockRestore(); }
    });
});
