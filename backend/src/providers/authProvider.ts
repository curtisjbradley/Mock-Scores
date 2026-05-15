import { dbQuery } from '../db';
import bcrypt from 'bcrypt';
import { signToken } from '../authUtils';
import {randomUUID} from "node:crypto";

interface IUser { user_id: string; email: string; first_name: string; last_name: string; password_hash: string; }
interface IStatusResponse { status: number; message: string; }

export class AuthProvider {
    async registerUser(email: string, password: string, firstName: string, lastName: string): Promise<IStatusResponse> {
        const existing = await dbQuery('SELECT user_id FROM auth WHERE email = $1', [email]);
        if (existing === null) return { status: 500, message: 'Internal error' };
        if (existing.rows.length > 0) return { status: 409, message: 'Email already in use' };

        const passwordHash = await bcrypt.hash(password, 10);

        const userID = randomUUID();

        const result = await dbQuery(
            'INSERT INTO auth (user_id, email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4, $5)',
            [userID, email, passwordHash, firstName, lastName],
        );

        //Get all pending organizer invites, and add them to the tournament
        const pendingTournamentInvites = await dbQuery<{tournament: string}>("DELETE from tournament_delegate_invites where email = $1 RETURNING tournament_id", [email]);

        if(!pendingTournamentInvites) return { status: 500, message: 'Internal error' };

        // Add user to all pending tournament organizer invites
        pendingTournamentInvites.rows.forEach(row => dbQuery("INSERT INTO tournament_owners (tournament_id, delegate_id, role) VALUES ($1, $2, $3)",[row.tournament,email,'delegate']));

        const pendingTeamInvites = await dbQuery<{team_id: string}>("DELETE from team_invites where invite_email = $1 RETURNING team_id", [email]);

        if(!pendingTeamInvites) return { status: 500, message: 'Internal error' };

        pendingTeamInvites.rows.forEach(row => dbQuery("INSERT INTO team_coaches (team_id, coach_id, is_owner) VALUES ($1, $2, $3)",[row.team_id,userID,'delegate']));


        return result === null
            ? { status: 500, message: 'Internal error' }
            : { status: 201, message: 'User Created' };
    }

    async loginUser(email: string, password: string): Promise<IStatusResponse | string> {
        const result = await dbQuery<IUser>(
            'SELECT user_id, email, password_hash, first_name, last_name FROM auth WHERE email = $1', [email]
        );
        if (result === null) return { status: 500, message: 'Internal error' };

        const user = result.rows[0];
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return { status: 401, message: 'Invalid Username / Password' };
        }
        return signToken(user.user_id, user.email, user.first_name, user.last_name);
    }
}
