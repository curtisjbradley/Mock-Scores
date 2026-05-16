import { Router, Request, Response } from 'express';
import {AuthProvider} from "../providers/authProvider";

import {verifyUser} from "../authUtils";

const router = Router();


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

export default router;
