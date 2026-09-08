import express, { NextFunction, Request, Response } from "express";
import path from "path";
import dotenv from 'dotenv';
import { expand } from 'dotenv-expand';

// In production (ECS), env vars are injected by the container runtime via Secrets Manager.
// Only load .env file for local development.
if (process.env.NODE_ENV !== 'production') {
    expand(dotenv.config({ path: path.resolve(__dirname, '../.env') }));
}
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swaggerConfig';
import authRouter from './routes/authRoutes';
import webhookRouter from "./routes/webhookRouter";
import organizerTournamentRouter from './routes/organizer/organizerRoutes';
import coachRouter from "./routes/coach/coachRoutes";
import scorerRouter from "./routes/scorerRoutes";
import helpRouter from './routes/requestHelpRoutes';

import { verifyUser } from "./authUtils";
import { DbError } from "./errors";
import RateLimit from 'express-rate-limit';

const app = express();
app.set('trust proxy', 1);

// Rate limit applied to API routes only — never to static assets.
// Static files are served below all API routes so they are never affected.
const globalLimiter = RateLimit({ windowMs: 500, limit: 20, skip: () => process.env.NODE_ENV === 'test' });

// Stricter limit for auth endpoints to mitigate brute-force attacks
const authLimiter = RateLimit({ windowMs: 30 * 1000, limit: 20, skip: () => process.env.NODE_ENV === 'test' });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// cookieParser is needed only to read the HttpOnly refresh-token cookie (`rt`) and the
// readable CSRF cookie (`csrf_token`) on the /auth/refresh + /auth/logout endpoints.
//
// CSRF posture (why there is no global csurf/lusca middleware):
//  - Every state-changing API route (/organizer, /coach, /help, /auth/change-password,
//    /auth/account, ...) authenticates via `verifyUser`, which reads ONLY the
//    `Authorization: Bearer` access token — never a cookie. Browsers do not attach that
//    header automatically on cross-site requests, so these routes are structurally
//    immune to CSRF.
//  - The only cookie-authenticated state-changing route, POST /auth/refresh, enforces a
//    double-submit CSRF token (csrf_token cookie must equal the X-CSRF-Token header) —
//    see authRoutes.ts. A cross-origin attacker cannot read the cookie to forge the header.
//  - POST /auth/logout is cookie-based but only clears the caller's own cookie (idempotent).
//
// CodeQL's js/missing-token-validation fires here because cookieParser() coexists with POST
// handlers; it cannot see that authorization is Bearer-gated. This alert is a false positive
// and should be dismissed as such rather than "fixed" with a session-CSRF middleware, which
// would conflict with this stateless-JWT design.
app.use(cookieParser());

// CORS — allow any mockscores.org subdomain to make credentialed cross-origin requests.
//
// Because we set `Access-Control-Allow-Credentials: true`, we must NOT use a wildcard
// origin and must never reflect an unvalidated, attacker-controlled origin. Each request
// origin is checked against a strict allowlist; only an origin that exactly matches an
// entry in `ALLOWED_ORIGINS`, or a single-label `*.mockscores.org` subdomain over HTTPS,
// is echoed back. The subdomain label is restricted to lowercase alphanumerics and
// interior hyphens (no leading/trailing/consecutive hyphens), so the trailing `mockscores.org`
// cannot be spoofed (e.g. `https://mockscores.org.evil.com` and `https://evil.com` are rejected).
const ALLOWED_ORIGINS = new Set<string>([
    'https://mockscores.org',
    'http://localhost:5173',
]);
const MOCKSCORES_SUBDOMAIN = /^https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.mockscores\.org$/;

function isAllowedOrigin(origin: string): boolean {
    return ALLOWED_ORIGINS.has(origin) || MOCKSCORES_SUBDOMAIN.test(origin);
}

app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (typeof origin === 'string' && isAllowedOrigin(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-CSRF-Token');
    }
    // The response varies by request Origin, so caches must key on it.
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

app.get('/docs-json', (_req: Request, res: Response) => res.json(swaggerSpec));

// Health check for load balancer / monitoring
app.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok' }));


app.use('/help', globalLimiter, verifyUser, helpRouter)
app.use('/auth', authLimiter, authRouter);
app.use('/organizer/tournament', globalLimiter, verifyUser, organizerTournamentRouter);
app.use('/coach', globalLimiter, verifyUser, coachRouter);
app.use('/score', globalLimiter, scorerRouter);
app.use('/webhooks', globalLimiter, express.text({ type: '*/*' }), webhookRouter);

app.use(express.static('public'));

app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


// Global error handler — catches anything thrown from route handlers
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof DbError) {
        console.error(err.message);
        return res.status(500).json({ message: 'Database error' });
    }
    console.error(err);
    return res.status(500).json({ message: 'Internal server error' });
});

export default app