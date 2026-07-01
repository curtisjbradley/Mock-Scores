const TOKEN_KEY = 'auth_token';

export { GOOGLE_CLIENT_ID } from '@mock-scores/shared';

export interface Session {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
}

/** Persists the JWT to localStorage and fires a storage event so other tabs update. */
export function saveToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
    window.dispatchEvent(new StorageEvent('storage', { key: TOKEN_KEY }));
}

/** Returns the stored JWT, or null when not authenticated. */
function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

/** Removes the JWT from localStorage and fires a storage event. */
function removeToken() {
    localStorage.removeItem(TOKEN_KEY);
}

/**
 * Resolves the current user session by verifying the stored token with the
 * server. Returns null and clears the token when the token is missing or
 * the server responds with a non-OK status.
 */
export async function getSession(): Promise<Session | null> {
    const token = getToken();
    if (!token) return null;
    try {
        const res = await fetch('/api/auth/session', {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) { removeToken(); return null; }
        return res.json();
    } catch {
        return null;
    }
}

/** Clears the stored token and fires a storage event to log out all tabs. */
export function logout() {
    removeToken();
    window.dispatchEvent(new StorageEvent('storage', { key: 'auth_token' }));
}

/**
 * Authenticated fetch wrapper. Automatically attaches the stored JWT as a
 * `Bearer` token and sets `Content-Type: application/json` when a body is
 * present.
 *
 * @param url - API endpoint path (relative to the current origin)
 * @param init - Optional standard `RequestInit` options
 */
export function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const token = getToken();
    return fetch(url, {
        ...init,
        headers: {
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            ...(init.headers ?? {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });
}

/** POST JSON to a public (unauthenticated) endpoint. Returns parsed body and ok flag. */
export async function postJson<T = Record<string, unknown>>(url: string, body: unknown): Promise<{ ok: boolean; data: T }> {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({})) as T;
    return { ok: res.ok, data };
}
