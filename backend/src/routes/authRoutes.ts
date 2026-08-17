import { Router, Request, Response } from 'express';
import { AuthProvider } from '../providers/authProvider';
import { verifyUser, REFRESH_COOKIE, CSRF_COOKIE, refreshCookieOptions, csrfCookieOptions, generateCsrfToken } from '../authUtils';
import { AlreadyExistsError, DbError, NotFoundError } from '../errors';
import { OAuth2Client } from 'google-auth-library';
import { GOOGLE_CLIENT_ID, validatePassword, ValidationError } from '@mock-scores/shared';
import { EmailTemplate, emailVerificationEmail, isValidEmail, passwordChangedEmail, passwordResetEmail, sendEmail, welcomeEmail } from '../email';

const router = Router();
const authProvider = new AuthProvider();
const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// ── Helpers ───────────────────────────────────────────────────────────────────

function fireAndForgetEmail(fn: () => void): void {
    Promise.resolve().then(fn).catch((err: Error) => console.error(err));
}

function extractNameFromPayload(
    payload: { given_name?: string; family_name?: string; name?: string },
): { firstName: string; lastName: string } {
    const firstName = payload.given_name ?? payload.name?.split(' ')[0] ?? '';
    const lastName  = payload.family_name ?? payload.name?.split(' ').slice(1).join(' ') ?? '';
    return { firstName, lastName };
}

/**
 * Sets the refresh token as an HttpOnly cookie, sets a readable CSRF token
 * cookie (double-submit pattern), and returns the access token in the JSON body.
 *
 * Security properties:
 * - The refresh token cookie is unreadable by JS (`httpOnly: true`).
 * - The CSRF token cookie is readable by JS (`httpOnly: false`) so the frontend
 *   can echo it as an `X-CSRF-Token` header on refresh requests.
 * - The server verifies header === cookie on every /refresh call, blocking any
 *   cross-origin request that cannot read the cookie (i.e. all of them).
 */
function sendAuthResponse(
    res: Response,
    accessToken: string,
    refreshToken: string,
): Response {
    const csrfToken = generateCsrfToken();
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
    res.cookie(CSRF_COOKIE, csrfToken, csrfCookieOptions());
    return res.status(200).json({ accessToken });
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/register:
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
 *       400: { description: Missing or invalid fields }
 *       409: { description: Email already in use }
 *       500: { description: Internal error }
 */
router.post('/register', async (req: Request, res: Response) => {
    const { email, password, firstName, lastName } = req.body as {
        email?: string; password?: string; firstName?: string; lastName?: string;
    };
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
    if (!isValidEmail(email)) return res.status(400).json({ message: 'Invalid email address.' });
    if (!firstName?.trim() || !lastName?.trim()) return res.status(400).json({ message: 'First and last name are required.' });
    try {
        validatePassword(password);
        const response = await authProvider.registerUser(email, password, firstName.trim(), lastName.trim());
        if (response.status.toString().startsWith('2')) {
            fireAndForgetEmail(() => {
                const template = welcomeEmail(firstName);
                sendEmail(email, template.subject, template.html, template.text);
            });
            // Send verification email (fire-and-forget)
            authProvider.createEmailVerificationTokenByEmail(email)
                .then(result => {
                    if (result) {
                        const verifyUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/verify-email?token=${result.token}`;
                        const template = emailVerificationEmail(result.firstName, verifyUrl);
                        sendEmail(email, template.subject, template.html, template.text);
                    }
                })
                .catch((err: Error) => console.error('Verification email error:', err));
        }
        return res.status(response.status).json({ message: response.message });
    } catch (e) {
        if (e instanceof ValidationError)   return res.status(400).json({ message: e.message });
        if (e instanceof AlreadyExistsError) return res.status(409).json({ message: 'Email already in use' });
        if (e instanceof DbError)            return res.status(500).json({ message: 'Internal error' });
        throw e;
    }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Log in with email + password
 *     tags: [Auth]
 *     security: []
 *     description: >
 *       Returns a short-lived access token in the JSON body and sets a
 *       long-lived HttpOnly refresh token cookie (`rt`). The access token
 *       should be stored only in JavaScript memory — never in localStorage.
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
 *         description: Access token + HttpOnly refresh cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken: { type: string }
 *       400: { description: Missing credentials }
 *       401: { description: Invalid credentials }
 *       500: { description: Internal error }
 */
router.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
    if (!isValidEmail(email)) return res.status(400).json({ message: 'Invalid email address.' });
    try {
        const result = await authProvider.loginUser(email, password);
        if ('status' in result) return res.status(result.status).json({ message: result.message });
        return sendAuthResponse(res, result.accessToken, result.refreshToken);
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Internal error' });
        throw e;
    }
});

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Silently refresh the access token using the HttpOnly refresh cookie
 *     tags: [Auth]
 *     security: []
 *     description: >
 *       Reads the `rt` HttpOnly cookie, validates it, rotates it (single-use),
 *       and returns a fresh access token + new refresh cookie.
 *     responses:
 *       200:
 *         description: New access token + rotated refresh cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken: { type: string }
 *       401: { description: Missing or invalid refresh token }
 */
router.post('/refresh', async (req: Request, res: Response) => {
    const rawToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!rawToken) return res.status(401).json({ message: 'No refresh token provided.' });

    // Double-submit CSRF check: the frontend must echo the csrf_token cookie
    // value as an X-CSRF-Token header. A cross-origin attacker cannot read the
    // cookie so they cannot forge this header.
    // Skipped in test environment (same pattern as rate limiting).
    if (process.env.NODE_ENV !== 'test') {
        const csrfCookie = req.cookies?.[CSRF_COOKIE] as string | undefined;
        const csrfHeader = req.headers['x-csrf-token'] as string | undefined;
        if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
            return res.status(403).json({ message: 'Invalid CSRF token.' });
        }
    }

    try {
        const tokens = await authProvider.refreshSession(rawToken);
        if (!tokens) {
            res.clearCookie(REFRESH_COOKIE, { path: '/' });
            res.clearCookie(CSRF_COOKIE, { path: '/' });
            return res.status(401).json({ message: 'Session expired. Please log in again.' });
        }
        return sendAuthResponse(res, tokens.accessToken, tokens.refreshToken);
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Internal error' });
        throw e;
    }
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Revoke the refresh token and clear the cookie
 *     tags: [Auth]
 *     responses:
 *       204: { description: Logged out }
 */
router.post('/logout', async (req: Request, res: Response) => {
    const rawToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (rawToken) {
        try {
            await authProvider.revokeRefreshToken(rawToken);
        } catch {
            // Best-effort: always clear the cookie regardless
        }
    }
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    res.clearCookie(CSRF_COOKIE, { path: '/' });
    return res.status(204).send();
});

/**
 * @swagger
 * /auth/session:
 *   get:
 *     summary: Get current session info (requires valid access token)
 *     tags: [Auth]
 *     responses:
 *       200: { description: Session payload }
 *       401: { description: Not authenticated }
 */
router.get('/session', verifyUser, (req: Request, res: Response) => {
    if (!req.session) return res.status(401).json({ message: 'Not verified.' });
    return res.status(200).json(req.session);
});

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Change the authenticated user's password
 *     tags: [Auth]
 *     description: Also revokes all refresh tokens, requiring a fresh login on all devices.
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
 *       400: { description: Missing fields or password too weak }
 *       401: { description: Not authenticated or wrong current password }
 *       500: { description: Internal error }
 */
router.post('/change-password', verifyUser, async (req: Request, res: Response) => {
    if (!req.session) return res.status(401).json({ message: 'Not verified.' });
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Missing required fields' });
    try {
        validatePassword(newPassword);
        const result = await authProvider.changePassword(req.session.userId, currentPassword, newPassword);
        if (result.status === 200) {
            // Clear the caller's refresh cookie — they'll need to log in again
            res.clearCookie(REFRESH_COOKIE, { path: '/' });
            const { email, firstName } = req.session;
            fireAndForgetEmail(() => {
                const template: EmailTemplate = passwordChangedEmail(firstName ?? '');
                sendEmail(email, template.subject, template.html, template.text);
            });
        }
        return res.status(result.status).json({ message: result.message });
    } catch (e) {
        if (e instanceof ValidationError) return res.status(400).json({ message: e.message });
        if (e instanceof DbError)         return res.status(500).json({ message: 'Internal error' });
        throw e;
    }
});

/**
 * @swagger
 * /auth/account:
 *   delete:
 *     summary: Permanently delete the authenticated user's account
 *     tags: [Auth]
 *     description: >
 *       Deletes the user's account and all associated data (refresh tokens,
 *       reset tokens, tournament ownership, team coaching). CASCADE constraints
 *       handle dependent rows. Clears auth cookies on success.
 *     responses:
 *       204: { description: Account deleted }
 *       401: { description: Not authenticated }
 *       404: { description: Account not found }
 *       500: { description: Internal error }
 */
router.delete('/account', verifyUser, async (req: Request, res: Response) => {
    if (!req.session) return res.status(401).json({ message: 'Not verified.' });
    try {
        await authProvider.deleteAccount(req.session.userId);
        res.clearCookie(REFRESH_COOKIE, { path: '/' });
        res.clearCookie(CSRF_COOKIE, { path: '/' });
        return res.status(204).send();
    } catch (e) {
        if (e instanceof NotFoundError) return res.status(404).json({ message: 'Account not found' });
        if (e instanceof DbError)       return res.status(500).json({ message: 'Internal error' });
        throw e;
    }
});


/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset email
 *     tags: [Auth]
 *     security: []
 *     description: >
 *       Sends a password reset link to the given email address. Always returns
 *       200 regardless of whether the email exists (no information leakage).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: Reset email sent (or silently ignored if email unknown) }
 *       400: { description: Missing or invalid email }
 *       500: { description: Internal error }
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
    const { email } = req.body as { email?: string };
    if (!email) return res.status(400).json({ message: 'Email is required.' });
    if (!isValidEmail(email)) return res.status(400).json({ message: 'Invalid email address.' });
    try {
        const result = await authProvider.createPasswordResetToken(email);
        if (result) {
            const resetUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/reset-password?token=${result.token}`;
            fireAndForgetEmail(() => {
                const template = passwordResetEmail(result.firstName, resetUrl);
                sendEmail(result.email, template.subject, template.html, template.text);
            });
        }
        // Always return 200 to prevent email enumeration
        return res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' });
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Internal error' });
        throw e;
    }
});

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password using a token from the reset email
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Password has been reset }
 *       400: { description: Invalid/expired token or weak password }
 *       500: { description: Internal error }
 */
router.post('/reset-password', async (req: Request, res: Response) => {
    const { token, newPassword } = req.body as { token?: string; newPassword?: string };
    if (!token || !newPassword) return res.status(400).json({ message: 'Token and new password are required.' });
    try {
        validatePassword(newPassword);
        const result = await authProvider.resetPassword(token, newPassword);
        return res.status(result.status).json({ message: result.message });
    } catch (e) {
        if (e instanceof ValidationError) return res.status(400).json({ message: e.message });
        if (e instanceof DbError) return res.status(500).json({ message: 'Internal error' });
        throw e;
    }
});

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: Verify a user's email address using a token from the verification email
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
 *       200: { description: Email verified successfully }
 *       400: { description: Invalid or expired verification token }
 *       500: { description: Internal error }
 */
router.post('/verify-email', async (req: Request, res: Response) => {
    const { token } = req.body as { token?: string };
    if (!token) return res.status(400).json({ message: 'Verification token is required.' });
    try {
        const result = await authProvider.verifyEmail(token);
        return res.status(result.status).json({ message: result.message });
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Internal error' });
        throw e;
    }
});

/**
 * @swagger
 * /auth/resend-verification:
 *   post:
 *     summary: Resend the email verification link (requires authentication)
 *     tags: [Auth]
 *     responses:
 *       200: { description: Verification email sent (or already verified) }
 *       401: { description: Not authenticated }
 *       500: { description: Internal error }
 */
router.post('/resend-verification', verifyUser, async (req: Request, res: Response) => {
    if (!req.session) return res.status(401).json({ message: 'Not verified.' });
    try {
        const result = await authProvider.createEmailVerificationTokenByEmail(req.session.email);
        if (!result) {
            return res.status(200).json({ message: 'Email is already verified.' });
        }
        const verifyUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/verify-email?token=${result.token}`;
        fireAndForgetEmail(() => {
            const template = emailVerificationEmail(result.firstName, verifyUrl);
            sendEmail(req.session!.email, template.subject, template.html, template.text);
        });
        return res.status(200).json({ message: 'Verification email sent.' });
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Internal error' });
        throw e;
    }
});

/**
 * @swagger
 * /auth/google/login:
 *   post:
 *     summary: Log in or register via Google OAuth
 *     tags: [Auth]
 *     security: []
 *     description: >
 *       Verifies the Google credential, finds or creates the user account, and
 *       returns the same access token + HttpOnly refresh cookie as /login.
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
 *       200: { description: Access token + HttpOnly refresh cookie }
 *       400: { description: Missing OAuth token }
 *       401: { description: Invalid OAuth token }
 *       500: { description: Internal error }
 */
router.post('/google/login', async (req: Request, res: Response) => {
    const { token } = req.body as { token?: string };
    if (!token) return res.status(400).json({ message: 'OAUTH Token is required.' });
    try {
        const ticket = await oauthClient.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        if (!payload?.email) return res.status(401).json({ message: 'Could not get email from OAuth.' });
        const { firstName, lastName } = extractNameFromPayload(payload);
        const tokens = await authProvider.googleAuth(payload.email, firstName, lastName);
        return sendAuthResponse(res, tokens.accessToken, tokens.refreshToken);
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Internal error' });
        return res.status(401).json({ message: 'Invalid OAuth token.' });
    }
});

export default router;
