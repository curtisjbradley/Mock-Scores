import { Request, Response, NextFunction } from 'express';
import { signToken, verifyToken, bearerToken, verifyUser, verifyTournamentAccess, verifyTournamentOwner, uuidRegex } from '../../src/authUtils';
import { dbQuery } from '../../src/db';

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;

// Helper to build minimal mock req/res/next
function mockReq(overrides: Partial<Request> = {}): Request {
    return {
        headers: {},
        params: {},
        session: undefined,
        tournament: undefined,
        ...overrides,
    } as unknown as Request;
}

function mockRes(): { res: Response; status: jest.Mock; json: jest.Mock; } {
    const json = jest.fn().mockReturnThis();
    const status = jest.fn().mockReturnValue({ json });
    const res = { status, json } as unknown as Response;
    return { res, status, json };
}

const next: NextFunction = jest.fn();

beforeEach(() => {
    jest.clearAllMocks();
});

// ─── uuidRegex ────────────────────────────────────────────────────────────────
describe('uuidRegex', () => {
    it('matches a valid UUID', () => {
        expect(uuidRegex.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });
    it('rejects an invalid UUID', () => {
        expect(uuidRegex.test('not-a-uuid')).toBe(false);
    });
});

// ─── signToken / verifyToken ──────────────────────────────────────────────────
describe('signToken / verifyToken', () => {
    it('signs and verifies a token round-trip', async () => {
        const token = await signToken('user-1', 'a@b.com', 'Alice', 'Smith');
        expect(typeof token).toBe('string');

        const payload = await verifyToken(token);
        expect(payload).toMatchObject({
            userId: 'user-1',
            email: 'a@b.com',
            firstName: 'Alice',
            lastName: 'Smith',
        });
    });

    it('returns null for an invalid token', async () => {
        const result = await verifyToken('invalid.token.here');
        expect(result).toBeNull();
    });

    it('returns null for an empty string', async () => {
        expect(await verifyToken('')).toBeNull();
    });
});

// ─── bearerToken ─────────────────────────────────────────────────────────────
describe('bearerToken', () => {
    it('extracts token from Bearer header', () => {
        const req = mockReq({ headers: { authorization: 'Bearer mytoken123' } });
        expect(bearerToken(req)).toBe('mytoken123');
    });

    it('returns undefined when no authorization header', () => {
        const req = mockReq({ headers: {} });
        expect(bearerToken(req)).toBeUndefined();
    });

    it('returns undefined for non-Bearer scheme', () => {
        const req = mockReq({ headers: { authorization: 'Basic abc123' } });
        expect(bearerToken(req)).toBeUndefined();
    });
});

// ─── verifyUser ───────────────────────────────────────────────────────────────
describe('verifyUser', () => {
    it('calls next() with a valid token', async () => {
        const token = await signToken('uid-1', 'x@y.com', 'Bob', 'Jones');
        const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
        const { res, status } = mockRes();

        await verifyUser(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(status).not.toHaveBeenCalled();
        expect((req as any).session).toMatchObject({ userId: 'uid-1', email: 'x@y.com' });
    });

    it('returns 401 when no token', async () => {
        const req = mockReq({ headers: {} });
        const { res, status, json } = mockRes();

        await verifyUser(req, res, next);

        expect(status).toHaveBeenCalledWith(401);
        expect(json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 for an invalid token', async () => {
        const req = mockReq({ headers: { authorization: 'Bearer bad.token' } });
        const { res, status, json } = mockRes();

        await verifyUser(req, res, next);

        expect(status).toHaveBeenCalledWith(401);
        expect(json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
    });
});

// ─── verifyTournamentAccess ───────────────────────────────────────────────────
describe('verifyTournamentAccess', () => {
    const validUUID = '550e8400-e29b-41d4-a716-446655440000';

    it('returns 404 when tournamentId is missing', async () => {
        const req = mockReq({ params: {}, session: { userId: 'u1', email: 'e', firstName: 'F', lastName: 'L' } as any });
        const { res, status, json } = mockRes();

        await verifyTournamentAccess(req, res, next);

        expect(status).toHaveBeenCalledWith(404);
        expect(json).toHaveBeenCalledWith({ message: 'Invalid tournamentId specified' });
    });

    it('returns 401 when session is missing', async () => {
        const req = mockReq({ params: { tournamentId: validUUID } });
        const { res, status, json } = mockRes();

        await verifyTournamentAccess(req, res, next);

        expect(status).toHaveBeenCalledWith(401);
        expect(json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
    });

    it('returns 400 for invalid UUID', async () => {
        const req = mockReq({
            params: { tournamentId: 'not-a-uuid' },
            session: { userId: 'u1', email: 'e', firstName: 'F', lastName: 'L' } as any,
        });
        const { res, status, json } = mockRes();

        await verifyTournamentAccess(req, res, next);

        expect(status).toHaveBeenCalledWith(400);
        expect(json).toHaveBeenCalledWith({ message: 'Tournament id is not a valid uuid' });
    });

    it('returns 500 when dbQuery returns null', async () => {
        mockDbQuery.mockResolvedValueOnce(null as any);
        const req = mockReq({
            params: { tournamentId: validUUID },
            session: { userId: 'u1', email: 'e', firstName: 'F', lastName: 'L' } as any,
        });
        const { res, status, json } = mockRes();

        await verifyTournamentAccess(req, res, next);

        expect(status).toHaveBeenCalledWith(500);
        expect(json).toHaveBeenCalledWith({ message: 'Unable to reach database' });
    });

    it('returns 403 when user has no role', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const req = mockReq({
            params: { tournamentId: validUUID },
            session: { userId: 'u1', email: 'e', firstName: 'F', lastName: 'L' } as any,
        });
        const { res, status, json } = mockRes();

        await verifyTournamentAccess(req, res, next);

        expect(status).toHaveBeenCalledWith(403);
        expect(json).toHaveBeenCalledWith({ message: 'Not authorized' });
    });

    it('calls next() when user has access', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ role: 'delegate' }], rowCount: 1 } as any);
        const req = mockReq({
            params: { tournamentId: validUUID },
            session: { userId: 'u1', email: 'e', firstName: 'F', lastName: 'L' } as any,
        });
        const { res, status } = mockRes();

        await verifyTournamentAccess(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(status).not.toHaveBeenCalled();
        expect((req as any).tournament).toBe(validUUID);
    });
});

// ─── verifyTournamentOwner ────────────────────────────────────────────────────
describe('verifyTournamentOwner', () => {
    const validUUID = '550e8400-e29b-41d4-a716-446655440000';

    it('returns 401 when session is missing', async () => {
        const req = mockReq({ params: { tournamentId: validUUID } });
        const { res, status, json } = mockRes();

        await verifyTournamentOwner(req, res, next);

        expect(status).toHaveBeenCalledWith(401);
        expect(json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
    });

    it('returns 400 for invalid UUID', async () => {
        const req = mockReq({
            params: { tournamentId: 'bad' },
            session: { userId: 'u1', email: 'e', firstName: 'F', lastName: 'L' } as any,
        });
        const { res, status, json } = mockRes();

        await verifyTournamentOwner(req, res, next);

        expect(status).toHaveBeenCalledWith(400);
        expect(json).toHaveBeenCalledWith({ message: 'Invalid tournament id' });
    });

    it('returns 403 when no row found', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const req = mockReq({
            params: { tournamentId: validUUID },
            session: { userId: 'u1', email: 'e', firstName: 'F', lastName: 'L' } as any,
        });
        const { res, status, json } = mockRes();

        await verifyTournamentOwner(req, res, next);

        expect(status).toHaveBeenCalledWith(403);
        expect(json).toHaveBeenCalledWith({ message: 'Not authorized' });
    });

    it('returns 403 when role is not owner', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ role: 'delegate' }], rowCount: 1 } as any);
        const req = mockReq({
            params: { tournamentId: validUUID },
            session: { userId: 'u1', email: 'e', firstName: 'F', lastName: 'L' } as any,
        });
        const { res, status, json } = mockRes();

        await verifyTournamentOwner(req, res, next);

        expect(status).toHaveBeenCalledWith(403);
        expect(json).toHaveBeenCalledWith({ message: 'Only owners can perform this action' });
    });

    it('calls next() when user is owner', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ role: 'owner' }], rowCount: 1 } as any);
        const req = mockReq({
            params: { tournamentId: validUUID },
            session: { userId: 'u1', email: 'e', firstName: 'F', lastName: 'L' } as any,
        });
        const { res, status } = mockRes();

        await verifyTournamentOwner(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(status).not.toHaveBeenCalled();
        expect((req as any).tournament).toBe(validUUID);
    });
});
