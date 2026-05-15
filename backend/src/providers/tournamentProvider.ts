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

export interface ITournamentFull extends ITournament {
    pWitnessNames: string[];
    dWitnessNames: string[];
    swingWitnessNames: string[];
    scoringCategories: IScoringCategoryFull[];
}

interface IWitnessRow {
    side: string;
    name: string;
}

interface ICategoryRow {
    id: string;
    name: string;
    witness_category: boolean;
    position: number;
}

interface IFieldRow {
    id: string;
    category_id: string;
    label: string;
    min_score: number;
    max_score: number;
    multiplier: number;
    assignable: boolean;
    eligible_for_award: boolean;
    visible_to_scorers: boolean;
    prosecution: boolean;
    defense: boolean;
    calling: boolean;
    crossing: boolean;
    position: number;
}

export interface IScoringFieldFull {
    id: string;
    label: string;
    min: number;
    max: number;
    multiplier: number;
    assignable: boolean;
    eligibleForAward: boolean;
    visibleToScorers: boolean;
    prosecution: boolean;
    defense: boolean;
    calling: boolean;
    crossing: boolean;
}

export interface IScoringCategoryFull {
    id: string;
    name: string;
    witnessCategory: boolean;
    position: number;
    fields: IScoringFieldFull[];
}

export class TournamentProvider {

    private async insertWitnesses(tournamentID: string, cf: TournamentPayload['caseFormat']): Promise<void> {
        const witnesses: [string, string][] = [
            ...cf.pWitnessNames.map(n => ['P', n] as [string, string]),
            ...cf.dWitnessNames.map(n => ['D', n] as [string, string]),
            ...(cf.hasSwing ? cf.swingWitnessNames.map(n => ['SWING', n] as [string, string]) : []),
        ];
        await Promise.all(witnesses.map(([side, name]) =>
            dbQuery('INSERT INTO case_witnesses (tournament_id, side, name) VALUES ($1,$2,$3)', [tournamentID, side, name])
        ));
    }

    private async insertCategories(tournamentID: string, categories: TournamentPayload['scoringCategories']): Promise<void> {
        await Promise.all(categories.map(async category => {
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
    }

    async getTournaments(userId: string): Promise<ITournament[] | null> {
        const result = await dbQuery<ITournament>(
            'SELECT * FROM tournaments WHERE id IN (SELECT tournament_id FROM tournament_owners WHERE delegate_id = $1)',
            [userId]
        );
        return result ? result.rows : null;
    }

    async getTournament(tournamentID: string): Promise<ITournamentFull | null> {
        const t = await dbQuery<ITournament>('SELECT * FROM tournaments WHERE id = $1', [tournamentID]);
        const row = t?.rows[0];
        if (!row) return null;

        const witnesses = await dbQuery<IWitnessRow>(
            'SELECT side, name FROM case_witnesses WHERE tournament_id=$1', [tournamentID]
        );
        const cats = await dbQuery<ICategoryRow>(
            'SELECT id, name, witness_category, position FROM scoring_categories WHERE tournament_id=$1 ORDER BY position', [tournamentID]
        );
        const catIds = cats?.rows.map(c => c.id) ?? [];
        const fields = catIds.length > 0
            ? await dbQuery<IFieldRow>(
                `SELECT id, category_id, label, min_score, max_score, multiplier, assignable, eligible_for_award, visible_to_scorers, prosecution, defense, calling, crossing, position FROM scoring_fields WHERE category_id IN (${catIds.map((_,i) => `$${i+1}`).join(',')}) ORDER BY position`,
                catIds
              )
            : null;

        const ws = witnesses?.rows ?? [];
        return {
            ...row,
            pWitnessNames: ws.filter(w => w.side === 'P').map(w => w.name),
            dWitnessNames: ws.filter(w => w.side === 'D').map(w => w.name),
            swingWitnessNames: ws.filter(w => w.side === 'SWING').map(w => w.name),
            scoringCategories: (cats?.rows ?? []).map(c => ({
                id: c.id,
                name: c.name,
                witnessCategory: c.witness_category,
                position: c.position,
                fields: (fields?.rows ?? []).filter(f => f.category_id === c.id).map(f => ({
                    id: f.id,
                    label: f.label,
                    min: f.min_score,
                    max: f.max_score,
                    multiplier: f.multiplier,
                    assignable: f.assignable,
                    eligibleForAward: f.eligible_for_award,
                    visibleToScorers: f.visible_to_scorers,
                    prosecution: f.prosecution,
                    defense: f.defense,
                    calling: f.calling,
                    crossing: f.crossing,
                })),
            })),
        };
    }

    async createTournament(tournament: TournamentPayload): Promise<ITournament | null> {
        const tournamentID = randomUUID();
        const { tournament: t, caseFormat: cf } = tournament;

        const insertion = await dbQuery(
            'INSERT INTO tournaments (id, name, location, start_date, end_date, case_name, criminal_case, p_witnesses_called, d_witnesses_called) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
            [tournamentID, t.name, t.location, t.startDate, t.endDate, cf.caseName, cf.criminalCase, cf.pWitnessesCalled, cf.dWitnessesCalled]
        );
        if (!insertion || insertion.rowCount !== 1) return null;

        await this.insertWitnesses(tournamentID, cf);
        await this.insertCategories(tournamentID, tournament.scoringCategories);

        const created = await dbQuery<ITournament>('SELECT * FROM tournaments WHERE id = $1', [tournamentID]);
        return created ? (created.rows[0] ?? null) : null;
    }

    async updateTournament(tournamentID: string, tournament: TournamentPayload): Promise<boolean> {
        const { tournament: t, caseFormat: cf } = tournament;

        const updated = await dbQuery(
            'UPDATE tournaments SET name=$1, location=$2, start_date=$3, end_date=$4, case_name=$5, criminal_case=$6, p_witnesses_called=$7, d_witnesses_called=$8, has_swing=$9 WHERE id=$10',
            [t.name, t.location, t.startDate, t.endDate, cf.caseName, cf.criminalCase, cf.pWitnessesCalled, cf.dWitnessesCalled, cf.hasSwing, tournamentID]
        );
        if (!updated || updated.rowCount !== 1) return false;

        await dbQuery('DELETE FROM case_witnesses WHERE tournament_id=$1', [tournamentID]);
        await this.insertWitnesses(tournamentID, cf);

        await dbQuery('DELETE FROM scoring_fields WHERE category_id IN (SELECT id FROM scoring_categories WHERE tournament_id=$1)', [tournamentID]);
        await dbQuery('DELETE FROM scoring_categories WHERE tournament_id=$1', [tournamentID]);
        await this.insertCategories(tournamentID, tournament.scoringCategories);

        return true;
    }

    async addTournamentOrganizer(tournamentID: string, userId: string, role: 'owner' | 'delegate'): Promise<boolean> {
        const result = await dbQuery(
            'INSERT INTO tournament_owners (tournament_id, delegate_id, role) VALUES ($1,$2,$3)',
            [tournamentID, userId, role]
        );
        return result !== null;
    }
}
