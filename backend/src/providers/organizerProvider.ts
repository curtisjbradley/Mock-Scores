import { dbQuery } from '../db';
import type {
    IScorer, TournamentPayload, ITournament, IOrganizer, IWitnesses, IScoringCategory, ICourtroom, ITeam,
    IRound
} from '@mock-scores/shared';
import type {
    ICaseWitnessRow,
    IScoringCategoryRow,
    IScoringFieldRow,
    IRoundRow,
    ITournamentOwnerRow,
    ITournamentDelegateInviteRow,
    IAuthRow,
    ICourtroomRow,
    ITournamentFormatRow,
    ITeamRow,
    IPairingRow
} from '../types/dbtypes';
import { randomUUID } from 'node:crypto';
import { DuplicateDelegateError, NotFoundError, OrganizerAlreadyJoinedError } from '../errors';

export class OrganizerProvider {

    private async insertWitnesses(formatID: string, cf: TournamentPayload['caseFormat']): Promise<void> {
        const witnesses: [string, string][] = [
            ...cf.pWitnessNames.map(n => ['P', n] as [string, string]),
            ...cf.dWitnessNames.map(n => ['D', n] as [string, string]),
            ...(cf.hasSwing ? cf.swingWitnessNames.map(n => ['S', n] as [string, string]) : []),
        ];
        await Promise.all(witnesses.map(([side, name]) =>
            dbQuery('INSERT INTO case_witnesses (case_format, side, name) VALUES ($1,$2,$3)', [formatID, side, name])
        ));
    }

    private async insertCategories(tournamentID: string, categories: TournamentPayload['scoringCategories']): Promise<void> {
        await Promise.all(categories.map(async cat => {
            const categoryID = randomUUID();
            await dbQuery(
                'INSERT INTO scoring_categories (id, tournament_id, name, witness_category, position) VALUES ($1,$2,$3,$4,$5)',
                [categoryID, tournamentID, cat.name, cat.witnessCategory, cat.position]
            );
            await Promise.all(cat.fields.map(f =>
                dbQuery(
                    'INSERT INTO scoring_fields (category_id, label, min_score, max_score, multiplier, assignable, eligible_for_award, visible_to_scorers, prosecution, defense, calling, crossing, position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
                    [categoryID, f.label, f.min, f.max, f.multiplier, f.assignable, f.eligibleForAward, f.visibleToScorers, f.prosecution, f.defense, f.calling, f.crossing, f.position]
                )
            ));
        }));
    }

    async getFormat(tournamentID: string): Promise<(ITournamentFormatRow & { case_format_id: string }) | null> {
        return (await dbQuery<ITournamentFormatRow & { case_format_id: string }>(
            `SELECT tf.*, t.case_format_id FROM tournaments t JOIN tournament_format tf ON tf.format_id = t.case_format_id WHERE t.id = $1`,
            [tournamentID]
        ))?.rows[0] ?? null
    }

    async updateFormat(tournamentID: string, format: TournamentPayload['caseFormat']): Promise<boolean> {
        const formatID = (await dbQuery<{ case_format_id: string }>('SELECT case_format_id FROM tournaments WHERE id=$1', [tournamentID]))?.rows[0]?.case_format_id
        if (!formatID) return false
        return !!(await dbQuery(
            'UPDATE tournament_format SET case_name=$1, criminal_case=$2, p_witnesses_called=$3, d_witnesses_called=$4, has_swing=$5 WHERE format_id=$6',
            [format.caseName, format.criminalCase, format.pWitnessesCalled, format.dWitnessesCalled, format.hasSwing, formatID]
        ))
    }

    async getWitnesses(tournamentID: string): Promise<IWitnesses | null> {
        const formatID = (await dbQuery<{ case_format_id: string }>('SELECT case_format_id FROM tournaments WHERE id=$1', [tournamentID]))?.rows[0]?.case_format_id
        if (!formatID) return null
        const rows = (await dbQuery<ICaseWitnessRow>('SELECT side, name FROM case_witnesses WHERE case_format=$1', [formatID]))?.rows ?? []
        return {
            pWitnessNames: rows.filter(w => w.side === 'P').map(w => w.name),
            dWitnessNames: rows.filter(w => w.side === 'D').map(w => w.name),
            swingWitnessNames: rows.filter(w => w.side === 'S').map(w => w.name),
        }
    }

    async updateWitnesses(tournamentID: string, witnesses: IWitnesses): Promise<boolean> {
        const formatID = (await dbQuery<{ case_format_id: string }>('SELECT case_format_id FROM tournaments WHERE id=$1', [tournamentID]))?.rows[0]?.case_format_id
        if (!formatID) return false
        await dbQuery('DELETE FROM case_witnesses WHERE case_format=$1', [formatID])
        const all: [string, string][] = [
            ...witnesses.pWitnessNames.map(n => ['P', n] as [string, string]),
            ...witnesses.dWitnessNames.map(n => ['D', n] as [string, string]),
            ...witnesses.swingWitnessNames.map(n => ['S', n] as [string, string]),
        ]
        await Promise.all(all.map(([side, name]) =>
            dbQuery('INSERT INTO case_witnesses (case_format, side, name) VALUES ($1,$2,$3)', [formatID, side, name])
        ))
        return true
    }

    async getScoringCategories(tournamentID: string): Promise<IScoringCategory[]> {
        const cats = (await dbQuery<IScoringCategoryRow>(
            'SELECT id, name, witness_category, position FROM scoring_categories WHERE tournament_id=$1 ORDER BY position', [tournamentID]
        ))?.rows ?? []
        const catIds = cats.map(c => c.id)
        const fields = catIds.length > 0
            ? (await dbQuery<IScoringFieldRow>(
                `SELECT id, category_id, label, min_score, max_score, multiplier, assignable, eligible_for_award, visible_to_scorers, prosecution, defense, calling, crossing, position
                 FROM scoring_fields WHERE category_id IN (${catIds.map((_, i) => `$${i + 1}`).join(',')}) ORDER BY position`,
                catIds
            ))?.rows ?? []
            : []
        return cats.map(c => ({
            id: c.id, name: c.name, witnessCategory: c.witness_category, position: c.position,
            fields: fields.filter(f => f.category_id === c.id).map(f => ({
                id: f.id, label: f.label, min: f.min_score, max: f.max_score,
                multiplier: Number(f.multiplier), assignable: f.assignable,
                eligibleForAward: f.eligible_for_award, visibleToScorers: f.visible_to_scorers,
                prosecution: f.prosecution, defense: f.defense, calling: f.calling, crossing: f.crossing,
            })),
        }))
    }

    async updateScoringCategories(tournamentID: string, categories: TournamentPayload['scoringCategories']): Promise<boolean> {
        await dbQuery('DELETE FROM scoring_fields WHERE category_id IN (SELECT id FROM scoring_categories WHERE tournament_id=$1)', [tournamentID])
        await dbQuery('DELETE FROM scoring_categories WHERE tournament_id=$1', [tournamentID])
        await this.insertCategories(tournamentID, categories)
        return true
    }

    async updateTournamentDetails(tournamentID: string, t: { name: string; location: string; startDate?: string | null; endDate?: string | null }): Promise<boolean> {
        const result = await dbQuery(
            'UPDATE tournaments SET name=$1, location=$2, start_date=$3, end_date=$4 WHERE id=$5',
            [t.name, t.location, t.startDate ?? null, t.endDate ?? null, tournamentID]
        );
        return !!(result && result.rowCount === 1);
    }

    async getStandingsConfig(tournamentID: string): Promise<{ id: string; statsXml: string; standingsXml: string } | null> {
        const r = await dbQuery<{ id: string; stats_xml: string; standings_xml: string }>(
            `SELECT sc.id, sc.stats_xml, sc.standings_xml
             FROM tournaments t JOIN standings_configs sc ON sc.id = t.standings_config_id
             WHERE t.id = $1`,
            [tournamentID]
        );
        if (!r?.rows[0]) return null;
        const { id, stats_xml, standings_xml } = r.rows[0];
        return { id, statsXml: stats_xml, standingsXml: standings_xml };
    }

    async upsertStandingsConfig(tournamentID: string, statsXml: string, standingsXml: string): Promise<boolean> {
        const existing = await dbQuery<{ standings_config_id: string | null }>(
            'SELECT standings_config_id FROM tournaments WHERE id=$1', [tournamentID]
        );
        const configId = existing?.rows[0]?.standings_config_id;

        if (configId) {
            // If this config is a template, create a new one instead of updating in place
            const isTemplate = !!(await dbQuery<{ id: string }>(
                'SELECT id FROM standings_templates WHERE config_id=$1 LIMIT 1', [configId]
            ))?.rows[0];

            if (isTemplate) {
                const row = (await dbQuery<{ id: string }>(
                    'INSERT INTO standings_configs (stats_xml, standings_xml) VALUES ($1,$2) RETURNING id',
                    [statsXml, standingsXml]
                ))?.rows[0];
                if (!row) return false;
                await dbQuery('UPDATE tournaments SET standings_config_id=$1 WHERE id=$2', [row.id, tournamentID]);
            } else {
                await dbQuery('UPDATE standings_configs SET stats_xml=$1, standings_xml=$2 WHERE id=$3', [statsXml, standingsXml, configId]);
            }
        } else {
            const row = (await dbQuery<{ id: string }>(
                'INSERT INTO standings_configs (stats_xml, standings_xml) VALUES ($1,$2) RETURNING id',
                [statsXml, standingsXml]
            ))?.rows[0];
            if (!row) return false;
            await dbQuery('UPDATE tournaments SET standings_config_id=$1 WHERE id=$2', [row.id, tournamentID]);
        }
        return true;
    }

    async getStandingsTemplates(): Promise<{ id: string; label: string; description: string; config_id: string }[]> {
        return (await dbQuery<{ id: string; label: string; description: string; config_id: string }>(
            'SELECT id, label, description, config_id FROM standings_templates ORDER BY label'
        ))?.rows ?? [];
    }

    async deleteTournament(tournamentID: string): Promise<boolean> {
        return !!(await dbQuery('DELETE FROM tournaments WHERE id=$1 RETURNING id', [tournamentID]))?.rows[0];
    }

    async getTournaments(userId: string): Promise<ITournament[] | null> {
        const result = await dbQuery<ITournament>(
            'SELECT * FROM tournaments WHERE id IN (SELECT tournament_id FROM tournament_owners WHERE delegate_id = $1)',
            [userId]
        );
        return result?.rows ?? null;
    }

    async getTournament(tournamentID: string): Promise<ITournament | undefined> {
        return (await dbQuery<ITournament>(
            `SELECT * from tournaments where id = $1`,
            [tournamentID]
        ))?.rows[0];


    }

    async createTournament(tournament: TournamentPayload): Promise<ITournament | null> {
        const tournamentID = randomUUID();
        const formatID = randomUUID();
        const { tournament: t, caseFormat: cf } = tournament;

        const formatInsert = await dbQuery(
            'INSERT INTO tournament_format (format_id, case_name, criminal_case, p_witnesses_called, d_witnesses_called, has_swing) VALUES ($1,$2,$3,$4,$5,$6)',
            [formatID, cf.caseName, cf.criminalCase, cf.pWitnessesCalled, cf.dWitnessesCalled, cf.hasSwing]
        );
        if (!formatInsert || formatInsert.rowCount !== 1) return null;

        const insertion = await dbQuery(
            'INSERT INTO tournaments (id, name, location, start_date, end_date, case_format_id, standings_config_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
            [tournamentID, t.name, t.location, t.startDate, t.endDate, formatID, tournament.standingsConfigId ?? null]
        );
        if (!insertion || insertion.rowCount !== 1) return null;

        await this.insertWitnesses(formatID, cf);
        await this.insertCategories(tournamentID, tournament.scoringCategories);

        return (await dbQuery<ITournament>('SELECT * FROM tournaments WHERE id = $1', [tournamentID]))?.rows[0] ?? null;
    }

    async updateTournament(tournamentID: string, tournament: TournamentPayload): Promise<boolean> {
        const { tournament: t, caseFormat: cf } = tournament;

        const updated = await dbQuery(
            'UPDATE tournaments SET name=$1, location=$2, start_date=$3, end_date=$4 WHERE id=$5',
            [t.name, t.location, t.startDate, t.endDate, tournamentID]
        );
        if (!updated || updated.rowCount !== 1) return false;

        const formatID = (await dbQuery<{ case_format_id: string }>('SELECT case_format_id FROM tournaments WHERE id=$1', [tournamentID]))?.rows[0]?.case_format_id;
        if (!formatID) return false;

        await dbQuery(
            'UPDATE tournament_format SET case_name=$1, criminal_case=$2, p_witnesses_called=$3, d_witnesses_called=$4, has_swing=$5 WHERE format_id=$6',
            [cf.caseName, cf.criminalCase, cf.pWitnessesCalled, cf.dWitnessesCalled, cf.hasSwing, formatID]
        );
        await dbQuery('DELETE FROM case_witnesses WHERE case_format=$1', [formatID]);
        await this.insertWitnesses(formatID, cf);
        await dbQuery('DELETE FROM scoring_fields WHERE category_id IN (SELECT id FROM scoring_categories WHERE tournament_id=$1)', [tournamentID]);
        await dbQuery('DELETE FROM scoring_categories WHERE tournament_id=$1', [tournamentID]);
        await this.insertCategories(tournamentID, tournament.scoringCategories);

        return true;
    }

    async addTournamentOrganizer(tournamentID: string, userId: string, role: 'owner' | 'delegate'): Promise<boolean> {
        return !!(await dbQuery('INSERT INTO tournament_owners (tournament_id, delegate_id, role) VALUES ($1,$2,$3)', [tournamentID, userId, role]));
    }

    async getScorers(tournamentID: string): Promise<IScorer[] | undefined> {
        return (await dbQuery<IScorer>('SELECT * FROM scorers WHERE tournament_id = $1', [tournamentID]))?.rows;
    }

    async addScorer(scorer: IScorer, tournamentId: string): Promise<boolean> {
        return !!(await dbQuery(
            'INSERT INTO scorers (scorer_id, tournament_id, first_name, last_name, email) VALUES ($1,$2,$3,$4,$5)',
            [scorer.scorer_id, tournamentId, scorer.first_name, scorer.last_name, scorer.email]
        ));
    }

    async updateScorer(scorer: IScorer, tournamentId: string): Promise<boolean> {
        return !!(await dbQuery(
            'UPDATE scorers SET tournament_id=$1, first_name=$2, last_name=$3, email=$4 WHERE scorer_id=$5',
            [tournamentId, scorer.first_name, scorer.last_name, scorer.email, scorer.scorer_id]
        ));
    }

    async deleteScorer(scorerId: string): Promise<boolean> {
        return !!(await dbQuery('DELETE FROM scorers WHERE scorer_id=$1', [scorerId]));
    }

    async getAllConflicts(tournamentId: string): Promise<{ scorer_id: string; team_id: string }[]> {
        return (await dbQuery<{ scorer_id: string; team_id: string }>(
            `SELECT sc.scorer_id, sc.team_id FROM scorer_conflicts sc
             JOIN scorers s ON s.scorer_id = sc.scorer_id
             WHERE s.tournament_id = $1`,
            [tournamentId]
        ))?.rows ?? [];
    }

    async getConflicts(scorerId: string): Promise<{ id: string; scorer_id: string; team_id: string; team_name: string }[]> {
        return (await dbQuery<{ id: string; scorer_id: string; team_id: string; team_name: string }>(
            `SELECT sc.id, sc.scorer_id, sc.team_id, t.name AS team_name
             FROM scorer_conflicts sc JOIN teams t ON t.id = sc.team_id
             WHERE sc.scorer_id = $1`,
            [scorerId]
        ))?.rows ?? [];
    }

    async addConflict(scorerId: string, teamId: string): Promise<{ id: string; scorer_id: string; team_id: string; team_name: string } | null> {
        const row = (await dbQuery<{ id: string; scorer_id: string; team_id: string; team_name: string }>(
            `INSERT INTO scorer_conflicts (scorer_id, team_id) VALUES ($1, $2)
             ON CONFLICT DO NOTHING
             RETURNING id, scorer_id, team_id,
               (SELECT name FROM teams WHERE id = $2) AS team_name`,
            [scorerId, teamId]
        ))?.rows[0];
        return row ?? null;
    }

    async removeConflict(scorerId: string, teamId: string): Promise<boolean> {
        return !!(await dbQuery(
            'DELETE FROM scorer_conflicts WHERE scorer_id=$1 AND team_id=$2',
            [scorerId, teamId]
        ));
    }

    async getOrganizers(tournamentID: string): Promise<IOrganizer[]> {
        const [active, invited] = await Promise.all([
            dbQuery<IOrganizer>(
                `SELECT tournament_owners.delegate_id AS id, auth.first_name || ' ' || auth.last_name AS name,
                        auth.email, tournament_owners.role, true AS has_joined
                 FROM tournament_owners JOIN auth ON tournament_owners.delegate_id = auth.user_id
                 WHERE tournament_id = $1`,
                [tournamentID]
            ),
            dbQuery<IOrganizer>(
                `SELECT id, name, email, 'delegate' AS role, false AS has_joined
                 FROM tournament_delegate_invites WHERE tournament_id = $1`,
                [tournamentID]
            ),
        ]);
        return [...(active?.rows ?? []), ...(invited?.rows ?? [])];
    }

    async addOrganizer(tournamentID: string, name: string, email: string, role: 'owner' | 'delegate'): Promise<IOrganizer | undefined> {
        const user = (await dbQuery<IAuthRow>('SELECT * FROM auth WHERE LOWER(email) = $1', [email.toLowerCase()]))?.rows[0];

        if (!user) {
            const existing = (await dbQuery<ITournamentDelegateInviteRow>(
                'SELECT id FROM tournament_delegate_invites WHERE tournament_id=$1 AND LOWER(email)=$2',
                [tournamentID, email.toLowerCase()]
            ))?.rows[0];
            if (existing) throw new DuplicateDelegateError();

            const row = (await dbQuery<ITournamentDelegateInviteRow>(
                'INSERT INTO tournament_delegate_invites (tournament_id, name, email) VALUES ($1,$2,$3) RETURNING *',
                [tournamentID, name, email]
            ))?.rows[0];
            return row ? { ...row, role: 'delegate', has_joined: false } : undefined;
        }

        const existing = (await dbQuery<ITournamentOwnerRow>(
            'SELECT tournament_id FROM tournament_owners WHERE tournament_id=$1 AND delegate_id=$2',
            [tournamentID, user.user_id]
        ))?.rows[0];
        if (existing) throw new DuplicateDelegateError();

        const row = (await dbQuery<ITournamentOwnerRow>(
            'INSERT INTO tournament_owners (tournament_id, delegate_id, role) VALUES ($1,$2,$3) RETURNING *',
            [tournamentID, user.user_id, role]
        ))?.rows[0];
        return row ? { ...row, name: `${user.first_name} ${user.last_name}`, email: user.email, has_joined: true } : undefined;
    }

    async updateOrganizer(organizer: IOrganizer): Promise<IOrganizer | undefined> {
        if (organizer.has_joined) throw new OrganizerAlreadyJoinedError();
        const row = (await dbQuery<ITournamentDelegateInviteRow>(
            'UPDATE tournament_delegate_invites SET email=$1, name=$2 WHERE id=$3 RETURNING *',
            [organizer.email, organizer.name, organizer.id]
        ))?.rows[0];
        return row ? { ...row, role: 'delegate', has_joined: false } : undefined;
    }

    async deleteOrganizer(organizer: IOrganizer): Promise<boolean> {
        if (organizer.has_joined) {
            return !!((await dbQuery<ITournamentOwnerRow>('DELETE FROM tournament_owners WHERE delegate_id=$1 RETURNING *', [organizer.id]))?.rows[0]);
        }
        return !!((await dbQuery<ITournamentDelegateInviteRow>('DELETE FROM tournament_delegate_invites WHERE id=$1 RETURNING *', [organizer.id]))?.rows[0]);
    }

    async getCourtrooms(tournamentId: string): Promise<ICourtroomRow[] | undefined> {
        return (await dbQuery<ICourtroomRow>('SELECT * FROM courtrooms WHERE tournament_id=$1', [tournamentId]))?.rows;
    }

    async addCourtroom(tournamentId: string, courtroom: ICourtroom): Promise<ICourtroomRow | undefined> {
        return (await dbQuery<ICourtroomRow>(
            'INSERT INTO courtrooms (id, tournament_id, name, location) VALUES ($1,$2,$3,$4) RETURNING *',
            [courtroom.id, tournamentId, courtroom.name, courtroom.location ?? null]
        ))?.rows[0];
    }

    async updateCourtroom(courtroom: ICourtroom): Promise<ICourtroomRow | undefined> {
        return (await dbQuery<ICourtroomRow>(
            'UPDATE courtrooms SET name=$1, location=$2 WHERE id=$3 RETURNING *',
            [courtroom.name, courtroom.location ?? null, courtroom.id]
        ))?.rows[0];
    }

    async deleteCourtroom(courtroomId: string): Promise<ICourtroomRow | undefined> {
        return (await dbQuery<ICourtroomRow>('DELETE FROM courtrooms WHERE id=$1 RETURNING *', [courtroomId]))?.rows[0];
    }

    async getRounds(tournamentId: string): Promise<IRoundRow[]> {
        return (await dbQuery<IRoundRow>('SELECT * FROM rounds WHERE tournament_id=$1 ORDER BY round_time', [tournamentId]))?.rows ?? [];
    }

    async getRound(tournamentID :string, roundID: string): Promise<IRoundRow | undefined> {
        return (await dbQuery<IRoundRow>('SELECT * FROM rounds WHERE round_id=$1 and tournament_id = $2', [roundID, tournamentID]))?.rows[0];
    }

    async getTeams(tournamentID: string): Promise<ITeam[]> {
        // Teams with a joined coach
        const joined = (await dbQuery<ITeam>(
            `SELECT t.id, t.tournament_id, t.name, t.code, a.email AS coach_email, true AS has_joined
             FROM teams t
             JOIN team_coaches tc ON tc.team_id = t.id AND tc.is_owner = true
             JOIN auth a ON a.user_id = tc.coach_id
             WHERE t.tournament_id = $1`,
            [tournamentID]
        ))?.rows ?? [];

        // Teams with only an invite (no joined coach)
        const invited = (await dbQuery<ITeam>(
            `SELECT t.id, t.tournament_id, t.name, t.code, ti.invite_email AS coach_email, false AS has_joined
             FROM teams t
             JOIN team_invites ti ON ti.team_id = t.id
             WHERE t.tournament_id = $1
               AND NOT EXISTS (SELECT 1 FROM team_coaches tc WHERE tc.team_id = t.id AND tc.is_owner = true)`,
            [tournamentID]
        ))?.rows ?? [];

        return [...joined, ...invited];
    }

    async teamNameExists(tournamentID: string, name: string, excludeId?: string): Promise<boolean> {
        const row = (await dbQuery<{ id: string }>(
            `SELECT id FROM teams WHERE tournament_id=$1 AND LOWER(name)=LOWER($2)${excludeId ? ' AND id != $3' : ''}`,
            excludeId ? [tournamentID, name, excludeId] : [tournamentID, name]
        ))?.rows[0];
        return !!row;
    }

    async addTeam(tournamentID: string, name: string, coachEmail: string, code: string): Promise<ITeam | undefined> {
        const teamId = randomUUID();
        const teamInsert = await dbQuery<ITeamRow>(
            'INSERT INTO teams (id, tournament_id, name, code) VALUES ($1,$2,$3,$4) RETURNING *',
            [teamId, tournamentID, name, code]
        );
        if (!teamInsert?.rows[0]) return undefined;

        const user = (await dbQuery<IAuthRow>('SELECT * FROM auth WHERE LOWER(email) = LOWER($1)', [coachEmail]))?.rows[0];

        if (!user) {
            await dbQuery('INSERT INTO team_invites (team_id, invite_email) VALUES ($1,$2)', [teamId, coachEmail]);
            return { id: teamId, tournament_id: tournamentID, name, code, coach_email: coachEmail, has_joined: false };
        }

        await dbQuery('INSERT INTO team_coaches (coach_id, team_id, is_owner) VALUES ($1,$2,$3)', [user.user_id, teamId, true]);
        return { id: teamId, tournament_id: tournamentID, name, code, coach_email: user.email, has_joined: true };
    }

    async updateTeam(teamId: string, name: string, coachEmail: string, code: string): Promise<ITeam | undefined> {
        const team = (await dbQuery<ITeamRow>('SELECT * FROM teams WHERE id=$1', [teamId]))?.rows[0];
        if (!team) throw new NotFoundError();

        await dbQuery('UPDATE teams SET name=$1, code=$2 WHERE id=$3', [name, code || name, teamId]);

        const hasJoinedCoach = !!(await dbQuery<{ coach_id: string }>(
            'SELECT coach_id FROM team_coaches WHERE team_id=$1 AND is_owner=true LIMIT 1', [teamId]
        ))?.rows[0];

        if (!hasJoinedCoach) {
            // Update or insert invite
            const existing = (await dbQuery('SELECT id FROM team_invites WHERE team_id=$1', [teamId]))?.rows[0];
            if (existing) {
                await dbQuery('UPDATE team_invites SET invite_email=$1 WHERE team_id=$2', [coachEmail, teamId]);
            } else {
                await dbQuery('INSERT INTO team_invites (team_id, invite_email) VALUES ($1,$2)', [teamId, coachEmail]);
            }
            return { id: teamId, tournament_id: team.tournament_id, name, code: code || name, coach_email: coachEmail, has_joined: false };
        }

        return { id: teamId, tournament_id: team.tournament_id, name, code: code || name, coach_email: coachEmail, has_joined: true };
    }

    async deleteTeam(teamId: string): Promise<boolean> {
        return !!((await dbQuery('DELETE FROM teams WHERE id=$1 RETURNING *', [teamId]))?.rows[0]);
    }

    async duplicateTournament(sourceTournamentID: string, options: {
        scorers: boolean
        courtrooms: boolean
        scoringCategories: boolean
        witnesses: boolean
        format: boolean
    }): Promise<ITournament | null> {
        const source = await this.getTournament(sourceTournamentID);
        if (!source) return null;

        const newTournamentID = randomUUID();
        const newFormatID = randomUUID();

        // Copy format data if requested, otherwise use defaults
        let formatRow: { case_name: string; criminal_case: boolean; p_witnesses_called: number | null; d_witnesses_called: number | null; has_swing: boolean } = {
            case_name: '', criminal_case: false, p_witnesses_called: null, d_witnesses_called: null, has_swing: false
        };
        if (options.format || options.witnesses) {
            const existing = await dbQuery<{ case_name: string; criminal_case: boolean; p_witnesses_called: number | null; d_witnesses_called: number | null; has_swing: boolean }>(
                'SELECT case_name, criminal_case, p_witnesses_called, d_witnesses_called, has_swing FROM tournament_format WHERE format_id=$1',
                [source.case_format_id]
            );
            if (existing?.rows[0]) formatRow = existing.rows[0];
        }

        await dbQuery(
            'INSERT INTO tournament_format (format_id, case_name, criminal_case, p_witnesses_called, d_witnesses_called, has_swing) VALUES ($1,$2,$3,$4,$5,$6)',
            [newFormatID, options.format ? formatRow.case_name : '', options.format ? formatRow.criminal_case : false,
             options.format ? formatRow.p_witnesses_called : null, options.format ? formatRow.d_witnesses_called : null,
             options.format ? formatRow.has_swing : false]
        );

        await dbQuery(
            'INSERT INTO tournaments (id, name, location, start_date, end_date, case_format_id) VALUES ($1,$2,$3,$4,$5,$6)',
            [newTournamentID, `${source.name} (copy)`, source.location, null, null, newFormatID]
        );

        if (options.witnesses) {
            const witnesses = await dbQuery<{ side: string; name: string }>(
                'SELECT side, name FROM case_witnesses WHERE case_format=$1', [source.case_format_id]
            );
            if (witnesses?.rows.length) {
                await Promise.all(witnesses.rows.map(w =>
                    dbQuery('INSERT INTO case_witnesses (case_format, side, name) VALUES ($1,$2,$3)', [newFormatID, w.side, w.name])
                ));
            }
        }

        if (options.scoringCategories) {
            const cats = (await dbQuery<IScoringCategoryRow>(
                'SELECT id, name, witness_category, position FROM scoring_categories WHERE tournament_id=$1 ORDER BY position', [sourceTournamentID]
            ))?.rows ?? [];
            const fields = cats.length > 0
                ? (await dbQuery<IScoringFieldRow>(
                    `SELECT category_id, label, min_score, max_score, multiplier, assignable, eligible_for_award, visible_to_scorers, prosecution, defense, calling, crossing, position
                     FROM scoring_fields WHERE category_id IN (${cats.map((_, i) => `$${i + 1}`).join(',')}) ORDER BY position`,
                    cats.map(c => c.id)
                ))?.rows ?? []
                : [];
            await Promise.all(cats.map(async cat => {
                const newCatID = randomUUID();
                await dbQuery(
                    'INSERT INTO scoring_categories (id, tournament_id, name, witness_category, position) VALUES ($1,$2,$3,$4,$5)',
                    [newCatID, newTournamentID, cat.name, cat.witness_category, cat.position]
                );
                await Promise.all(fields.filter(f => f.category_id === cat.id).map(f =>
                    dbQuery(
                        'INSERT INTO scoring_fields (category_id, label, min_score, max_score, multiplier, assignable, eligible_for_award, visible_to_scorers, prosecution, defense, calling, crossing, position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
                        [newCatID, f.label, f.min_score, f.max_score, f.multiplier, f.assignable, f.eligible_for_award, f.visible_to_scorers, f.prosecution, f.defense, f.calling, f.crossing, f.position]
                    )
                ));
            }));
        }

        if (options.scorers) {
            const scorers = await dbQuery<IScorer>('SELECT scorer_id, first_name, last_name, email FROM scorers WHERE tournament_id=$1', [sourceTournamentID]);
            if (scorers?.rows.length) {
                await Promise.all(scorers.rows.map(s =>
                    dbQuery('INSERT INTO scorers (scorer_id, tournament_id, first_name, last_name, email) VALUES ($1,$2,$3,$4,$5)',
                        [randomUUID(), newTournamentID, s.first_name, s.last_name, s.email])
                ));
            }
        }

        if (options.courtrooms) {
            const courtrooms = await dbQuery<ICourtroomRow>('SELECT name, location FROM courtrooms WHERE tournament_id=$1', [sourceTournamentID]);
            if (courtrooms?.rows.length) {
                await Promise.all(courtrooms.rows.map(c =>
                    dbQuery('INSERT INTO courtrooms (id, tournament_id, name, location) VALUES ($1,$2,$3,$4)',
                        [randomUUID(), newTournamentID, c.name, c.location ?? null])
                ));
            }
        }

        return (await dbQuery<ITournament>('SELECT * FROM tournaments WHERE id=$1', [newTournamentID]))?.rows[0] ?? null;
    }

    async createRound(tournamentID: string): Promise<IRoundRow | null> {
        const length = (await dbQuery<{ num_rounds: string }>("select count(*) as num_rounds from rounds where tournament_id = $1", [tournamentID]))?.rows[0] ?? null;


        const pos = parseInt((length?.num_rounds ?? "0")) + 1;
        return (await dbQuery<IRoundRow>('INSERT INTO rounds (tournament_id, name) values ($1, $2) returning *', [tournamentID, `Round ${pos}`]))?.rows[0] ?? null
    }

    async deleteRound(roundID: string): Promise<IRoundRow | null> {
        const row = (await dbQuery<IRoundRow>("delete from rounds where round_id = $1 returning *", [roundID]))?.rows[0];

        return row ?? null;
    }

    async updateRound(roundID: string, roundData : IRound) : Promise<IRound | null> {

        return (await dbQuery<IRound>(`UPDATE rounds 
        set round_time = $1, name = $2, teams_public = $3, results_public = $4 
        where round_id = $5 returning *`,
            [roundData.round_time, roundData.name, roundData.teams_public, roundData.results_public, roundID]))?.rows[0] ?? null
    }

    async createRoundPairing(roundID: string, prosecution: string, defense : string, courtroomID : string) : Promise<IPairingRow | null> {

        return (await dbQuery<IPairingRow>(`INSERT INTO pairings (round_id, p_team, d_team, courtroom) values 
                                                               ($1, $2, $3,$4) returning *`, [roundID, prosecution, defense, courtroomID]))?.rows[0] ?? null
    }

    async getPairings(roundID: string): Promise<IPairingRow[]> {
        return (await dbQuery<IPairingRow>(`Select * from pairings where round_id = $1`, [roundID]))?.rows ?? [];
    }

    async deletePairing(pairingID: string): Promise<boolean> {
        return !!(await dbQuery(`DELETE FROM pairings WHERE pairing_id=$1 RETURNING pairing_id`, [pairingID]))?.rows[0];
    }

    async getPairingScorers(pairingID: string): Promise<{ assignment_id: string; type: 'registered' | 'paper'; scorer_id: string; name: string; is_presider: boolean }[]> {
        const presiderRow = (await dbQuery<{ scorer_assignment_id: string }>(
            `SELECT scorer_assignment_id FROM scorer_presider_assignment WHERE pairing_id=$1`, [pairingID]
        ))?.rows[0];
        const presiderAssignmentId = presiderRow?.scorer_assignment_id ?? null;

        const registered = (await dbQuery<{ assignment_id: string; scorer_id: string; first_name: string; last_name: string }>(
            `SELECT spa.assignment_id, s.scorer_id, s.first_name, s.last_name
             FROM scorer_pairing_assignments spa JOIN scorers s ON spa.registered_scorer_id = s.scorer_id
             WHERE spa.pairing_id = $1 AND spa.registered_scorer_id IS NOT NULL`,
            [pairingID]
        ))?.rows ?? [];
        const paper = (await dbQuery<{ assignment_id: string; scorer_id: string; name: string }>(
            `SELECT spa.assignment_id, ps.scorer_id, ps.name
             FROM scorer_pairing_assignments spa JOIN paper_scorers ps ON spa.paper_scorer_id = ps.scorer_id
             WHERE spa.pairing_id = $1 AND spa.paper_scorer_id IS NOT NULL`,
            [pairingID]
        ))?.rows ?? [];
        return [
            ...registered.map(r => ({ assignment_id: r.assignment_id, type: 'registered' as const, scorer_id: r.scorer_id, name: `${r.first_name} ${r.last_name}`, is_presider: r.assignment_id === presiderAssignmentId })),
            ...paper.map(p => ({ assignment_id: p.assignment_id, type: 'paper' as const, scorer_id: p.scorer_id, name: p.name, is_presider: p.assignment_id === presiderAssignmentId })),
        ];
    }

    async assignScorerToPairing(pairingID: string, scorerID: string): Promise<{ assignment_id: string } | null> {
        return (await dbQuery<{ assignment_id: string }>(
            `INSERT INTO scorer_pairing_assignments (pairing_id, registered_scorer_id) VALUES ($1,$2) RETURNING assignment_id`,
            [pairingID, scorerID]
        ))?.rows[0] ?? null;
    }

    async addPaperScorer(pairingID: string, name: string): Promise<{ assignment_id: string; scorer_id: string } | null> {
        const ps = (await dbQuery<{ scorer_id: string }>(
            `INSERT INTO paper_scorers (pairing_id, name) VALUES ($1,$2) RETURNING scorer_id`,
            [pairingID, name]
        ))?.rows[0];
        if (!ps) return null;
        return (await dbQuery<{ assignment_id: string; scorer_id: string }>(
            `INSERT INTO scorer_pairing_assignments (pairing_id, paper_scorer_id) VALUES ($1,$2) RETURNING assignment_id, $2::uuid AS scorer_id`,
            [pairingID, ps.scorer_id]
        ))?.rows[0] ?? null;
    }

    async removeScorerAssignment(assignmentID: string): Promise<boolean> {
        // Deleting the assignment cascades; also clean up orphaned paper_scorer row
        const row = (await dbQuery<{ paper_scorer_id: string | null }>(
            `DELETE FROM scorer_pairing_assignments WHERE assignment_id=$1 RETURNING paper_scorer_id`,
            [assignmentID]
        ))?.rows[0];
        if (!row) return false;
        if (row.paper_scorer_id) {
            await dbQuery(`DELETE FROM paper_scorers WHERE scorer_id=$1`, [row.paper_scorer_id]);
        }
        return true;
    }

    async setPresider(pairingID: string, assignmentID: string): Promise<boolean> {
        // Upsert: one presider per pairing (unique constraint on pairing_id)
        return !!(await dbQuery(
            `INSERT INTO scorer_presider_assignment (scorer_assignment_id, pairing_id)
             VALUES ($1, $2)
             ON CONFLICT (pairing_id) DO UPDATE SET scorer_assignment_id = EXCLUDED.scorer_assignment_id`,
            [assignmentID, pairingID]
        ));
    }

    async clearPresider(pairingID: string): Promise<boolean> {
        await dbQuery(`DELETE FROM scorer_presider_assignment WHERE pairing_id=$1`, [pairingID]);
        return true;
    }
}
