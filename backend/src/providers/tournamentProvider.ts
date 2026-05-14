import { dbQuery } from '../db';
import type { TournamentPayload } from '@mock-scores/shared';
import { randomUUID } from 'node:crypto';

export interface ITournament {
    id: string;
    name: string;
    location: string;
    start_date?: Date;
    end_date?: Date;
    created_at?: Date;
    case_name: string;
    criminal_case: boolean;
    p_witnesses_called: number;
    d_witnesses_called: number;
    has_swing: boolean;
}

export class TournamentProvider {

    async getTournaments(userEmail: string): Promise<ITournament[] | null> {
        const result = await dbQuery<ITournament>(
            'SELECT * FROM tournaments WHERE id IN (SELECT tournament FROM tournament_owners WHERE delegate_email = $1)',
            [userEmail]
        );
        return result ? result.rows : null;
    }

    async getTournament(tournamentID: string): Promise<ITournament | null> {
        const result = await dbQuery<ITournament>('SELECT * FROM tournaments WHERE id = $1', [tournamentID]);
        return result ? (result.rows[0] ?? null) : null;
    }

    async createTournament(tournament: TournamentPayload): Promise<ITournament | null> {
        const tournamentID = randomUUID();

        const insertion = await dbQuery(
            'INSERT INTO tournaments (id, name, location, start_date, end_date, case_name, criminal_case, p_witnesses_called, d_witnesses_called) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
            [tournamentID, tournament.tournament.name, tournament.tournament.location,
             tournament.tournament.startDate, tournament.tournament.endDate,
             tournament.caseFormat.caseName, tournament.caseFormat.criminalCase,
             tournament.caseFormat.pWitnessesCalled, tournament.caseFormat.dWitnessesCalled]
        );
        if (!insertion || insertion.rowCount !== 1) return null;


        const witnesses: [string, string][] = [
            ...tournament.caseFormat.pWitnessNames.map(n => ['P', n] as [string, string]),
            ...tournament.caseFormat.dWitnessNames.map(n => ['D', n] as [string, string]),
            ...(tournament.caseFormat.hasSwing ? tournament.caseFormat.swingWitnessNames.map(n => ['SWING', n] as [string, string]) : []),
        ];
        await Promise.all(witnesses.map(([side, name]) =>
            dbQuery('INSERT INTO case_witnesses (tournament_id, side, name) VALUES ($1,$2,$3)', [tournamentID, side, name])
        ));

        await Promise.all(tournament.scoringCategories.map(async category => {
            const categoryID = randomUUID();
            await dbQuery(
                'INSERT INTO scoring_categories (id, tournament_id, name, witness_category, position) VALUES ($1,$2,$3,$4,$5)',
                [categoryID, tournamentID, category.name, category.witnessCategory, category.position]
            );
            await Promise.all(category.fields.map(f =>
                dbQuery(
                    'INSERT INTO scoring_fields (category_id, label, min_score, max_score, multiplier, assignable, eligible_for_award, visible_to_scorers, prosecution, defense, calling, crossing, position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
                    [categoryID, f.label, f.min, f.max, f.multiplier, f.assignable, f.eligibleForAward, f.visibleToScorers, f.prosecution, f.defense, f.calling, f.crossing, f.position]
                )
            ));
        }));

        const created = await dbQuery<ITournament>('SELECT * FROM tournaments WHERE id = $1', [tournamentID]);
        return created ? (created.rows[0] ?? null) : null;
    }

    async addTournamentOrganizer(tournamentID: string, delegateEmail: string, role: 'owner' | 'delegate'): Promise<boolean> {
        const result = await dbQuery(
            'INSERT INTO tournament_owners (tournament, delegate_email, role) VALUES ($1,$2,$3)',
            [tournamentID, delegateEmail, role]
        );
        return result !== null;
    }
}
