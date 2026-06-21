import { AuthProvider } from '../../src/providers/authProvider';
import { dbQuery } from '../../src/db';
import { AlreadyExistsError, DbError } from '../../src/errors';
import bcrypt from 'bcrypt';

jest.mock('bcrypt');
jest.mock('../../src/authUtils', () => ({
    ...jest.requireActual('../../src/authUtils'),
    signToken: jest.fn().mockResolvedValue('mock.jwt.token'),
}));

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;
const mockBcryptHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;
const mockBcryptCompare = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>;

let provider: AuthProvider;

beforeEach(() => {
    jest.clearAllMocks();
    provider = new AuthProvider();
});

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
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)           // SELECT existing
            .mockResolvedValueOnce({ rows: [{ user_id: 'u1' }], rowCount: 1 } as any) // INSERT auth
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)           // DELETE tournament invites
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);          // DELETE team invites
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

    it('returns JWT string on success', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ user_id: 'u1', email: 'a@b.com', password_hash: 'hash', first_name: 'Alice', last_name: 'Smith' }], rowCount: 1 } as any);
        (mockBcryptCompare as jest.Mock).mockResolvedValueOnce(true);
        const result = await provider.loginUser('a@b.com', 'correct');
        expect(typeof result).toBe('string');
    });
});

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

    it('returns 200 on success', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ password_hash: 'oldhash' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        (mockBcryptCompare as jest.Mock).mockResolvedValueOnce(true);
        (mockBcryptHash as jest.Mock).mockResolvedValueOnce('newhash');
        expect(await provider.changePassword('u1', 'oldpass', 'newpass123')).toEqual({ status: 200, message: 'Password updated' });
    });
});
