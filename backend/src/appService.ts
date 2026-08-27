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
app.use(cookieParser());

// CORS — allow any mockscores.org subdomain to make credentialed cross-origin requests
app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && (/^https:\/\/([a-z0-9-]+\.)?mockscores\.org$/.test(origin) || origin === 'http://localhost:5173')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-CSRF-Token');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/docs-json', (_req: Request, res: Response) => res.json(swaggerSpec));

// Health check for load balancer / monitoring
app.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok' }));

app.use('/auth', authLimiter, authRouter);
app.use('/organizer/tournament', globalLimiter, verifyUser, organizerTournamentRouter);
app.use('/coach', globalLimiter, verifyUser, coachRouter);
app.use('/score', globalLimiter, scorerRouter);
app.use('/webhooks', globalLimiter, express.text({ type: '*/*' }), webhookRouter);

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