/**
 * Frontend authentication module.
 *
 * Security model:
 * - Access token (15 min JWT) — stored in a module-level variable only.
 *   Never written to localStorage, sessionStorage, or a readable cookie.
 *   XSS cannot steal it because JS has no cross-origin memory access.
 *
 * - Refresh token (7 day opaque token) — stored server-side as a hash and
 *   delivered to the browser as an HttpOnly, Secure, SameSite=Strict cookie.
 *   JS cannot read HttpOnly cookies, so XSS cannot steal it either.
 *
 * Silent refresh: `apiFetch` automatically calls `/api/auth/refresh` on a 401
 * response, updates the in-memory access token, and retries the original request
 * exactly once. No user interaction is required for token renewal.
 */

export { GOOGLE_CLIENT_ID } from '@mock-scores/shared';

export interface Session {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
}

// ── In-memory access token ────────────────────────────────────────────────────

/** The current access token, held only in JS memory. */
let _accessToken: string | null = null;

/** True while a token refresh is in-flight — prevents concurrent refresh storms. */
let _refreshing: Promise<boolean> | null = null;

/**
 * Stores a new access token in memory and notifies other parts of the app
 * via a custom event (equivalent to the old storage event).
 */
export function setAccessToken(token: string | null): void {
    _accessToken = token;
    window.dispatchEvent(new Event('auth-changed'));
}

// ── Token refresh ─────────────────────────────────────────────────────────────

/**
 * Calls `/api/auth/refresh` using the HttpOnly cookie (sent automatically by
 * the browser). On success, stores the new access token in memory.
 *
 * Returns true if a fresh token was obtained, false otherwise.
 *
 * Uses a shared promise so concurrent calls during a refresh window coalesce
 * into one network request.
 */
export function refreshAccessToken(): Promise<boolean> {
    if (_refreshing) return _refreshing;

    _refreshing = fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
        .then(async res => {
            if (!res.ok) { setAccessToken(null); return false; }
            const data = await res.json() as { accessToken: string };
            setAccessToken(data.accessToken);
            return true;
        })
        .catch(() => { setAccessToken(null); return false; })
        .finally(() => { _refreshing = null; });

    return _refreshing;
}

// ── Session ───────────────────────────────────────────────────────────────────

/**
 * Returns the current session by calling `/api/auth/session` with the
 * in-memory access token. If the token is missing or expired, attempts a
 * silent refresh first. Returns null when the user is not authenticated.
 */
export async function getSession(): Promise<Session | null> {
    // Try a silent refresh if we have no token yet (e.g. page reload)
    if (!_accessToken) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) return null;
    }

    try {
        const res = await fetch('/api/auth/session', {
            headers: { Authorization: `Bearer ${_accessToken}` },
        });
        if (res.ok) return res.json();

        // Token may have expired mid-session — try one refresh
        if (res.status === 401) {
            const refreshed = await refreshAccessToken();
            if (!refreshed) return null;
            const retry = await fetch('/api/auth/session', {
                headers: { Authorization: `Bearer ${_accessToken}` },
            });
            return retry.ok ? retry.json() : null;
        }
        return null;
    } catch {
        return null;
    }
}

// ── Login / logout ────────────────────────────────────────────────────────────

/**
 * Stores the access token received from the login or refresh response.
 * Called by `useLoginForm` and `GoogleAuthButton` after a successful auth.
 *
 * @deprecated Use `setAccessToken` directly — this alias exists for clarity
 * at call sites coming from the login flow.
 */
export function saveToken(token: string): void {
    setAccessToken(token);
}

/**
 * Clears the in-memory access token and calls `/api/auth/logout` to revoke
 * the HttpOnly refresh cookie on the server.
 */
export async function logout(): Promise<void> {
    setAccessToken(null);
    try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
        // Best-effort — local state is already cleared
    }
}

// ── Authenticated fetch ───────────────────────────────────────────────────────

/**
 * Authenticated fetch wrapper.
 *
 * - Attaches the in-memory access token as a `Bearer` header.
 * - On a `401` response, silently refreshes the token and retries once.
 * - Sets `Content-Type: application/json` when a body is present.
 *
 * @param url - API endpoint path (relative to the current origin)
 * @param init - Optional standard `RequestInit` options
 */
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const makeHeaders = (): HeadersInit => ({
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
        ...(_accessToken ? { Authorization: `Bearer ${_accessToken}` } : {}),
    });

    const res = await fetch(url, { ...init, headers: makeHeaders() });

    // Silent refresh on 401 — retry once
    if (res.status === 401) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) return res; // Return the 401 — caller handles it
        return fetch(url, { ...init, headers: makeHeaders() });
    }

    return res;
}

// ── Unauthenticated utility ───────────────────────────────────────────────────

/**
 * POST JSON to a public (unauthenticated) endpoint.
 * Returns the parsed body and an `ok` flag.
 */
export async function postJson<T = Record<string, unknown>>(
    url: string,
    body: unknown,
): Promise<{ ok: boolean; data: T }> {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({})) as T;
    return { ok: res.ok, data };
}
