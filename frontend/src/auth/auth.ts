const TOKEN_KEY = 'auth_token';

export interface Session {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
}

export function saveToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
    window.dispatchEvent(new StorageEvent('storage', { key: TOKEN_KEY }));
}

export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function removeToken() {
    localStorage.removeItem(TOKEN_KEY);
}

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

export function logout() {
    removeToken();
    window.dispatchEvent(new StorageEvent('storage', { key: 'auth_token' }));
}
