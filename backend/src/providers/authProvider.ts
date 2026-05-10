import { Request } from "express";
import db from "../db";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { SignJWT, jwtVerify } from 'jose';

interface IUser { userid: string; email: string; }
interface IStatusResponse { status: number; message: string; }

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "JWT_SECRET");
const JWT_EXPIRY = process.env.JWT_EXPIRY ?? '7d';

export class AuthProvider {

    async signToken(userId: string, email: string): Promise<string> {
        return new SignJWT({ userId, email })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime(JWT_EXPIRY)
            .sign(JWT_SECRET);
    }

    async verifyToken(token: string): Promise<{ userId: string; email: string } | null> {
        try {
            const { payload } = await jwtVerify(token, JWT_SECRET);
            return { userId: payload.userId as string, email: payload.email as string };
        } catch {
            return null;
        }
    }

    bearerToken(req: Request): string | undefined {
        const auth = req.headers.authorization;
        return auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
    }

    async registerUser(email: string, password: string): Promise<IStatusResponse> {
        const existing = await db.query('SELECT userid FROM auth WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return { status: 409, message: 'Email already in use' };
        }
        const passwordHash : string = await bcrypt.hash(password, 10);
        await db.query('INSERT INTO auth (userid, email, password) VALUES ($1, $2, $3)',
            [crypto.randomUUID().toString(), email, passwordHash]).catch(() => {
                return { status: 500, message: 'Internal error' };
        })
        return { status: 201, message: 'User Created' };
    }

    async loginUser(email: string, password: string): Promise<IStatusResponse | string> {
        const result = await db.query<IUser & { password: string }>(
            'SELECT userid, email, password FROM auth WHERE email = $1', [email]
        );
        const user = result.rows[0];
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return { status: 401, message: 'Invalid Username / Password' };
        }
        return this.signToken(user.userid, user.email);
    }
}
