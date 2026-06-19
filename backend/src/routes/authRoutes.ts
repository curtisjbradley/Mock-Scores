import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import {AuthProvider} from "../providers/authProvider";

import {verifyUser} from "../authUtils";

const router = Router();

const changePasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
});


const authProvider = new AuthProvider();




router.post('/register', async (req: Request, res: Response) => {
    const { email, password, firstName, lastName } = req.body as {
        email?: string;
        password?: string;
        firstName?: string;
        lastName?: string;
    };
    if (!email || !password) {
        res.status(400).json({ message: 'Email and password are required.' });
        return;
    }
    if (!firstName?.trim() || !lastName?.trim()) {
        res.status(400).json({ message: 'First and last name are required.' });
        return;
    }
    authProvider.registerUser(email, password, firstName.trim(), lastName.trim()).then((response) => {
        res.status(response.status).json({message: response.message});
    })
});

router.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
        res.status(400).json({ message: 'Email and password are required.' });
        return;
    }

    authProvider.loginUser(email, password).then((response) => {
        if (typeof response == 'string') {
            res.status(200).json({token: response})
        } else {
            res.status(response.status).json({ message: response.message });
        }
    })
});

router.get('/session', verifyUser, async (req: Request, res: Response) => {
   if (!req.session) {
       return res.status(401).json({ message: 'Not verified.' });
   }
   return res.status(200).json(req.session);
});

router.post('/change-password', changePasswordLimiter, verifyUser, async (req: Request, res: Response) => {
    if (!req.session) return res.status(401).json({ message: 'Not verified.' });
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Missing required fields' });
    if (newPassword.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters' });
    const result = await authProvider.changePassword(req.session.userId, currentPassword, newPassword);
    return res.status(result.status).json({ message: result.message });
});

export default router;
