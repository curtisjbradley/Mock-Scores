import express, { NextFunction, Request, Response } from "express";
import path from "path";
import dotenv from 'dotenv';
import {expand} from 'dotenv-expand'
const env = dotenv.config({ path: path.resolve(__dirname, '../.env') });
expand(env)
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swaggerConfig';
import authRouter from './routes/authRoutes';
import webhookRouter from "./routes/webhookRouter";
import organizerTournamentRouter from './routes/organizer/organizerRoutes';
import coachRouter from "./routes/coach/coachRoutes";
import { verifyUser } from "./authUtils";
import { DbError } from "./errors";
import RateLimit from 'express-rate-limit';

const app = express();
app.set('trust proxy', 1);

const STATIC_DIR = path.resolve(__dirname, "../../frontend/dist");
const PUBLIC_DIR = path.resolve(__dirname, "../../frontend/public");

// Global rate limit applied before all routes
const globalLimiter = RateLimit({ windowMs: 500, max: 20, skip: () => process.env.NODE_ENV === 'test' });
app.use(globalLimiter);

// Stricter limit for auth endpoints to mitigate brute-force attacks
const authLimiter = RateLimit({ windowMs: 30 * 1000, max: 20, skip: () => process.env.NODE_ENV === 'test' });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs-json', (_req: Request, res: Response) => res.json(swaggerSpec));

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/organizer/tournament',verifyUser, organizerTournamentRouter);
app.use('/api/coach', verifyUser, coachRouter);



app.use(express.static(PUBLIC_DIR));
app.use(express.static(STATIC_DIR));


app.use('/webhooks', express.text({ type: '*/*' }))
app.use("/webhooks", webhookRouter);


app.get(/(.*)/, (_req: Request, res: Response) => {
    res.sendFile(path.join(STATIC_DIR, "index.html"));
});

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