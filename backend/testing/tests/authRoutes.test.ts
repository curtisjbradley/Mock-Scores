jest.mock('../../src/email', () => jest.requireActual('../mocks/email'));
import request from 'supertest';
import testApp from '../../src/appService';
import { dbQuery } from '../../src/db';
import bcrypt from 'bcrypt';
import { signToken } from '../../src/authUtils';

jest.mock('bcrypt');

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;
const mockBcryptHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;
const mockBcryptCompare = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>;

beforeEach(() => jest.clearAllMocks());

// Token for the session/change-password tests. signToken is free after the
// module-scope cache in helpers/auth.ts has been warmed by the first test file.
let sharedToken: string;
beforeAll(async () => {
    sharedToken = await signToken('user-1', 'test@test.com', 'Test', 'User');
});
const validToken = () => sharedToken;

// ─── POST /api/auth/register ──────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
    it('returns 400 when email is missing', async () => {
        const res = await request(testApp).post('/api/auth/register').send({ password: 'pass', firstName: 'A', lastName: 'B' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/email and password/i);
    });

    it('returns 400 when password is missing', async () => {
        const res = await request(testApp).post('/api/auth/register').send({ email: 'a@b.com', firstName: 'A', lastName: 'B' });
        expect(res.status).toBe(400);
    });

    it('returns 400 when firstName is missing', async () => {
        const res = await request(testApp).post('/api/auth/register').send({ email: 'a@b.com', password: 'pass', lastName: 'B' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/first and last name/i);
    });

    it('returns 400 when lastName is blank', async () => {
        const res = await request(testApp).post('/api/auth/register').send({ email: 'a@b.com', password: 'pass', firstName: 'A', lastName: '   ' });
        expect(res.status).toBe(400);
    });

    it('returns 409 when email already in use', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ user_id: 'existing' }], rowCount: 1 } as any);
        const res = await request(testApp).post('/api/auth/register').send({ email: 'a@b.com', password: 'Password1', firstName: 'A', lastName: 'B' });
        expect(res.status).toBe(409);
    });

    it('returns 201 on successful registration', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [{ user_id: 'u1' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        (mockBcryptHash as jest.Mock).mockResolvedValueOnce('hashed');

        const res = await request(testApp).post('/api/auth/register').send({ email: 'new@b.com', password: 'Password1', firstName: 'New', lastName: 'User' });
        expect(res.status).toBe(201);
    });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
    it('returns 400 when email is missing', async () => {
        const res = await request(testApp).post('/api/auth/login').send({ password: 'pass' });
        expect(res.status).toBe(400);
    });

    it('returns 400 when password is missing', async () => {
        const res = await request(testApp).post('/api/auth/login').send({ email: 'a@b.com' });
        expect(res.status).toBe(400);
    });

    it('returns 401 for invalid credentials', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(testApp).post('/api/auth/login').send({ email: 'a@b.com', password: 'wrong' });
        expect(res.status).toBe(401);
    });

    it('returns 200 with token on successful login', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ user_id: 'u1', email: 'a@b.com', password_hash: 'hash', first_name: 'Alice', last_name: 'Smith' }], rowCount: 1 } as any);
        (mockBcryptCompare as jest.Mock).mockResolvedValueOnce(true);

        const res = await request(testApp).post('/api/auth/login').send({ email: 'a@b.com', password: 'Password1' });
        expect(res.status).toBe(200);
        expect(typeof res.body.token).toBe('string');
    });
});

// ─── GET /api/auth/session ────────────────────────────────────────────────────
describe('GET /api/auth/session', () => {
    it('returns 401 with no token', async () => {
        const res = await request(testApp).get('/api/auth/session');
        expect(res.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
        const res = await request(testApp).get('/api/auth/session').set('Authorization', 'Bearer bad.token.here');
        expect(res.status).toBe(401);
    });

    it('returns 200 with session data for valid token', async () => {
        const token = validToken();
        const res = await request(testApp).get('/api/auth/session').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ userId: 'user-1', email: 'test@test.com', firstName: 'Test', lastName: 'User' });
    });
});

// ─── POST /api/auth/change-password ──────────────────────────────────────────
describe('POST /api/auth/change-password', () => {
    it('returns 401 with no token', async () => {
        const res = await request(testApp).post('/api/auth/change-password').send({ currentPassword: 'old', newPassword: 'newpass123' });
        expect(res.status).toBe(401);
    });

    it('returns 400 when fields are missing', async () => {
        const token = validToken();
        const res = await request(testApp).post('/api/auth/change-password').set('Authorization', `Bearer ${token}`).send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/missing required fields/i);
    });

    it('returns 400 when new password is too short', async () => {
        const token = validToken();
        const res = await request(testApp).post('/api/auth/change-password').set('Authorization', `Bearer ${token}`).send({ currentPassword: 'old', newPassword: 'short' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/at least 8 characters/i);
    });

    it('returns 401 when current password is wrong', async () => {
        const token = validToken();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ password_hash: 'hash' }], rowCount: 1 } as any);
        (mockBcryptCompare as jest.Mock).mockResolvedValueOnce(false);

        const res = await request(testApp).post('/api/auth/change-password').set('Authorization', `Bearer ${token}`).send({ currentPassword: 'wrong', newPassword: 'Newpass123' });
        expect(res.status).toBe(401);
    });

    it('returns 200 on successful password change', async () => {
        const token = validToken();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ password_hash: 'oldhash' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        (mockBcryptCompare as jest.Mock).mockResolvedValueOnce(true);
        (mockBcryptHash as jest.Mock).mockResolvedValueOnce('newhash');

        const res = await request(testApp).post('/api/auth/change-password').set('Authorization', `Bearer ${token}`).send({ currentPassword: 'oldpass', newPassword: 'Newpass123' });
        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/password updated/i);
    });
});
