jest.mock('../../src/email', () => jest.requireActual('../mocks/email'));
import { AuthProvider } from '../../src/providers/authProvider';
import { dbQuery } from '../../src/db';
import { AlreadyExistsError, DbError } from '../../src/errors';
import bcrypt from 'bcrypt';

jest.mock('bcrypt');

// Mock authUtils — stub signToken, signRefreshToken, and hashJti so provider
// tests don't depend on jose's crypto or random values.
jest.mock('../../src/authUtils', () => ({
    ...jest.requireActual('../../src/authUtils'),
    signToken:         jest.fn().mockResolvedValue('mock.access.token'),
    signRefreshToken:  jest.fn().mockResolvedValue({ token: 'mock.refresh.token', jti: 'mock-jti' }),
    verifyRefreshToken: jest.fn().mockResolvedValue({ userId: 'u1', jti: 'mock-jti' }),
    hashJti:           jest.fn().mockReturnValue('hashed-jti'),
    refreshTokenTtlMs: jest.fn().mockReturnValue(604800000),
}));

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;
const mockBcryptHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;
const mockBcryptCompare = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>;

let provider: AuthProvider;

beforeEach(() => {
    jest.clearAllMocks();
    provider = new AuthProvider();
});

// ── registerUser ──────────────────────────────────────────────────────────────
describe('AuthProvider.registerUser', () => {
    it('throws DbError when initial SELECT fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(provider.registerUser('a@b.com', 'pass', 'A', 'B')).rejects.toThrow(DbError);
    });

    it('throws AlreadyExistsError when email already in use', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ user_id: 'existing' }], rowCount: 1 } as any);
        await expect(provider.registerUser('a@b.com', 'pass', 'A', 'B')).rejects.toThrow(AlreadyExistsError);
    });

    it('returns 201 on success', async () => {
        (mockBcryptHash as jest.Mock).mockResolvedValueOnce('hashed');
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [{ user_id: 'u1' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.registerUser('new@b.com', 'pass', 'New', 'User')).toEqual({ status: 201, message: 'User Created' });
    });

    it('throws DbError when INSERT fails', async () => {
        (mockBcryptHash as jest.Mock).mockResolvedValueOnce('hashed');
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce(null);
        await expect(provider.registerUser('new@b.com', 'pass', 'A', 'B')).rejects.toThrow(DbError);
    });

    it('throws DbError when tournament invite DELETE fails', async () => {
        (mockBcryptHash as jest.Mock).mockResolvedValueOnce('hashed');
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [{ user_id: 'u1' }], rowCount: 1 } as any)
            .mockResolvedValueOnce(null);
        await expect(provider.registerUser('new@b.com', 'pass', 'A', 'B')).rejects.toThrow(DbError);
    });

    it('throws DbError when team invite DELETE fails', async () => {
        (mockBcryptHash as jest.Mock).mockResolvedValueOnce('hashed');
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [{ user_id: 'u1' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce(null);
        await expect(provider.registerUser('new@b.com', 'pass', 'A', 'B')).rejects.toThrow(DbError);
    });
});

// ── loginUser ─────────────────────────────────────────────────────────────────
describe('AuthProvider.loginUser', () => {
    it('throws DbError when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(provider.loginUser('a@b.com', 'pass')).rejects.toThrow(DbError);
    });

    it('returns 401 when user not found', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.loginUser('a@b.com', 'pass')).toEqual({ status: 401, message: 'Invalid Username / Password' });
    });

    it('returns 401 when password does not match', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ user_id: 'u1', email: 'a@b.com', password_hash: 'hash', first_name: 'A', last_name: 'B' }], rowCount: 1 } as any);
        (mockBcryptCompare as jest.Mock).mockResolvedValueOnce(false);
        expect(await provider.loginUser('a@b.com', 'wrong')).toEqual({ status: 401, message: 'Invalid Username / Password' });
    });

    it('returns { accessToken, refreshToken } on success', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ user_id: 'u1', email: 'a@b.com', password_hash: 'hash', first_name: 'Alice', last_name: 'Smith' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // INSERT refresh token
        (mockBcryptCompare as jest.Mock).mockResolvedValueOnce(true);
        const result = await provider.loginUser('a@b.com', 'correct');
        expect(result).toMatchObject({ accessToken: 'mock.access.token', refreshToken: 'mock.refresh.token' });
    });
});

// ── refreshSession ────────────────────────────────────────────────────────────
describe('AuthProvider.refreshSession', () => {
    it('returns null when token not found in DB', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.refreshSession('unknown-token')).toBeNull();
    });

    it('returns null and deletes token when expired', async () => {
        const past = new Date(Date.now() - 1000).toISOString();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ user_id: 'u1', email: 'a@b.com', first_name: 'A', last_name: 'B', expires_at: past }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // DELETE expired
        expect(await provider.refreshSession('expired-token')).toBeNull();
    });

    it('rotates token and returns { accessToken, refreshToken } on success', async () => {
        const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ user_id: 'u1', email: 'a@b.com', first_name: 'Alice', last_name: 'Smith', expires_at: future }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // DELETE old token
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // INSERT new token
        const result = await provider.refreshSession('valid-raw-token');
        expect(result).toMatchObject({ accessToken: 'mock.access.token', refreshToken: 'mock.refresh.token' });
    });
});

// ── revokeRefreshToken ────────────────────────────────────────────────────────
describe('AuthProvider.revokeRefreshToken', () => {
    it('deletes the token from the DB', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        await expect(provider.revokeRefreshToken('some-token')).resolves.toBeUndefined();
        expect(mockDbQuery).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM refresh_tokens'),
            expect.any(Array),
        );
    });
});

// ── changePassword ────────────────────────────────────────────────────────────
describe('AuthProvider.changePassword', () => {
    it('throws DbError when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(provider.changePassword('u1', 'old', 'newpass123')).rejects.toThrow(DbError);
    });

    it('returns 401 when user not found', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.changePassword('u1', 'old', 'newpass123')).toEqual({ status: 401, message: 'Current password is incorrect' });
    });

    it('returns 401 when current password wrong', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ password_hash: 'hash' }], rowCount: 1 } as any);
        (mockBcryptCompare as jest.Mock).mockResolvedValueOnce(false);
        expect(await provider.changePassword('u1', 'wrong', 'newpass123')).toEqual({ status: 401, message: 'Current password is incorrect' });
    });

    it('returns 200 and revokes all refresh tokens on success', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ password_hash: 'oldhash' }], rowCount: 1 } as any) // SELECT
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)  // UPDATE password
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // DELETE all refresh tokens
        (mockBcryptCompare as jest.Mock).mockResolvedValueOnce(true);
        (mockBcryptHash as jest.Mock).mockResolvedValueOnce('newhash');
        const result = await provider.changePassword('u1', 'oldpass', 'newpass123');
        expect(result).toEqual({ status: 200, message: 'Password updated' });
        // Verify revocation was called
        expect(mockDbQuery).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM refresh_tokens WHERE user_id'),
            expect.any(Array),
        );
    });
});
