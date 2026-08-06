import { dbQuery } from '../db';
import type {
    IScorer, TournamentPayload, ITournament, IOrganizer, IWitnesses, IScoringCategory, ICourtroom, ITeam,
    IRound, IDuplicateOptions, IBallotStatus
} from '@mock-scores/shared';
import type {
    ICaseWitnessRow, IScoringCategoryRow, IScoringFieldRow, IRoundRow,
    ITournamentOwnerRow, ITournamentDelegateInviteRow, IAuthRow, ICourtroomRow,
    ITournamentFormatRow, ITeamRow, IPairingRow
} from '../types/dbtypes';
import { randomUUID } from 'node:crypto';
import { AlreadyExistsError, DbError, NotFoundError, OrganizerAlreadyJoinedError } from '../errors';

async function insertWitnesses(formatID: string, cf: TournamentPayload['caseFormat']): Promise<void> {
    const witnesses: [string, string][] = [
        ...cf.pWitnessNames.map(n => ['P', n] as [string, string]),
        ...cf.dWitnessNames.map(n => ['D', n] as [string, string]),
        ...(cf.hasSwing ? cf.swingWitnessNames.map(n => ['S', n] as [string, string]) : []),
    ];
    await Promise.all(witnesses.map(([side, name]) =>
        dbQuery('INSERT INTO case_witnesses (case_format, side, name) VALUES ($1,$2,$3)', [formatID, side, name])
    ));
}

async function insertCategories(tournamentID: string, categories: TournamentPayload['scoringCategories']): Promise<void> {
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

async function getTournamentFormatId(tournamentID: string): Promise<string> {
    const row = (await dbQuery<{ case_format_id: string }>('SELECT case_format_id FROM tournaments WHERE id=$1', [tournamentID]))?.rows[0];
    if (!row) throw new NotFoundError('tournament');
    return row.case_format_id;
}

export async function getFormat(tournamentID: string): Promise<ITournamentFormatRow & { case_format_id: string }> {
    const row = (await dbQuery<ITournamentFormatRow & { case_format_id: string }>(
        `SELECT tf.*, t.case_format_id FROM tournaments t JOIN tournament_format tf ON tf.format_id = t.case_format_id WHERE t.id = $1`,
        [tournamentID]
    ))?.rows[0];
    if (!row) throw new NotFoundError('tournament format');
    return row;
}

export async function updateFormat(tournamentID: string, format: TournamentPayload['caseFormat']): Promise<void> {
    const formatID = await getTournamentFormatId(tournamentID);
    const result = await dbQuery(
        'UPDATE tournament_format SET case_name=$1, criminal_case=$2, p_witnesses_called=$3, d_witnesses_called=$4, has_swing=$5 WHERE format_id=$6',
        [format.caseName, format.criminalCase, format.pWitnessesCalled, format.dWitnessesCalled, format.hasSwing, formatID]
    );
    if (!result) throw new DbError('updateFormat');
}

export async function getWitnesses(tournamentID: string): Promise<IWitnesses> {
    const formatID = await getTournamentFormatId(tournamentID);
    const rows = (await dbQuery<ICaseWitnessRow>('SELECT side, name FROM case_witnesses WHERE case_format=$1', [formatID]))?.rows ?? [];
    return {
        pWitnessNames: rows.filter(w => w.side === 'P').map(w => w.name),
        dWitnessNames: rows.filter(w => w.side === 'D').map(w => w.name),
        swingWitnessNames: rows.filter(w => w.side === 'S').map(w => w.name),
    };
}

export async function updateWitnesses(tournamentID: string, witnesses: IWitnesses): Promise<void> {
    const formatID = await getTournamentFormatId(tournamentID);
    await dbQuery('DELETE FROM case_witnesses WHERE case_format=$1', [formatID]);
    const all: [string, string][] = [
        ...witnesses.pWitnessNames.map(n => ['P', n] as [string, string]),
        ...witnesses.dWitnessNames.map(n => ['D', n] as [string, string]),
        ...witnesses.swingWitnessNames.map(n => ['S', n] as [string, string]),
    ];
    await Promise.all(all.map(([side, name]) =>
        dbQuery('INSERT INTO case_witnesses (case_format, side, name) VALUES ($1,$2,$3)', [formatID, side, name])
    ));
}

export async function getScoringCategories(tournamentID: string): Promise<IScoringCategory[]> {
    const cats = (await dbQuery<IScoringCategoryRow>(
        'SELECT id, name, witness_category, position FROM scoring_categories WHERE tournament_id=$1 ORDER BY position', [tournamentID]
    ))?.rows ?? [];
    const catIds = cats.map(c => c.id);
    const fields = catIds.length > 0
        ? (await dbQuery<IScoringFieldRow>(
            `SELECT id, category_id, label, min_score, max_score, multiplier, assignable, eligible_for_award, visible_to_scorers, prosecution, defense, calling, crossing, position
             FROM scoring_fields WHERE category_id IN (${catIds.map((_, i) => `$${i + 1}`).join(',')}) ORDER BY position`,
            catIds
        ))?.rows ?? []
        : [];
    return cats.map(c => ({
        id: c.id, name: c.name, witnessCategory: c.witness_category, position: c.position,
        fields: fields.filter(f => f.category_id === c.id).map(f => ({
            id: f.id, label: f.label, min: f.min_score, max: f.max_score,
            multiplier: Number(f.multiplier), assignable: f.assignable,
            eligibleForAward: f.eligible_for_award, visibleToScorers: f.visible_to_scorers,
            prosecution: f.prosecution, defense: f.defense, calling: f.calling, crossing: f.crossing,
        })),
    }));
}

export async function updateScoringCategories(tournamentID: string, categories: TournamentPayload['scoringCategories']): Promise<void> {
    await dbQuery('DELETE FROM scoring_fields WHERE category_id IN (SELECT id FROM scoring_categories WHERE tournament_id=$1)', [tournamentID]);
    await dbQuery('DELETE FROM scoring_categories WHERE tournament_id=$1', [tournamentID]);
    await insertCategories(tournamentID, categories);
}

export async function updateTournamentDetails(tournamentID: string, t: { name: string; location: string; startDate?: string | null; endDate?: string | null }): Promise<void> {
    const result = await dbQuery(
        'UPDATE tournaments SET name=$1, location=$2, start_date=$3, end_date=$4 WHERE id=$5',
        [t.name, t.location, t.startDate ?? null, t.endDate ?? null, tournamentID]
    );
    if (!result) throw new DbError('updateTournamentDetails');
    if (result.rowCount === 0) throw new NotFoundError('tournament');
}

export async function getStandingsConfig(tournamentID: string): Promise<{ id: string; statsXml: string; standingsXml: string } | null> {
    const r = await dbQuery<{ id: string; stats_xml: string; standings_xml: string }>(
        `SELECT sc.id, sc.stats_xml, sc.standings_xml
         FROM tournaments t JOIN standings_configs sc ON sc.id = t.standings_config_id WHERE t.id = $1`,
        [tournamentID]
    );
    if (r === null) throw new DbError('getStandingsConfig');
    if (!r.rows[0]) return null;
    const { id, stats_xml, standings_xml } = r.rows[0];
    return { id, statsXml: stats_xml, standingsXml: standings_xml };
}

export async function upsertStandingsConfig(tournamentID: string, statsXml: string, standingsXml: string): Promise<void> {
    const existing = await dbQuery<{ standings_config_id: string | null }>('SELECT standings_config_id FROM tournaments WHERE id=$1', [tournamentID]);
    if (!existing) throw new DbError('upsertStandingsConfig');
    const configId = existing.rows[0]?.standings_config_id;
    if (configId) {
        const isTemplate = !!(await dbQuery<{ id: string }>('SELECT id FROM standings_templates WHERE config_id=$1 LIMIT 1', [configId]))?.rows[0];
        if (isTemplate) {
            const row = (await dbQuery<{ id: string }>('INSERT INTO standings_configs (stats_xml, standings_xml) VALUES ($1,$2) RETURNING id', [statsXml, standingsXml]))?.rows[0];
            if (!row) throw new DbError('upsertStandingsConfig insert');
            await dbQuery('UPDATE tournaments SET standings_config_id=$1 WHERE id=$2', [row.id, tournamentID]);
        } else {
            await dbQuery('UPDATE standings_configs SET stats_xml=$1, standings_xml=$2 WHERE id=$3', [statsXml, standingsXml, configId]);
        }
    } else {
        const row = (await dbQuery<{ id: string }>('INSERT INTO standings_configs (stats_xml, standings_xml) VALUES ($1,$2) RETURNING id', [statsXml, standingsXml]))?.rows[0];
        if (!row) throw new DbError('upsertStandingsConfig insert');
        await dbQuery('UPDATE tournaments SET standings_config_id=$1 WHERE id=$2', [row.id, tournamentID]);
    }
}

export async function getOrganizerStandingsData(tournamentID: string): Promise<{
    config: { statsXml: string; standingsXml: string } | null;
    teams: { id: string; name: string; code: string }[];
    ballots: { p_team_id: string; d_team_id: string; p_points: number; d_points: number; pairing_id: string; round_id: string }[];
    rounds: { round_id: string; name: string }[];
}> {
    const [configRow, teamsRows, roundsRows, ballotsRows] = await Promise.all([
        dbQuery<{ stats_xml: string; standings_xml: string }>(
            `SELECT sc.stats_xml, sc.standings_xml FROM tournaments t
             JOIN standings_configs sc ON sc.id = t.standings_config_id WHERE t.id = $1`,
            [tournamentID],
        ),
        dbQuery<{ id: string; name: string; code: string }>(
            'SELECT id, name, code FROM teams WHERE tournament_id = $1',
            [tournamentID],
        ),
        dbQuery<{ round_id: string; name: string }>(
            'SELECT round_id, name FROM rounds WHERE tournament_id = $1 ORDER BY round_time ASC NULLS LAST',
            [tournamentID],
        ),
        dbQuery<{ p_team_id: string; d_team_id: string; p_points: number; d_points: number; pairing_id: string; round_id: string }>(
            `SELECT b.p_team_id, b.d_team_id, b.p_points, b.d_points, b.pairing_id, p.round_id
             FROM ballots b
             JOIN pairings p ON p.pairing_id = b.pairing_id
             WHERE b.tournament_id = $1`,
            [tournamentID],
        ),
    ]);

    const row = configRow?.rows[0];
    return {
        config: row ? { statsXml: row.stats_xml, standingsXml: row.standings_xml } : null,
        teams: teamsRows?.rows ?? [],
        ballots: ballotsRows?.rows ?? [],
        rounds: roundsRows?.rows ?? [],
    };
}

export async function getStandingsTemplates(): Promise<{ id: string; label: string; description: string; config_id: string }[]> {
    const result = await dbQuery<{ id: string; label: string; description: string; config_id: string }>(
        'SELECT id, label, description, config_id FROM standings_templates ORDER BY label'
    );
    if (!result) throw new DbError('getStandingsTemplates');
    return result.rows;
}

export async function deleteTournament(tournamentID: string): Promise<void> {
    const row = (await dbQuery('DELETE FROM tournaments WHERE id=$1 RETURNING id', [tournamentID]))?.rows[0];
    if (!row) throw new NotFoundError('tournament');
}

export async function getTournaments(userId: string): Promise<ITournament[]> {
    const result = await dbQuery<ITournament>(
        'SELECT * FROM tournaments WHERE id IN (SELECT tournament_id FROM tournament_owners WHERE delegate_id = $1)', [userId]
    );
    if (!result) throw new DbError('getTournaments');
    return result.rows;
}

export async function getTournament(tournamentID: string): Promise<ITournament> {
    const row = (await dbQuery<ITournament>('SELECT * FROM tournaments WHERE id = $1', [tournamentID]))?.rows[0];
    if (!row) throw new NotFoundError('tournament');
    return row;
}

export async function createTournament(tournament: TournamentPayload): Promise<ITournament> {
    const tournamentID = randomUUID();
    const formatID = randomUUID();
    const { tournament: t, caseFormat: cf } = tournament;
    const formatInsert = await dbQuery(
        'INSERT INTO tournament_format (format_id, case_name, criminal_case, p_witnesses_called, d_witnesses_called, has_swing) VALUES ($1,$2,$3,$4,$5,$6)',
        [formatID, cf.caseName, cf.criminalCase, cf.pWitnessesCalled, cf.dWitnessesCalled, cf.hasSwing]
    );
    if (!formatInsert || formatInsert.rowCount !== 1) throw new DbError('createTournament format');
    const insertion = await dbQuery(
        'INSERT INTO tournaments (id, name, location, start_date, end_date, case_format_id, standings_config_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [tournamentID, t.name, t.location, t.startDate, t.endDate, formatID, tournament.standingsConfigId ?? null]
    );
    if (!insertion || insertion.rowCount !== 1) throw new DbError('createTournament insert');
    await insertWitnesses(formatID, cf);
    await insertCategories(tournamentID, tournament.scoringCategories);
    const row = (await dbQuery<ITournament>('SELECT * FROM tournaments WHERE id = $1', [tournamentID]))?.rows[0];
    if (!row) throw new DbError('createTournament select');
    return row;
}

export async function addTournamentOrganizer(tournamentID: string, userId: string, role: 'owner' | 'delegate'): Promise<void> {
    const result = await dbQuery('INSERT INTO tournament_owners (tournament_id, delegate_id, role) VALUES ($1,$2,$3)', [tournamentID, userId, role]);
    if (!result) throw new DbError('addTournamentOrganizer');
}

export async function getScorers(tournamentID: string): Promise<IScorer[]> {
    const result = await dbQuery<IScorer>('SELECT * FROM scorers WHERE tournament_id = $1', [tournamentID]);
    if (!result) throw new DbError('getScorers');
    return result.rows;
}

export async function addScorer(scorer: IScorer, tournamentId: string): Promise<void> {
    const result = await dbQuery(
        'INSERT INTO scorers (scorer_id, tournament_id, first_name, last_name, email) VALUES ($1,$2,$3,$4,$5)',
        [scorer.scorer_id, tournamentId, scorer.first_name, scorer.last_name, scorer.email]
    );
    if (!result) throw new DbError('addScorer');
}

export async function updateScorer(scorer: IScorer, tournamentId: string): Promise<void> {
    const result = await dbQuery(
        'UPDATE scorers SET tournament_id=$1, first_name=$2, last_name=$3, email=$4 WHERE scorer_id=$5',
        [tournamentId, scorer.first_name, scorer.last_name, scorer.email, scorer.scorer_id]
    );
    if (!result) throw new DbError('updateScorer');
    if ((result.rowCount ?? 0) === 0) throw new NotFoundError('scorer');
}

export async function deleteScorer(scorerId: string): Promise<void> {
    const result = await dbQuery('DELETE FROM scorers WHERE scorer_id=$1 RETURNING scorer_id', [scorerId]);
    if (!result) throw new DbError('deleteScorer');
    if (!result.rows[0]) throw new NotFoundError('scorer');
}

export async function getAllConflicts(tournamentId: string): Promise<{ scorer_id: string; team_id: string }[]> {
    const result = await dbQuery<{ scorer_id: string; team_id: string }>(
        `SELECT sc.scorer_id, sc.team_id FROM scorer_conflicts sc
         JOIN scorers s ON s.scorer_id = sc.scorer_id WHERE s.tournament_id = $1`,
        [tournamentId]
    );
    if (!result) throw new DbError('getAllConflicts');
    return result.rows;
}

export async function getConflicts(scorerId: string): Promise<{ id: string; scorer_id: string; team_id: string; team_name: string }[]> {
    const result = await dbQuery<{ id: string; scorer_id: string; team_id: string; team_name: string }>(
        `SELECT sc.id, sc.scorer_id, sc.team_id, t.name AS team_name
         FROM scorer_conflicts sc JOIN teams t ON t.id = sc.team_id WHERE sc.scorer_id = $1`,
        [scorerId]
    );
    if (!result) throw new DbError('getConflicts');
    return result.rows;
}

export async function addConflict(scorerId: string, teamId: string): Promise<{ id: string; scorer_id: string; team_id: string; team_name: string }> {
    const row = (await dbQuery<{ id: string; scorer_id: string; team_id: string; team_name: string }>(
        `INSERT INTO scorer_conflicts (scorer_id, team_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING id, scorer_id, team_id, (SELECT name FROM teams WHERE id = $2) AS team_name`,
        [scorerId, teamId]
    ))?.rows[0];
    if (!row) throw new AlreadyExistsError('scorer conflict');
    return row;
}

export async function removeConflict(scorerId: string, teamId: string): Promise<void> {
    const result = await dbQuery('DELETE FROM scorer_conflicts WHERE scorer_id=$1 AND team_id=$2 RETURNING scorer_id', [scorerId, teamId]);
    if (!result) throw new DbError('removeConflict');
    if (!result.rows[0]) throw new NotFoundError('scorer conflict');
}

export async function getOrganizers(tournamentID: string): Promise<IOrganizer[]> {
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
    if (!active || !invited) throw new DbError('getOrganizers');
    return [...active.rows, ...invited.rows];
}

export async function addOrganizer(tournamentID: string, name: string, email: string, role: 'owner' | 'delegate'): Promise<IOrganizer> {
    const user = (await dbQuery<IAuthRow>('SELECT * FROM auth WHERE LOWER(email) = $1', [email.toLowerCase()]))?.rows[0];
    if (!user) {
        const existing = (await dbQuery<ITournamentDelegateInviteRow>(
            'SELECT id FROM tournament_delegate_invites WHERE tournament_id=$1 AND LOWER(email)=$2',
            [tournamentID, email.toLowerCase()]
        ))?.rows[0];
        if (existing) throw new AlreadyExistsError('delegate');
        const row = (await dbQuery<ITournamentDelegateInviteRow>(
            'INSERT INTO tournament_delegate_invites (tournament_id, name, email) VALUES ($1,$2,$3) RETURNING *',
            [tournamentID, name, email]
        ))?.rows[0];
        if (!row) throw new DbError('addOrganizer invite insert');
        return { ...row, role: 'delegate', has_joined: false };
    }
    const existing = (await dbQuery<ITournamentOwnerRow>(
        'SELECT tournament_id FROM tournament_owners WHERE tournament_id=$1 AND delegate_id=$2',
        [tournamentID, user.user_id]
    ))?.rows[0];
    if (existing) throw new AlreadyExistsError('delegate');
    const row = (await dbQuery<ITournamentOwnerRow>(
        'INSERT INTO tournament_owners (tournament_id, delegate_id, role) VALUES ($1,$2,$3) RETURNING *',
        [tournamentID, user.user_id, role]
    ))?.rows[0];
    if (!row) throw new DbError('addOrganizer owner insert');
    return { ...row, name: `${user.first_name} ${user.last_name}`, email: user.email, has_joined: true };
}

export async function updateOrganizer(organizer: IOrganizer): Promise<IOrganizer> {
    if (organizer.has_joined) throw new OrganizerAlreadyJoinedError();
    const row = (await dbQuery<ITournamentDelegateInviteRow>(
        'UPDATE tournament_delegate_invites SET email=$1, name=$2 WHERE id=$3 RETURNING *',
        [organizer.email, organizer.name, organizer.id]
    ))?.rows[0];
    if (!row) throw new NotFoundError('organizer invite');
    return { ...row, role: 'delegate', has_joined: false };
}

export async function deleteOrganizer(organizer: IOrganizer): Promise<void> {
    if (organizer.has_joined) {
        const row = (await dbQuery<ITournamentOwnerRow>('DELETE FROM tournament_owners WHERE delegate_id=$1 RETURNING *', [organizer.id]))?.rows[0];
        if (!row) throw new NotFoundError('organizer');
    } else {
        const row = (await dbQuery<ITournamentDelegateInviteRow>('DELETE FROM tournament_delegate_invites WHERE id=$1 RETURNING *', [organizer.id]))?.rows[0];
        if (!row) throw new NotFoundError('organizer invite');
    }
}

export async function getCourtrooms(tournamentId: string): Promise<ICourtroomRow[]> {
    const result = await dbQuery<ICourtroomRow>('SELECT * FROM courtrooms WHERE tournament_id=$1', [tournamentId]);
    if (!result) throw new DbError('getCourtrooms');
    return result.rows;
}

export async function addCourtroom(tournamentId: string, courtroom: ICourtroom): Promise<ICourtroomRow> {
    const row = (await dbQuery<ICourtroomRow>(
        'INSERT INTO courtrooms (id, tournament_id, name, location) VALUES ($1,$2,$3,$4) RETURNING *',
        [courtroom.id, tournamentId, courtroom.name, courtroom.location ?? null]
    ))?.rows[0];
    if (!row) throw new DbError('addCourtroom');
    return row;
}

export async function updateCourtroom(courtroom: ICourtroom): Promise<ICourtroomRow> {
    const row = (await dbQuery<ICourtroomRow>(
        'UPDATE courtrooms SET name=$1, location=$2 WHERE id=$3 RETURNING *',
        [courtroom.name, courtroom.location ?? null, courtroom.id]
    ))?.rows[0];
    if (!row) throw new NotFoundError('courtroom');
    return row;
}

export async function deleteCourtroom(courtroomId: string): Promise<void> {
    const row = (await dbQuery<ICourtroomRow>('DELETE FROM courtrooms WHERE id=$1 RETURNING id', [courtroomId]))?.rows[0];
    if (!row) throw new NotFoundError('courtroom');
}

export async function getRounds(tournamentId: string): Promise<IRoundRow[]> {
    const result = await dbQuery<IRoundRow>('SELECT * FROM rounds WHERE tournament_id=$1 ORDER BY round_time', [tournamentId]);
    if (!result) throw new DbError('getRounds');
    return result.rows;
}

export async function getRound(tournamentID: string, roundID: string): Promise<IRoundRow> {
    const row = (await dbQuery<IRoundRow>('SELECT * FROM rounds WHERE round_id=$1 AND tournament_id=$2', [roundID, tournamentID]))?.rows[0];
    if (!row) throw new NotFoundError('round');
    return row;
}

export async function createRound(tournamentID: string): Promise<IRoundRow> {
    const length = (await dbQuery<{ num_rounds: string }>('SELECT count(*) AS num_rounds FROM rounds WHERE tournament_id=$1', [tournamentID]))?.rows[0];
    const pos = parseInt(length?.num_rounds ?? '0') + 1;
    const row = (await dbQuery<IRoundRow>('INSERT INTO rounds (tournament_id, name) VALUES ($1, $2) RETURNING *', [tournamentID, `Round ${pos}`]))?.rows[0];
    if (!row) throw new DbError('createRound');
    return row;
}

export async function deleteRound(roundID: string): Promise<IRoundRow> {
    const row = (await dbQuery<IRoundRow>('DELETE FROM rounds WHERE round_id=$1 RETURNING *', [roundID]))?.rows[0];
    if (!row) throw new NotFoundError('round');
    return row;
}

export async function updateRound(roundID: string, roundData: IRound): Promise<IRound> {
    const row = (await dbQuery<IRound>(
        'UPDATE rounds SET round_time=$1, name=$2, teams_public=$3, results_public=$4 WHERE round_id=$5 RETURNING *',
        [roundData.round_time, roundData.name, roundData.teams_public, roundData.results_public, roundID]
    ))?.rows[0];
    if (!row) throw new NotFoundError('round');
    return row;
}

export async function getTeams(tournamentID: string): Promise<ITeam[]> {
    const joined = (await dbQuery<ITeam>(
        `SELECT t.id, t.tournament_id, t.name, t.code, a.email AS coach_email, true AS has_joined
         FROM teams t
         JOIN team_coaches tc ON tc.team_id = t.id AND tc.is_owner = true
         JOIN auth a ON a.user_id = tc.coach_id
         WHERE t.tournament_id = $1`,
        [tournamentID]
    ))?.rows ?? [];
    const invited = (await dbQuery<ITeam>(
        `SELECT t.id, t.tournament_id, t.name, t.code, ti.invite_email AS coach_email, false AS has_joined
         FROM teams t JOIN team_invites ti ON ti.team_id = t.id
         WHERE t.tournament_id = $1
           AND NOT EXISTS (SELECT 1 FROM team_coaches tc WHERE tc.team_id = t.id AND tc.is_owner = true)`,
        [tournamentID]
    ))?.rows ?? [];
    return [...joined, ...invited];
}

export async function teamNameExists(tournamentID: string, name: string, excludeId?: string): Promise<boolean> {
    const row = (await dbQuery<{ id: string }>(
        `SELECT id FROM teams WHERE tournament_id=$1 AND LOWER(name)=LOWER($2)${excludeId ? ' AND id != $3' : ''}`,
        excludeId ? [tournamentID, name, excludeId] : [tournamentID, name]
    ))?.rows[0];
    return !!row;
}

export async function addTeam(tournamentID: string, name: string, coachEmail: string, code: string): Promise<ITeam> {
    const teamId = randomUUID();
    const teamInsert = await dbQuery<ITeamRow>('INSERT INTO teams (id, tournament_id, name, code) VALUES ($1,$2,$3,$4) RETURNING *', [teamId, tournamentID, name, code]);
    if (!teamInsert?.rows[0]) throw new DbError('addTeam');
    const user = (await dbQuery<IAuthRow>('SELECT * FROM auth WHERE LOWER(email) = LOWER($1)', [coachEmail]))?.rows[0];
    if (!user) {
        await dbQuery('INSERT INTO team_invites (team_id, invite_email) VALUES ($1,$2)', [teamId, coachEmail]);
        return { id: teamId, tournament_id: tournamentID, name, code, coach_email: coachEmail, has_joined: false };
    }
    await dbQuery('INSERT INTO team_coaches (coach_id, team_id, is_owner) VALUES ($1,$2,$3)', [user.user_id, teamId, true]);
    return { id: teamId, tournament_id: tournamentID, name, code, coach_email: user.email, has_joined: true };
}

export async function updateTeam(teamId: string, name: string, coachEmail: string, code: string): Promise<ITeam> {
    const team = (await dbQuery<ITeamRow>('SELECT * FROM teams WHERE id=$1', [teamId]))?.rows[0];
    if (!team) throw new NotFoundError('team');
    await dbQuery('UPDATE teams SET name=$1, code=$2 WHERE id=$3', [name, code || name, teamId]);
    const hasJoinedCoach = !!(await dbQuery<{ coach_id: string }>('SELECT coach_id FROM team_coaches WHERE team_id=$1 AND is_owner=true LIMIT 1', [teamId]))?.rows[0];
    if (!hasJoinedCoach) {
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

export async function deleteTeam(teamId: string): Promise<void> {
    const row = (await dbQuery('DELETE FROM teams WHERE id=$1 RETURNING id', [teamId]))?.rows[0];
    if (!row) throw new NotFoundError('team');
}

export async function createRoundPairing(roundID: string, prosecution: string, defense: string, courtroomID: string): Promise<IPairingRow> {
    const row = (await dbQuery<IPairingRow>(
        'INSERT INTO pairings (round_id, p_team, d_team, courtroom) VALUES ($1,$2,$3,$4) RETURNING *',
        [roundID, prosecution, defense, courtroomID]
    ))?.rows[0];
    if (!row) throw new DbError('createRoundPairing');
    return row;
}

export async function getPairings(roundID: string): Promise<IPairingRow[]> {
    const result = await dbQuery<IPairingRow>('SELECT * FROM pairings WHERE round_id=$1', [roundID]);
    if (!result) throw new DbError('getPairings');
    return result.rows;
}

export async function getBallotStatus(roundID: string): Promise<IBallotStatus[]> {
    const result = await dbQuery<IBallotStatus>(
        `SELECT p.pairing_id,
                COUNT(spa.assignment_id)::int AS total_scorers,
                COUNT(b.ballot_id)::int AS submitted
         FROM pairings p
         LEFT JOIN scorer_pairing_assignments spa ON spa.pairing_id = p.pairing_id
         LEFT JOIN ballots b ON b.scorer_assignment_id = spa.assignment_id
         WHERE p.round_id = $1
         GROUP BY p.pairing_id`,
        [roundID]
    );
    if (!result) throw new DbError('getBallotStatus');
    return result.rows;
}

export async function deletePairing(pairingID: string): Promise<void> {
    const row = (await dbQuery('DELETE FROM pairings WHERE pairing_id=$1 RETURNING pairing_id', [pairingID]))?.rows[0];
    if (!row) throw new NotFoundError('pairing');
}

export async function getPairingScorers(pairingID: string): Promise<{ assignment_id: string; type: 'registered' | 'paper'; scorer_id: string; name: string; is_presider: boolean; conflict_reported: boolean; p_points: number | null; d_points: number | null }[]> {
    const presiderRow = (await dbQuery<{ scorer_assignment_id: string }>('SELECT scorer_assignment_id FROM scorer_presider_assignment WHERE pairing_id=$1', [pairingID]))?.rows[0];
    const presiderAssignmentId = presiderRow?.scorer_assignment_id ?? null;
    const registered = (await dbQuery<{ assignment_id: string; scorer_id: string; first_name: string; last_name: string; conflict_reported: boolean; p_points: number | null; d_points: number | null }>(
        `SELECT spa.assignment_id, s.scorer_id, s.first_name, s.last_name, spa.conflict_reported,
                b.p_points, b.d_points
         FROM scorer_pairing_assignments spa
         JOIN scorers s ON spa.registered_scorer_id = s.scorer_id
         LEFT JOIN ballots b ON b.scorer_assignment_id = spa.assignment_id
         WHERE spa.pairing_id=$1 AND spa.registered_scorer_id IS NOT NULL`,
        [pairingID]
    ))?.rows ?? [];
    const paper = (await dbQuery<{ assignment_id: string; scorer_id: string; name: string; conflict_reported: boolean; p_points: number | null; d_points: number | null }>(
        `SELECT spa.assignment_id, ps.scorer_id, ps.name, spa.conflict_reported,
                b.p_points, b.d_points
         FROM scorer_pairing_assignments spa
         JOIN paper_scorers ps ON spa.paper_scorer_id = ps.scorer_id
         LEFT JOIN ballots b ON b.scorer_assignment_id = spa.assignment_id
         WHERE spa.pairing_id=$1 AND spa.paper_scorer_id IS NOT NULL`,
        [pairingID]
    ))?.rows ?? [];
    return [
        ...registered.map(r => ({ assignment_id: r.assignment_id, type: 'registered' as const, scorer_id: r.scorer_id, name: `${r.first_name} ${r.last_name}`, is_presider: r.assignment_id === presiderAssignmentId, conflict_reported: r.conflict_reported, p_points: r.p_points, d_points: r.d_points })),
        ...paper.map(p => ({ assignment_id: p.assignment_id, type: 'paper' as const, scorer_id: p.scorer_id, name: p.name, is_presider: p.assignment_id === presiderAssignmentId, conflict_reported: p.conflict_reported, p_points: p.p_points, d_points: p.d_points })),
    ];
}

/** Returns the data needed to send a scorer invite email after assignment. */
export async function getScorerInviteContext(pairingID: string, scorerID: string): Promise<{
    email: string; firstName: string; lastName: string; tournamentName: string;
} | null> {
    const row = (await dbQuery<{
        email: string; first_name: string; last_name: string; tournament_name: string;
    }>(`
        SELECT s.email, s.first_name, s.last_name, t.name AS tournament_name
        FROM scorers s
        JOIN pairings p  ON p.pairing_id = $1
        JOIN rounds r    ON r.round_id   = p.round_id
        JOIN tournaments t ON t.id       = r.tournament_id
        WHERE s.scorer_id = $2
    `, [pairingID, scorerID]))?.rows[0];
    if (!row) return null;
    return { email: row.email, firstName: row.first_name, lastName: row.last_name, tournamentName: row.tournament_name };
}

export async function getScorerInviteContextForAssignment(pairingID: string, assignmentID: string): Promise<{
    email: string; firstName: string; lastName: string; tournamentName: string;
} | null> {
    const row = (await dbQuery<{
        email: string; first_name: string; last_name: string; tournament_name: string;
    }>(`
        SELECT s.email, s.first_name, s.last_name, t.name AS tournament_name
        FROM scorer_pairing_assignments spa
        JOIN scorers s ON s.scorer_id = spa.registered_scorer_id
        JOIN pairings p ON p.pairing_id = spa.pairing_id
        JOIN rounds r ON r.round_id = p.round_id
        JOIN tournaments t ON t.id = r.tournament_id
        WHERE spa.assignment_id = $1
          AND spa.pairing_id = $2
          AND spa.registered_scorer_id IS NOT NULL
        LIMIT 1
    `, [assignmentID, pairingID]))?.rows[0];
    if (!row) return null;
    return { email: row.email, firstName: row.first_name, lastName: row.last_name, tournamentName: row.tournament_name };
}

/** Returns coach emails + tournament name for notifying results going public. */
export async function getRoundResultsPublicContext(roundID: string): Promise<{
    tournamentName: string; roundName: string; coachEmails: string[];
} | null> {
    const roundRow = (await dbQuery<{ name: string; tournament_id: string }>(
        'SELECT name, tournament_id FROM rounds WHERE round_id = $1', [roundID],
    ))?.rows[0];
    if (!roundRow) return null;

    const tourneyRow = (await dbQuery<{ name: string }>(
        'SELECT name FROM tournaments WHERE id = $1', [roundRow.tournament_id],
    ))?.rows[0];
    if (!tourneyRow) return null;

    const emailRows = (await dbQuery<{ email: string }>(
        `SELECT DISTINCT a.email FROM team_coaches tc
         JOIN teams t ON t.id = tc.team_id
         JOIN auth a  ON a.user_id = tc.coach_id
         WHERE t.tournament_id = $1`,
        [roundRow.tournament_id],
    ))?.rows ?? [];

    return {
        tournamentName: tourneyRow.name,
        roundName: roundRow.name,
        coachEmails: emailRows.map(r => r.email),
    };
}

/** Returns the data needed to send scorer invite emails for every registered scorer in a round. */
export async function getScorerInviteContextsForRound(roundId: string): Promise<{
    email: string;
    firstName: string;
    lastName: string;
    tournamentName: string;
    assignmentId: string;
}[]> {
    const rows = (await dbQuery<{
        email: string;
        first_name: string;
        last_name: string;
        tournament_name: string;
        assignment_id: string;
    }>(`
        SELECT s.email, s.first_name, s.last_name, t.name AS tournament_name,
               spa.assignment_id
        FROM scorer_pairing_assignments spa
        JOIN scorers s      ON s.scorer_id    = spa.registered_scorer_id
        JOIN pairings p     ON p.pairing_id   = spa.pairing_id
        JOIN rounds r       ON r.round_id     = p.round_id
        JOIN tournaments t  ON t.id           = r.tournament_id
        WHERE r.round_id = $1
          AND spa.registered_scorer_id IS NOT NULL
    `, [roundId]))?.rows ?? [];

    return rows.map(r => ({
        email: r.email,
        firstName: r.first_name,
        lastName: r.last_name,
        tournamentName: r.tournament_name,
        assignmentId: r.assignment_id,
    }));
}

export async function assignScorerToPairing(pairingID: string, scorerID: string): Promise<{ assignment_id: string }> {
    const row = (await dbQuery<{ assignment_id: string }>(
        'INSERT INTO scorer_pairing_assignments (pairing_id, registered_scorer_id) VALUES ($1,$2) RETURNING assignment_id',
        [pairingID, scorerID]
    ))?.rows[0];
    if (!row) throw new DbError('assignScorerToPairing');
    return row;
}

export async function addPaperScorer(pairingID: string, name: string): Promise<{ assignment_id: string; scorer_id: string }> {
    const ps = (await dbQuery<{ scorer_id: string }>('INSERT INTO paper_scorers (pairing_id, name) VALUES ($1,$2) RETURNING scorer_id', [pairingID, name]))?.rows[0];
    if (!ps) throw new DbError('addPaperScorer');
    const row = (await dbQuery<{ assignment_id: string; scorer_id: string }>(
        'INSERT INTO scorer_pairing_assignments (pairing_id, paper_scorer_id) VALUES ($1,$2) RETURNING assignment_id, $2::uuid AS scorer_id',
        [pairingID, ps.scorer_id]
    ))?.rows[0];
    if (!row) throw new DbError('addPaperScorer assignment');
    return row;
}

export async function removeScorerAssignment(assignmentID: string): Promise<void> {
    // Delete any submitted ballot first (FK constraint prevents assignment deletion otherwise)
    await dbQuery('DELETE FROM ballots WHERE scorer_assignment_id=$1', [assignmentID]);
    const row = (await dbQuery<{ paper_scorer_id: string | null }>(
        'DELETE FROM scorer_pairing_assignments WHERE assignment_id=$1 RETURNING paper_scorer_id', [assignmentID]
    ))?.rows[0];
    if (!row) throw new NotFoundError('scorer assignment');
    if (row.paper_scorer_id) await dbQuery('DELETE FROM paper_scorers WHERE scorer_id=$1', [row.paper_scorer_id]);
}

export async function setPresider(pairingID: string, assignmentID: string): Promise<void> {
    const result = await dbQuery(
        `INSERT INTO scorer_presider_assignment (scorer_assignment_id, pairing_id) VALUES ($1,$2)
         ON CONFLICT (pairing_id) DO UPDATE SET scorer_assignment_id = EXCLUDED.scorer_assignment_id`,
        [assignmentID, pairingID]
    );
    if (!result) throw new DbError('setPresider');
}

export async function clearPresider(pairingID: string): Promise<void> {
    await dbQuery('DELETE FROM scorer_presider_assignment WHERE pairing_id=$1', [pairingID]);
}

async function duplicateWitnesses(sourceCaseFormatID: string, newFormatID: string): Promise<void> {
    const witnesses = await dbQuery<{ side: string; name: string }>('SELECT side, name FROM case_witnesses WHERE case_format=$1', [sourceCaseFormatID]);
    if (witnesses?.rows.length) {
        await Promise.all(witnesses.rows.map(w =>
            dbQuery('INSERT INTO case_witnesses (case_format, side, name) VALUES ($1,$2,$3)', [newFormatID, w.side, w.name])
        ));
    }
}

async function duplicateScoringCategories(sourceTournamentID: string, newTournamentID: string): Promise<void> {
    const cats = (await dbQuery<IScoringCategoryRow>('SELECT id, name, witness_category, position FROM scoring_categories WHERE tournament_id=$1 ORDER BY position', [sourceTournamentID]))?.rows ?? [];
    if (!cats.length) return;
    const fields = (await dbQuery<IScoringFieldRow>(
        `SELECT category_id, label, min_score, max_score, multiplier, assignable, eligible_for_award, visible_to_scorers, prosecution, defense, calling, crossing, position
         FROM scoring_fields WHERE category_id IN (${cats.map((_, i) => `$${i + 1}`).join(',')}) ORDER BY position`,
        cats.map(c => c.id)
    ))?.rows ?? [];
    await Promise.all(cats.map(async cat => {
        const newCatID = randomUUID();
        await dbQuery('INSERT INTO scoring_categories (id, tournament_id, name, witness_category, position) VALUES ($1,$2,$3,$4,$5)', [newCatID, newTournamentID, cat.name, cat.witness_category, cat.position]);
        await Promise.all(fields.filter(f => f.category_id === cat.id).map(f =>
            dbQuery(
                'INSERT INTO scoring_fields (category_id, label, min_score, max_score, multiplier, assignable, eligible_for_award, visible_to_scorers, prosecution, defense, calling, crossing, position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
                [newCatID, f.label, f.min_score, f.max_score, f.multiplier, f.assignable, f.eligible_for_award, f.visible_to_scorers, f.prosecution, f.defense, f.calling, f.crossing, f.position]
            )
        ));
    }));
}

async function duplicateScorers(sourceTournamentID: string, newTournamentID: string): Promise<void> {
    const scorers = await dbQuery<IScorer>('SELECT scorer_id, first_name, last_name, email FROM scorers WHERE tournament_id=$1', [sourceTournamentID]);
    if (scorers?.rows.length) {
        await Promise.all(scorers.rows.map(s =>
            dbQuery('INSERT INTO scorers (scorer_id, tournament_id, first_name, last_name, email) VALUES ($1,$2,$3,$4,$5)', [randomUUID(), newTournamentID, s.first_name, s.last_name, s.email])
        ));
    }
}

async function duplicateCourtrooms(sourceTournamentID: string, newTournamentID: string): Promise<void> {
    const courtrooms = await dbQuery<ICourtroomRow>('SELECT name, location FROM courtrooms WHERE tournament_id=$1', [sourceTournamentID]);
    if (courtrooms?.rows.length) {
        await Promise.all(courtrooms.rows.map(c =>
            dbQuery('INSERT INTO courtrooms (id, tournament_id, name, location) VALUES ($1,$2,$3,$4)', [randomUUID(), newTournamentID, c.name, c.location ?? null])
        ));
    }
}

async function duplicateTiebreaker(sourceTournamentID: string, newTournamentID: string): Promise<void> {
    const sourceConfig = await dbQuery<{ id: string; stats_xml: string; standings_xml: string }>(
        `SELECT sc.id, sc.stats_xml, sc.standings_xml FROM tournaments t
         JOIN standings_configs sc ON sc.id = t.standings_config_id WHERE t.id=$1`,
        [sourceTournamentID]
    );
    const cfg = sourceConfig?.rows[0];
    if (!cfg) return;
    const isTemplate = !!(await dbQuery<{ id: string }>('SELECT id FROM standings_templates WHERE config_id=$1 LIMIT 1', [cfg.id]))?.rows[0];
    if (isTemplate) {
        await dbQuery('UPDATE tournaments SET standings_config_id=$1 WHERE id=$2', [cfg.id, newTournamentID]);
    } else {
        const newCfg = (await dbQuery<{ id: string }>('INSERT INTO standings_configs (stats_xml, standings_xml) VALUES ($1,$2) RETURNING id', [cfg.stats_xml, cfg.standings_xml]))?.rows[0];
        if (newCfg) await dbQuery('UPDATE tournaments SET standings_config_id=$1 WHERE id=$2', [newCfg.id, newTournamentID]);
    }
}

export async function deleteBallot(assignmentId: string): Promise<void> {
    const row = (await dbQuery('DELETE FROM ballots WHERE scorer_assignment_id=$1 RETURNING ballot_id', [assignmentId]))?.rows[0];
    if (!row) throw new NotFoundError('ballot');
}

export async function editBallot(
    assignmentId: string,
    newPayload: { scores: { assignmentKey: string; side: 'P' | 'D'; score: number; studentId: string | null; categoryId: string }[] },
    editorEmail: string,
    reason: string,
): Promise<void> {
    // Get current ballot
    const current = (await dbQuery<{ ballot_id: string; ballot_json: string; p_points: number; d_points: number }>(
        'SELECT ballot_id, ballot_json, p_points, d_points FROM ballots WHERE scorer_assignment_id=$1',
        [assignmentId],
    ))?.rows[0];
    if (!current) throw new NotFoundError('ballot');

    const beforeJson = current.ballot_json;
    const pPointsBefore = current.p_points;
    const dPointsBefore = current.d_points;

    // Calculate new totals
    const pPointsAfter = newPayload.scores.filter(s => s.side === 'P').reduce((sum, s) => sum + s.score, 0);
    const dPointsAfter = newPayload.scores.filter(s => s.side === 'D').reduce((sum, s) => sum + s.score, 0);

    // Build new ballot_json (preserve original nominations/tiebreaker, replace scores)
    const originalBallot = typeof beforeJson === 'string' ? JSON.parse(beforeJson) : beforeJson;
    const updatedBallot = { ...originalBallot, scores: newPayload.scores };

    // Update the ballot
    const result = await dbQuery(
        'UPDATE ballots SET ballot_json=$1, p_points=$2, d_points=$3 WHERE ballot_id=$4',
        [JSON.stringify(updatedBallot), pPointsAfter, dPointsAfter, current.ballot_id],
    );
    if (!result) throw new DbError('editBallot update');

    // Insert audit log entry
    await dbQuery(
        `INSERT INTO ballot_edit_log (ballot_id, editor_email, reason, before_json, after_json, p_points_before, p_points_after, d_points_before, d_points_after)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [current.ballot_id, editorEmail, reason, JSON.stringify(typeof beforeJson === 'string' ? JSON.parse(beforeJson) : beforeJson), JSON.stringify(updatedBallot), pPointsBefore, pPointsAfter, dPointsBefore, dPointsAfter],
    );
}

export async function getBallotEditLog(assignmentId: string): Promise<{ editor_email: string; edited_at: string; reason: string; p_points_before: number; p_points_after: number; d_points_before: number; d_points_after: number }[]> {
    const rows = (await dbQuery<{ editor_email: string; edited_at: string; reason: string; p_points_before: number; p_points_after: number; d_points_before: number; d_points_after: number }>(
        `SELECT bel.editor_email, bel.edited_at, bel.reason, bel.p_points_before, bel.p_points_after, bel.d_points_before, bel.d_points_after
         FROM ballot_edit_log bel
         JOIN ballots b ON b.ballot_id = bel.ballot_id
         WHERE b.scorer_assignment_id = $1
         ORDER BY bel.edited_at DESC`,
        [assignmentId],
    ))?.rows ?? [];
    return rows;
}

export async function duplicateTournament(sourceTournamentID: string, options: IDuplicateOptions): Promise<ITournament> {
    const source = await getTournament(sourceTournamentID);
    const newTournamentID = randomUUID();
    const newFormatID = randomUUID();

    let formatRow = { case_name: '', criminal_case: false, p_witnesses_called: null as number | null, d_witnesses_called: null as number | null, has_swing: false };
    if (options.format || options.witnesses) {
        const existing = await dbQuery<typeof formatRow>(
            'SELECT case_name, criminal_case, p_witnesses_called, d_witnesses_called, has_swing FROM tournament_format WHERE format_id=$1',
            [source.case_format_id]
        );
        if (existing?.rows[0]) formatRow = existing.rows[0];
    }

    await dbQuery(
        'INSERT INTO tournament_format (format_id, case_name, criminal_case, p_witnesses_called, d_witnesses_called, has_swing) VALUES ($1,$2,$3,$4,$5,$6)',
        [newFormatID,
         options.format ? formatRow.case_name : '',
         options.format ? formatRow.criminal_case : false,
         options.format ? formatRow.p_witnesses_called : null,
         options.format ? formatRow.d_witnesses_called : null,
         options.format ? formatRow.has_swing : false]
    );
    await dbQuery(
        'INSERT INTO tournaments (id, name, location, start_date, end_date, case_format_id) VALUES ($1,$2,$3,$4,$5,$6)',
        [newTournamentID, `${source.name} (copy)`, source.location, null, null, newFormatID]
    );

    await Promise.all([
        options.witnesses        && duplicateWitnesses(source.case_format_id, newFormatID),
        options.scoringCategories && duplicateScoringCategories(sourceTournamentID, newTournamentID),
        options.scorers          && duplicateScorers(sourceTournamentID, newTournamentID),
        options.courtrooms       && duplicateCourtrooms(sourceTournamentID, newTournamentID),
        options.tiebreaker       && duplicateTiebreaker(sourceTournamentID, newTournamentID),
    ].filter(Boolean));

    const row = (await dbQuery<ITournament>('SELECT * FROM tournaments WHERE id=$1', [newTournamentID]))?.rows[0];
    if (!row) throw new DbError('duplicateTournament select');
    return row;
}