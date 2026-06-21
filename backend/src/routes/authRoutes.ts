import { Router, Request, Response } from 'express';
import { AuthProvider } from "../providers/authProvider";
import { verifyUser } from "../authUtils";
import { AlreadyExistsError, DbError } from '../errors';

const router = Router();
const authProvider = new AuthProvider();

router.post('/register', async (req: Request, res: Response) => {
    const { email, password, firstName, lastName } = req.body as {
        email?: string; password?: string; firstName?: string; lastName?: string;
    };
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
    if (!firstName?.trim() || !lastName?.trim()) return res.status(400).json({ message: 'First and last name are required.' });
    try {
        const response = await authProvider.registerUser(email, password, firstName.trim(), lastName.trim());
        return res.status(response.status).json({ message: response.message });
    } catch (e) {
        if (e instanceof AlreadyExistsError) return res.status(409).json({ message: 'Email already in use' });
        if (e instanceof DbError) return res.status(500).json({ message: 'Internal error' });
        throw e;
    }
});

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

router.get('/session', verifyUser, async (req: Request, res: Response) => {
    if (!req.session) return res.status(401).json({ message: 'Not verified.' });
    return res.status(200).json(req.session);
});

router.post('/change-password', verifyUser, async (req: Request, res: Response) => {
    if (!req.session) return res.status(401).json({ message: 'Not verified.' });
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Missing required fields' });
    if (newPassword.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters' });
    try {
        const result = await authProvider.changePassword(req.session.userId, currentPassword, newPassword);
        return res.status(result.status).json({ message: result.message });
    } catch (e) {
        if (e instanceof DbError) return res.status(500).json({ message: 'Internal error' });
        throw e;
    }
});

export default router;
