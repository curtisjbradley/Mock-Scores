/** Base URL for all API requests. Empty string in dev (same-origin proxy), full URL in production. */
export const API_BASE = import.meta.env.VITE_API_BASE ?? '';
