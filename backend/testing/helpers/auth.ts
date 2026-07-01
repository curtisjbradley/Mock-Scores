/**
 * Shared authentication helpers for backend integration tests.
 *
 * The JWT is signed once at module scope (lazy, on first call) and the
 * promise is cached for the lifetime of the worker process. With
 * `maxWorkers: 1` in jest.config.js all test files share this module cache,
 * so jose's ~2.5s Web Crypto cold-start happens exactly once per test run.
 *
 * Usage:
 * ```ts
 * import { setupAuth, makeAuth, makeMockAccess } from '../helpers/auth';
 *
 * const getToken = setupAuth();                       // registers beforeAll + beforeEach
 * const auth = () => makeAuth(getToken());            // header factory
 * const mockAccess = () => makeMockAccess(mockDbQuery); // owner-access mock
 * ```
 */

import { signToken } from '../../src/authUtils';

/** Single promise cached for the whole worker. Resolved on first access. */
let _tokenPromise: Promise<string> | null = null;

function getTokenPromise(): Promise<string> {
    if (!_tokenPromise) {
        _tokenPromise = signToken('user-1', 'test@test.com', 'Test', 'User');
    }
    return _tokenPromise;
}

/**
 * Registers `beforeAll` (resolves the shared JWT) and `beforeEach` (clears
 * all mocks). Returns a synchronous getter that works after `beforeAll` runs.
 *
 * The first test file to call `setupAuth()` triggers `signToken` and caches
 * the result. Every subsequent file in the same worker reuses it at zero cost.
 *
 * @example
 * const getToken = setupAuth();
 * const auth = () => makeAuth(getToken());
 */
export function setupAuth(): () => string {
    let token = '';
    beforeAll(async () => {
        token = await getTokenPromise();
    });
    beforeEach(() => jest.clearAllMocks());
    return () => token;
}

/**
 * Builds the `Authorization` header value for an authenticated request.
 *
 * @param token - JWT returned by {@link setupAuth}
 * @returns Header object ready for supertest's `.set(auth())`
 */
export function makeAuth(token: string): { Authorization: string } {
    return { Authorization: `Bearer ${token}` };
}

/**
 * Pushes a single owner-role row onto `mockDbQuery` to satisfy
 * `verifyTournamentAccess` in the next database call.
 *
 * @param mockDbQuery - The jest-mocked `dbQuery` function
 */
export function makeMockAccess(
    mockDbQuery: jest.MockedFunction<(...args: unknown[]) => unknown>,
): void {
    mockDbQuery.mockResolvedValueOnce({ rows: [{ role: 'owner' }], rowCount: 1 } as never);
}
