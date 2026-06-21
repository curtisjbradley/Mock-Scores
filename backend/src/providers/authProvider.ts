import { dbQuery } from '../db';
import bcrypt from 'bcrypt';
import { signToken } from '../authUtils';
import type { IAuthRow } from '../types/dbtypes';
import { AlreadyExistsError, DbError } from '../errors';

interface IStatusResponse { status: number; message: string; }

export class AuthProvider {
    async registerUser(email: string, password: string, firstName: string, lastName: string): Promise<IStatusResponse> {
        const existing = await dbQuery('SELECT user_id FROM auth WHERE email = $1', [email]);
        if (existing === null) throw new DbError('registerUser lookup');
        if (existing.rows.length > 0) throw new AlreadyExistsError('email');

        const passwordHash = await bcrypt.hash(password, 10);
        const result = (await dbQuery<{ user_id: string }>(
            'INSERT INTO auth (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING user_id',
            [email, passwordHash, firstName, lastName],
        ))?.rows[0];
        if (!result) throw new DbError('registerUser insert');

        const pendingTournamentInvites = await dbQuery<{ tournament_id: string }>(
            'DELETE FROM tournament_delegate_invites WHERE email = $1 RETURNING tournament_id', [email]
        );
        if (!pendingTournamentInvites) throw new DbError('registerUser tournament invites');
        pendingTournamentInvites.rows.forEach(row =>
            dbQuery('INSERT INTO tournament_owners (tournament_id, delegate_id, role) VALUES ($1, $2, $3)', [row.tournament_id, result.user_id, 'delegate'])
        );

        const pendingTeamInvites = await dbQuery<{ team_id: string }>(
            'DELETE FROM team_invites WHERE invite_email = $1 RETURNING team_id', [email]
        );
        if (!pendingTeamInvites) throw new DbError('registerUser team invites');
        pendingTeamInvites.rows.forEach(row =>
            dbQuery('INSERT INTO team_coaches (team_id, coach_id, is_owner) VALUES ($1, $2, $3)', [row.team_id, result.user_id, 'delegate'])
        );

        return { status: 201, message: 'User Created' };
    }

    async loginUser(email: string, password: string): Promise<IStatusResponse | string> {
        const result = await dbQuery<IAuthRow>(
            'SELECT user_id, email, password_hash, first_name, last_name FROM auth WHERE email = $1', [email]
        );
        if (result === null) throw new DbError('loginUser');
        const user = result.rows[0];
        if (!user || !(await bcrypt.compare(password, user.password_hash)))
            return { status: 401, message: 'Invalid Username / Password' };
        return signToken(user.user_id, user.email, user.first_name, user.last_name);
    }

    async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<IStatusResponse> {
        const result = await dbQuery<IAuthRow>('SELECT password_hash FROM auth WHERE user_id=$1', [userId]);
        if (!result) throw new DbError('changePassword lookup');
        const user = result.rows[0];
        if (!user || !(await bcrypt.compare(currentPassword, user.password_hash)))
            return { status: 401, message: 'Current password is incorrect' };
        const hash = await bcrypt.hash(newPassword, 10);
        const updated = await dbQuery('UPDATE auth SET password_hash=$1 WHERE user_id=$2', [hash, userId]);
        if (!updated) throw new DbError('changePassword update');
        return { status: 200, message: 'Password updated' };
    }
}
