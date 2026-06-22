import { Router, Request, Response } from 'express';
import { AuthProvider } from "../providers/authProvider";
import { verifyUser } from "../authUtils";
import { AlreadyExistsError, DbError } from '../errors';
import { OAuth2Client } from 'google-auth-library';
import {GOOGLE_CLIENT_ID} from '@mock-scores/shared'

const router = Router();
const authProvider = new AuthProvider();

const oathClient = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, firstName, lastName]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *     responses:
 *       201: { description: User registered }
 *       400: { description: Missing required fields }
 *       409: { description: Email already in use }
 *       500: { description: Internal error }
 */
router.post('/register', async (req: Request, res: Response) => {
    const { email, password, firstName, lastName } = req.body as {
        email?: string; password?: string; firstName?: string; lastName?: string;
    };
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
    if (!firstName?.trim() || !lastName?.trim()) return res.status(400).json({ message: 'First and last name are required.' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    if (!/[A-Z]/.test(password)) return res.status(400).json({ message: 'Password must contain at least one uppercase letter.' });
    if (!/[0-9]/.test(password)) return res.status(400).json({ message: 'Password must contain at least one number.' });
    try {
        const response = await authProvider.registerUser(email, password, firstName.trim(), lastName.trim());
        return res.status(response.status).json({ message: response.message });
    } catch (e) {
        if (e instanceof AlreadyExistsError) return res.status(409).json({ message: 'Email already in use' });
        if (e instanceof DbError) return res.status(500).json({ message: 'Internal error' });
        throw e;
    }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Log in and receive a JWT
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: JWT token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *       400: { description: Missing credentials }
 *       401: { description: Invalid credentials }
 *       500: { description: Internal error }
 */
router.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
    try {
        const response = await authProvider.loginUser(email, password);
        if (typeof response === 'string') return res.status(200).json({ token: response });
        return res.status(response.status).json({ message: response.message });
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Internal error' });
        throw e;
    }
});

/**
 * @swagger
 * /api/auth/session:
 *   get:
 *     summary: Get current session info
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Session payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId: { type: string }
 *                 email: { type: string }
 *                 firstName: { type: string }
 *                 lastName: { type: string }
 *       401: { description: Not authenticated }
 */
router.get('/session', verifyUser, async (req: Request, res: Response) => {
    if (!req.session) return res.status(401).json({ message: 'Not verified.' });
    return res.status(200).json(req.session);
});

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change the authenticated user's password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Password changed }
 *       400: { description: Missing fields or password too short }
 *       401: { description: Not authenticated }
 *       500: { description: Internal error }
 */
router.post('/change-password', verifyUser, async (req: Request, res: Response) => {
    if (!req.session) return res.status(401).json({ message: 'Not verified.' });
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Missing required fields' });
    if (newPassword.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    if (!/[A-Z]/.test(newPassword)) return res.status(400).json({ message: 'Password must contain at least one uppercase letter.' });
    if (!/[0-9]/.test(newPassword)) return res.status(400).json({ message: 'Password must contain at least one number.' });
    try {
        const result = await authProvider.changePassword(req.session.userId, currentPassword, newPassword);
        return res.status(result.status).json({ message: result.message });
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Internal error' });
        throw e;
    }
});



/**
 * @swagger
 * /api/auth/google/login:
 *   post:
 *     summary: Log in using Google OAUTH
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200:
 *         description: JWT token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *       400: { description: Missing OAUTH Token }
 *       401: { description: Invalid credentials }
 *       500: { description: Internal error }
 */
router.post('/google/login', async (req: Request, res: Response) => {
    const { token } = req.body as { token?: string };
    if (!token) return res.status(400).json({ message: 'OAUTH Token is required.' });
    try {
        const ticket = await oathClient.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        if (!payload?.email) return res.status(401).json({ message: 'Could not get email from OAuth.' });

        const firstName = payload.given_name ?? payload.name?.split(' ')[0] ?? '';
        const lastName = payload.family_name ?? payload.name?.split(' ').slice(1).join(' ') ?? '';

        const jwtToken = await authProvider.googleAuth(payload.email, firstName, lastName);
        return res.status(200).json({ token: jwtToken });
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Internal error' });
        return res.status(401).json({ message: 'Invalid OAuth token.' });
    }
});
export default router;
