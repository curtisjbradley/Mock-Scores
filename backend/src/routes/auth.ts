import { Router, Request, Response } from 'express';
import {AuthProvider} from "../providers/authProvider";

const router = Router();


const authProvider = new AuthProvider();




router.post('/register', async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
        res.status(400).json({ message: 'Email and password are required.' });
        return;
    }
    authProvider.registerUser(email, password).then((response) => {
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

router.get('/session', async (req: Request, res: Response) => {
    authProvider.verifyToken(authProvider.bearerToken(req) ?? '' ).then((payload) => {
        if (!payload) {
            res.status(401).json({ message: 'Not authenticated.' });
            return;
        }
        res.json(payload);
    })
});

export default router;
