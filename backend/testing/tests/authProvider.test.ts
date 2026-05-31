import { AuthProvider } from '../../src/providers/authProvider';
import { dbQuery } from '../../src/db';
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
    it('returns 500 when initial SELECT fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        expect(await provider.registerUser('a@b.com', 'pass', 'A', 'B')).toEqual({ status: 500, message: 'Internal error' });
    });

    it('returns 409 when email already exists', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ user_id: 'existing' }], rowCount: 1 } as any);
        expect(await provider.registerUser('a@b.com', 'pass', 'A', 'B')).toEqual({ status: 409, message: 'Email already in use' });
    });

    it('returns 201 on successful registration', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)                          // SELECT
            .mockResolvedValueOnce({ rows: [{ user_id: 'u1' }], rowCount: 1 } as any)        // INSERT auth
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)                          // DELETE tournament invites
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);                         // DELETE team invites
        (mockBcryptHash as jest.Mock).mockResolvedValueOnce('hashed');

        expect(await provider.registerUser('new@b.com', 'pass', 'New', 'User')).toEqual({ status: 201, message: 'User Created' });
    });

    it('returns 500 when INSERT fails', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce(null);
        (mockBcryptHash as jest.Mock).mockResolvedValueOnce('hashed');

        expect(await provider.registerUser('new@b.com', 'pass', 'A', 'B')).toEqual({ status: 500, message: 'Internal error' });
    });

    it('returns 500 when tournament invite DELETE fails', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [{ user_id: 'u1' }], rowCount: 1 } as any)
            .mockResolvedValueOnce(null);
        (mockBcryptHash as jest.Mock).mockResolvedValueOnce('hashed');

        expect(await provider.registerUser('new@b.com', 'pass', 'A', 'B')).toEqual({ status: 500, message: 'Internal error' });
    });

    it('returns 500 when team invite DELETE fails', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [{ user_id: 'u1' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce(null);
        (mockBcryptHash as jest.Mock).mockResolvedValueOnce('hashed');

        expect(await provider.registerUser('new@b.com', 'pass', 'A', 'B')).toEqual({ status: 500, message: 'Internal error' });
    });
});

describe('AuthProvider.loginUser', () => {
    it('returns 500 when DB query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        expect(await provider.loginUser('a@b.com', 'pass')).toEqual({ status: 500, message: 'Internal error' });
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

    it('returns a JWT string on successful login', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ user_id: 'u1', email: 'a@b.com', password_hash: 'hash', first_name: 'Alice', last_name: 'Smith' }], rowCount: 1 } as any);
        (mockBcryptCompare as jest.Mock).mockResolvedValueOnce(true);

        const result = await provider.loginUser('a@b.com', 'correct');
        expect(typeof result).toBe('string');
        expect((result as string).split('.').length).toBe(3);
    });
});

describe('AuthProvider.changePassword', () => {
    it('returns 500 when DB query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        expect(await provider.changePassword('u1', 'old', 'newpass123')).toEqual({ status: 500, message: 'Internal error' });
    });

    it('returns 401 when user not found', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.changePassword('u1', 'old', 'newpass123')).toEqual({ status: 401, message: 'Current password is incorrect' });
    });

    it('returns 401 when current password is wrong', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ password_hash: 'hash' }], rowCount: 1 } as any);
        (mockBcryptCompare as jest.Mock).mockResolvedValueOnce(false);
        expect(await provider.changePassword('u1', 'wrong', 'newpass123')).toEqual({ status: 401, message: 'Current password is incorrect' });
    });

    it('returns 200 on successful password change', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ password_hash: 'oldhash' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        (mockBcryptCompare as jest.Mock).mockResolvedValueOnce(true);
        (mockBcryptHash as jest.Mock).mockResolvedValueOnce('newhash');

        expect(await provider.changePassword('u1', 'oldpass', 'newpass123')).toEqual({ status: 200, message: 'Password updated' });
    });
});
