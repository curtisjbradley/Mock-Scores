import { dbQuery } from '../db';
import bcrypt from 'bcrypt';
import { signToken } from '../authUtils';

interface IUser { userid: string; email: string; firstname: string; lastname: string; password: string; }
interface IStatusResponse { status: number; message: string; }

export class AuthProvider {
    async registerUser(email: string, password: string, firstName: string, lastName: string): Promise<IStatusResponse> {
        const existing = await dbQuery('SELECT userid FROM auth WHERE email = $1', [email]);
        if (existing === null) return { status: 500, message: 'Internal error' };
        if (existing.rows.length > 0) return { status: 409, message: 'Email already in use' };

        const passwordHash = await bcrypt.hash(password, 10);
        const result = await dbQuery(
            'INSERT INTO auth (email, password, firstname, lastname) VALUES ($1, $2, $3, $4)',
            [email, passwordHash, firstName, lastName],
        );
        return result === null
            ? { status: 500, message: 'Internal error' }
            : { status: 201, message: 'User Created' };
    }

    async loginUser(email: string, password: string): Promise<IStatusResponse | string> {
        const result = await dbQuery<IUser>(
            'SELECT userid, email, password, firstname, lastname FROM auth WHERE email = $1', [email]
        );
        if (result === null) return { status: 500, message: 'Internal error' };

        const user = result.rows[0];
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return { status: 401, message: 'Invalid Username / Password' };
        }
        return signToken(user.userid, user.email, user.firstname, user.lastname);
    }
}
