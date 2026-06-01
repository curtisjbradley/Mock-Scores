import { OrganizerProvider } from '../../src/providers/organizerProvider';
import { DuplicateDelegateError, OrganizerAlreadyJoinedError, NotFoundError } from '../../src/errors';
import { dbQuery } from '../../src/db';

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;

let provider: OrganizerProvider;

beforeEach(() => {
    jest.clearAllMocks();
    provider = new OrganizerProvider();
});

// ─── getTournaments ───────────────────────────────────────────────────────────
describe('OrganizerProvider.getTournaments', () => {
    it('returns rows on success', async () => {
        const rows = [{ id: 't1', name: 'Test' }];
        mockDbQuery.mockResolvedValueOnce({ rows, rowCount: 1 } as any);
        expect(await provider.getTournaments('u1')).toEqual(rows);
    });

    it('returns null when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        expect(await provider.getTournaments('u1')).toBeNull();
    });
});

// ─── getTournament ────────────────────────────────────────────────────────────
describe('OrganizerProvider.getTournament', () => {
    it('returns the tournament row', async () => {
        const row = { id: 't1', name: 'Test' };
        mockDbQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);
        expect(await provider.getTournament('t1')).toEqual(row);
    });

    it('returns undefined when not found', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.getTournament('t1')).toBeUndefined();
    });
});

// ─── createTournament ─────────────────────────────────────────────────────────
describe('OrganizerProvider.createTournament', () => {
    const payload = {
        tournament: { name: 'T', location: 'L', startDate: null, endDate: null },
        caseFormat: { caseName: 'C', criminalCase: false, pWitnessesCalled: 2, dWitnessesCalled: 2, hasSwing: false, pWitnessNames: [], dWitnessNames: [], swingWitnessNames: [] },
        scoringCategories: [],
        standingsConfigId: null,
    } as any;

    it('returns null when format insert fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        expect(await provider.createTournament(payload)).toBeNull();
    });

    it('returns null when tournament insert fails', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // format insert
            .mockResolvedValueOnce(null);                             // tournament insert
        expect(await provider.createTournament(payload)).toBeNull();
    });

    it('returns the created tournament on success', async () => {
        const tournament = { id: 'new-t', name: 'T' };
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // format insert
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // tournament insert
            .mockResolvedValueOnce({ rows: [tournament], rowCount: 1 } as any); // SELECT
        expect(await provider.createTournament(payload)).toEqual(tournament);
    });
});

// ─── deleteTournament ─────────────────────────────────────────────────────────
describe('OrganizerProvider.deleteTournament', () => {
    it('returns true when row deleted', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 't1' }], rowCount: 1 } as any);
        expect(await provider.deleteTournament('t1')).toBe(true);
    });

    it('returns false when nothing deleted', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.deleteTournament('t1')).toBe(false);
    });
});

// ─── addTournamentOrganizer ───────────────────────────────────────────────────
describe('OrganizerProvider.addTournamentOrganizer', () => {
    it('returns true on success', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        expect(await provider.addTournamentOrganizer('t1', 'u1', 'owner')).toBe(true);
    });

    it('returns false when query returns null', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        expect(await provider.addTournamentOrganizer('t1', 'u1', 'owner')).toBe(false);
    });
});

// ─── getScorers ───────────────────────────────────────────────────────────────
describe('OrganizerProvider.getScorers', () => {
    it('returns scorer rows', async () => {
        const rows = [{ scorer_id: 's1', first_name: 'A', last_name: 'B', email: 'a@b.com' }];
        mockDbQuery.mockResolvedValueOnce({ rows, rowCount: 1 } as any);
        expect(await provider.getScorers('t1')).toEqual(rows);
    });

    it('returns undefined when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        expect(await provider.getScorers('t1')).toBeUndefined();
    });
});

// ─── addScorer ────────────────────────────────────────────────────────────────
describe('OrganizerProvider.addScorer', () => {
    const scorer = { scorer_id: 's1', first_name: 'A', last_name: 'B', email: 'a@b.com' } as any;

    it('returns true on success', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        expect(await provider.addScorer(scorer, 't1')).toBe(true);
    });

    it('returns false when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        expect(await provider.addScorer(scorer, 't1')).toBe(false);
    });
});

// ─── updateScorer ─────────────────────────────────────────────────────────────
describe('OrganizerProvider.updateScorer', () => {
    const scorer = { scorer_id: 's1', first_name: 'A', last_name: 'B', email: 'a@b.com' } as any;

    it('returns true on success', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        expect(await provider.updateScorer(scorer, 't1')).toBe(true);
    });

    it('returns false when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        expect(await provider.updateScorer(scorer, 't1')).toBe(false);
    });
});

// ─── deleteScorer ─────────────────────────────────────────────────────────────
describe('OrganizerProvider.deleteScorer', () => {
    it('returns true on success', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        expect(await provider.deleteScorer('s1')).toBe(true);
    });

    it('returns false when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        expect(await provider.deleteScorer('s1')).toBe(false);
    });
});

// ─── getOrganizers ────────────────────────────────────────────────────────────
describe('OrganizerProvider.getOrganizers', () => {
    it('merges active and invited organizers', async () => {
        const active = [{ id: 'u1', name: 'Alice Smith', email: 'a@b.com', role: 'owner', has_joined: true }];
        const invited = [{ id: 'inv1', name: 'Bob', email: 'b@c.com', role: 'delegate', has_joined: false }];
        mockDbQuery
            .mockResolvedValueOnce({ rows: active, rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: invited, rowCount: 1 } as any);
        expect(await provider.getOrganizers('t1')).toEqual([...active, ...invited]);
    });

    it('returns empty array when both queries fail', async () => {
        mockDbQuery.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
        expect(await provider.getOrganizers('t1')).toEqual([]);
    });
});

// ─── addOrganizer ─────────────────────────────────────────────────────────────
describe('OrganizerProvider.addOrganizer', () => {
    it('creates an invite when user does not exist', async () => {
        const inviteRow = { id: 'inv1', tournament_id: 't1', name: 'Bob', email: 'b@c.com' };
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)       // SELECT auth
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)       // SELECT duplicate invite check
            .mockResolvedValueOnce({ rows: [inviteRow], rowCount: 1 } as any); // INSERT invite
        const result = await provider.addOrganizer('t1', 'Bob', 'b@c.com', 'delegate');
        expect(result).toMatchObject({ email: 'b@c.com', role: 'delegate', has_joined: false });
    });

    it('adds to tournament_owners when user exists', async () => {
        const user = { user_id: 'u1', first_name: 'Alice', last_name: 'Smith', email: 'a@b.com' };
        const ownerRow = { tournament_id: 't1', delegate_id: 'u1', role: 'delegate' };
        mockDbQuery
            .mockResolvedValueOnce({ rows: [user], rowCount: 1 } as any)       // SELECT auth
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)           // SELECT duplicate owner check
            .mockResolvedValueOnce({ rows: [ownerRow], rowCount: 1 } as any);  // INSERT owners
        const result = await provider.addOrganizer('t1', 'Alice Smith', 'a@b.com', 'delegate');
        expect(result).toMatchObject({ email: 'a@b.com', has_joined: true });
    });

    it('returns undefined when invite insert fails', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.addOrganizer('t1', 'Bob', 'b@c.com', 'delegate')).toBeUndefined();
    });

    it('throws DuplicateDelegateError when invite already exists for email', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)                              // SELECT auth
            .mockResolvedValueOnce({ rows: [{ id: 'inv1' }], rowCount: 1 } as any);              // SELECT duplicate invite
        await expect(provider.addOrganizer('t1', 'Bob', 'b@c.com', 'delegate')).rejects.toThrow(DuplicateDelegateError);
    });

    it('throws DuplicateDelegateError when user is already an owner', async () => {
        const user = { user_id: 'u1', first_name: 'Alice', last_name: 'Smith', email: 'a@b.com' };
        mockDbQuery
            .mockResolvedValueOnce({ rows: [user], rowCount: 1 } as any)                         // SELECT auth
            .mockResolvedValueOnce({ rows: [{ tournament_id: 't1' }], rowCount: 1 } as any);     // SELECT duplicate owner
        await expect(provider.addOrganizer('t1', 'Alice Smith', 'a@b.com', 'delegate')).rejects.toThrow(DuplicateDelegateError);
    });
});

// ─── updateOrganizer ──────────────────────────────────────────────────────────
describe('OrganizerProvider.updateOrganizer', () => {
    it('throws when organizer has already joined', async () => {
        const org = { id: 'u1', name: 'Alice', email: 'a@b.com', role: 'delegate', has_joined: true } as any;
        await expect(provider.updateOrganizer(org)).rejects.toThrow(OrganizerAlreadyJoinedError);
    });

    it('returns updated organizer for invite', async () => {
        const org = { id: 'inv1', name: 'Bob', email: 'b@c.com', role: 'delegate', has_joined: false } as any;
        const row = { id: 'inv1', tournament_id: 't1', name: 'Bob', email: 'new@c.com' };
        mockDbQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);
        const result = await provider.updateOrganizer(org);
        expect(result).toMatchObject({ has_joined: false, role: 'delegate' });
    });

    it('returns undefined when update finds no row', async () => {
        const org = { id: 'inv1', name: 'Bob', email: 'b@c.com', role: 'delegate', has_joined: false } as any;
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.updateOrganizer(org)).toBeUndefined();
    });
});

// ─── deleteOrganizer ──────────────────────────────────────────────────────────
describe('OrganizerProvider.deleteOrganizer', () => {
    it('deletes from tournament_owners when has_joined', async () => {
        const org = { id: 'u1', has_joined: true } as any;
        mockDbQuery.mockResolvedValueOnce({ rows: [{ delegate_id: 'u1' }], rowCount: 1 } as any);
        expect(await provider.deleteOrganizer(org)).toBe(true);
    });

    it('deletes from invites when not joined', async () => {
        const org = { id: 'inv1', has_joined: false } as any;
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'inv1' }], rowCount: 1 } as any);
        expect(await provider.deleteOrganizer(org)).toBe(true);
    });

    it('returns false when nothing deleted', async () => {
        const org = { id: 'inv1', has_joined: false } as any;
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.deleteOrganizer(org)).toBe(false);
    });
});

// ─── getCourtrooms ────────────────────────────────────────────────────────────
describe('OrganizerProvider.getCourtrooms', () => {
    it('returns courtroom rows', async () => {
        const rows = [{ id: 'c1', name: 'Room 1' }];
        mockDbQuery.mockResolvedValueOnce({ rows, rowCount: 1 } as any);
        expect(await provider.getCourtrooms('t1')).toEqual(rows);
    });
});

// ─── addCourtroom ─────────────────────────────────────────────────────────────
describe('OrganizerProvider.addCourtroom', () => {
    it('returns the inserted row', async () => {
        const row = { id: 'c1', tournament_id: 't1', name: 'Room 1', location: null };
        mockDbQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);
        expect(await provider.addCourtroom('t1', { id: 'c1', name: 'Room 1' } as any)).toEqual(row);
    });
});

// ─── updateCourtroom ──────────────────────────────────────────────────────────
describe('OrganizerProvider.updateCourtroom', () => {
    it('returns the updated row', async () => {
        const row = { id: 'c1', name: 'Updated' };
        mockDbQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);
        expect(await provider.updateCourtroom({ id: 'c1', name: 'Updated' } as any)).toEqual(row);
    });
});

// ─── deleteCourtroom ──────────────────────────────────────────────────────────
describe('OrganizerProvider.deleteCourtroom', () => {
    it('returns the deleted row', async () => {
        const row = { id: 'c1' };
        mockDbQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);
        expect(await provider.deleteCourtroom('c1')).toEqual(row);
    });
});

// ─── getRounds ────────────────────────────────────────────────────────────────
describe('OrganizerProvider.getRounds', () => {
    it('returns round rows', async () => {
        const rows = [{ round_id: 'r1', name: 'Round 1' }];
        mockDbQuery.mockResolvedValueOnce({ rows, rowCount: 1 } as any);
        expect(await provider.getRounds('t1')).toEqual(rows);
    });

    it('returns empty array when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        expect(await provider.getRounds('t1')).toEqual([]);
    });
});

// ─── getRound ─────────────────────────────────────────────────────────────────
describe('OrganizerProvider.getRound', () => {
    it('returns the round', async () => {
        const row = { round_id: 'r1', name: 'Round 1' };
        mockDbQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);
        expect(await provider.getRound('t1', 'r1')).toEqual(row);
    });

    it('returns undefined when not found', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.getRound('t1', 'r1')).toBeUndefined();
    });
});

// ─── updateTournamentDetails ──────────────────────────────────────────────────
describe('OrganizerProvider.updateTournamentDetails', () => {
    it('returns true when rowCount is 1', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        expect(await provider.updateTournamentDetails('t1', { name: 'N', location: 'L' })).toBe(true);
    });

    it('returns false when rowCount is 0', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.updateTournamentDetails('t1', { name: 'N', location: 'L' })).toBe(false);
    });
});

// ─── getStandingsTemplates ────────────────────────────────────────────────────
describe('OrganizerProvider.getStandingsTemplates', () => {
    it('returns template rows', async () => {
        const rows = [{ id: 'st1', label: 'Default', description: 'Desc', config_id: 'cfg1' }];
        mockDbQuery.mockResolvedValueOnce({ rows, rowCount: 1 } as any);
        expect(await provider.getStandingsTemplates()).toEqual(rows);
    });

    it('returns empty array when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        expect(await provider.getStandingsTemplates()).toEqual([]);
    });
});

// ─── teamNameExists ───────────────────────────────────────────────────────────
describe('OrganizerProvider.teamNameExists', () => {
    it('returns true when a team with that name exists', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'team1' }], rowCount: 1 } as any);
        expect(await provider.teamNameExists('t1', 'Eagles')).toBe(true);
    });

    it('returns false when no team found', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.teamNameExists('t1', 'Eagles')).toBe(false);
    });
});

// ─── deleteTeam ───────────────────────────────────────────────────────────────
describe('OrganizerProvider.deleteTeam', () => {
    it('returns true when team deleted', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'team1' }], rowCount: 1 } as any);
        expect(await provider.deleteTeam('team1')).toBe(true);
    });

    it('returns false when nothing deleted', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.deleteTeam('team1')).toBe(false);
    });
});

// ─── getFormat ────────────────────────────────────────────────────────────────
describe('OrganizerProvider.getFormat', () => {
    it('returns format row', async () => {
        const row = { format_id: 'f1', case_format_id: 'f1', case_name: 'Case' };
        mockDbQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);
        expect(await provider.getFormat('t1')).toEqual(row);
    });

    it('returns null when not found', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.getFormat('t1')).toBeNull();
    });
});

// ─── updateFormat ─────────────────────────────────────────────────────────────
describe('OrganizerProvider.updateFormat', () => {
    it('returns true on success', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ case_format_id: 'f1' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        expect(await provider.updateFormat('t1', { caseName: 'C', criminalCase: false, pWitnessesCalled: 2, dWitnessesCalled: 2, hasSwing: false } as any)).toBe(true);
    });

    it('returns false when format not found', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.updateFormat('t1', {} as any)).toBe(false);
    });
});

// ─── getWitnesses ─────────────────────────────────────────────────────────────
describe('OrganizerProvider.getWitnesses', () => {
    it('returns witnesses grouped by side', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ case_format_id: 'f1' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [{ side: 'P', name: 'W1' }, { side: 'D', name: 'W2' }, { side: 'S', name: 'W3' }], rowCount: 3 } as any);
        expect(await provider.getWitnesses('t1')).toEqual({ pWitnessNames: ['W1'], dWitnessNames: ['W2'], swingWitnessNames: ['W3'] });
    });

    it('returns null when format not found', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.getWitnesses('t1')).toBeNull();
    });
});

// ─── updateWitnesses ──────────────────────────────────────────────────────────
describe('OrganizerProvider.updateWitnesses', () => {
    it('returns true on success', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ case_format_id: 'f1' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // DELETE
        expect(await provider.updateWitnesses('t1', { pWitnessNames: [], dWitnessNames: [], swingWitnessNames: [] })).toBe(true);
    });

    it('returns false when format not found', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.updateWitnesses('t1', { pWitnessNames: [], dWitnessNames: [], swingWitnessNames: [] })).toBe(false);
    });
});

// ─── getScoringCategories ─────────────────────────────────────────────────────
describe('OrganizerProvider.getScoringCategories', () => {
    it('returns empty array when no categories', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.getScoringCategories('t1')).toEqual([]);
    });

    it('returns categories with fields', async () => {
        const cat = { id: 'c1', name: 'Direct', witness_category: true, position: 1 };
        const field = { id: 'f1', category_id: 'c1', label: 'Score', min_score: 1, max_score: 10, multiplier: '1', assignable: true, eligible_for_award: false, visible_to_scorers: true, prosecution: true, defense: false, calling: true, crossing: false };
        mockDbQuery
            .mockResolvedValueOnce({ rows: [cat], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [field], rowCount: 1 } as any);
        const result = await provider.getScoringCategories('t1');
        expect(result).toHaveLength(1);
        expect(result[0].fields).toHaveLength(1);
    });
});

// ─── updateScoringCategories ──────────────────────────────────────────────────
describe('OrganizerProvider.updateScoringCategories', () => {
    it('returns true', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // DELETE fields
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // DELETE categories
        expect(await provider.updateScoringCategories('t1', [])).toBe(true);
    });
});

// ─── getStandingsConfig ───────────────────────────────────────────────────────
describe('OrganizerProvider.getStandingsConfig', () => {
    it('returns config', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'sc1', stats_xml: '<s/>', standings_xml: '<st/>' }], rowCount: 1 } as any);
        expect(await provider.getStandingsConfig('t1')).toEqual({ id: 'sc1', statsXml: '<s/>', standingsXml: '<st/>' });
    });

    it('returns null when not found', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.getStandingsConfig('t1')).toBeNull();
    });
});

// ─── upsertStandingsConfig ────────────────────────────────────────────────────
describe('OrganizerProvider.upsertStandingsConfig', () => {
    it('inserts new config when none exists', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ standings_config_id: null }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [{ id: 'sc1' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        expect(await provider.upsertStandingsConfig('t1', '<s/>', '<st/>')).toBe(true);
    });

    it('updates existing non-template config', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ standings_config_id: 'sc1' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // not a template
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // UPDATE
        expect(await provider.upsertStandingsConfig('t1', '<s/>', '<st/>')).toBe(true);
    });

    it('creates new config when existing is a template', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ standings_config_id: 'sc1' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [{ id: 'sc1' }], rowCount: 1 } as any) // is template
            .mockResolvedValueOnce({ rows: [{ id: 'sc2' }], rowCount: 1 } as any) // INSERT new
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // UPDATE tournament
        expect(await provider.upsertStandingsConfig('t1', '<s/>', '<st/>')).toBe(true);
    });

    it('returns false when insert fails', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ standings_config_id: null }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // INSERT fails
        expect(await provider.upsertStandingsConfig('t1', '<s/>', '<st/>')).toBe(false);
    });
});

// ─── addTournamentOrganizer ───────────────────────────────────────────────────
describe('OrganizerProvider.addTournamentOrganizer', () => {
    it('returns true on success', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        expect(await provider.addTournamentOrganizer('t1', 'u1', 'delegate')).toBe(true);
    });
});

// ─── addTeam ──────────────────────────────────────────────────────────────────
describe('OrganizerProvider.addTeam', () => {
    it('creates invite when user does not exist', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ id: 'team1', tournament_id: 't1', name: 'Eagles', code: 'E' }], rowCount: 1 } as any) // INSERT team
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)  // SELECT auth (not found)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // INSERT invite
        const result = await provider.addTeam('t1', 'Eagles', 'coach@x.com', 'E');
        expect(result).toMatchObject({ has_joined: false, coach_email: 'coach@x.com' });
    });

    it('adds coach when user exists', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ id: 'team1', tournament_id: 't1', name: 'Eagles', code: 'E' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [{ user_id: 'u1', email: 'coach@x.com' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // INSERT coach
        const result = await provider.addTeam('t1', 'Eagles', 'coach@x.com', 'E');
        expect(result).toMatchObject({ has_joined: true });
    });

    it('returns undefined when team insert fails', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.addTeam('t1', 'Eagles', 'coach@x.com', 'E')).toBeUndefined();
    });
});

// ─── updateTeam ───────────────────────────────────────────────────────────────
describe('OrganizerProvider.updateTeam', () => {
    it('throws NotFoundError when team not found', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        await expect(provider.updateTeam('team1', 'Eagles', 'c@x.com', 'E')).rejects.toThrow(NotFoundError);
    });

    it('updates invite email when no joined coach and invite exists', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ id: 'team1', tournament_id: 't1' }], rowCount: 1 } as any) // SELECT team
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)  // UPDATE teams
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)  // SELECT coach (none)
            .mockResolvedValueOnce({ rows: [{ id: 'inv1' }], rowCount: 1 } as any) // SELECT invite (exists)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // UPDATE invite
        const result = await provider.updateTeam('team1', 'Eagles', 'new@x.com', 'E');
        expect(result).toMatchObject({ has_joined: false, coach_email: 'new@x.com' });
    });

    it('inserts invite when no joined coach and no existing invite', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ id: 'team1', tournament_id: 't1' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)  // UPDATE teams
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)  // SELECT coach (none)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)  // SELECT invite (none)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // INSERT invite
        const result = await provider.updateTeam('team1', 'Eagles', 'new@x.com', 'E');
        expect(result).toMatchObject({ has_joined: false });
    });

    it('returns has_joined true when coach exists', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ id: 'team1', tournament_id: 't1' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)  // UPDATE teams
            .mockResolvedValueOnce({ rows: [{ coach_id: 'u1' }], rowCount: 1 } as any); // SELECT coach
        const result = await provider.updateTeam('team1', 'Eagles', 'c@x.com', 'E');
        expect(result).toMatchObject({ has_joined: true });
    });
});

// ─── createRound ──────────────────────────────────────────────────────────────
describe('OrganizerProvider.createRound', () => {
    it('returns new round', async () => {
        const row = { round_id: 'r1', name: 'Round 1' };
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ num_rounds: '0' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);
        expect(await provider.createRound('t1')).toEqual(row);
    });

    it('returns null when insert fails', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ num_rounds: '2' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.createRound('t1')).toBeNull();
    });
});

// ─── deleteRound ──────────────────────────────────────────────────────────────
describe('OrganizerProvider.deleteRound', () => {
    it('returns deleted row', async () => {
        const row = { round_id: 'r1' };
        mockDbQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);
        expect(await provider.deleteRound('r1')).toEqual(row);
    });

    it('returns null when not found', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.deleteRound('r1')).toBeNull();
    });
});

// ─── updateRound ──────────────────────────────────────────────────────────────
describe('OrganizerProvider.updateRound', () => {
    it('returns updated round', async () => {
        const row = { round_id: 'r1', name: 'Round 1' };
        mockDbQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);
        expect(await provider.updateRound('r1', { name: 'Round 1' } as any)).toEqual(row);
    });

    it('returns null when not found', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.updateRound('r1', {} as any)).toBeNull();
    });
});

// ─── createRoundPairing ───────────────────────────────────────────────────────
describe('OrganizerProvider.createRoundPairing', () => {
    it('returns new pairing', async () => {
        const row = { pairing_id: 'p1' };
        mockDbQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);
        expect(await provider.createRoundPairing('r1', 'team1', 'team2', 'c1')).toEqual(row);
    });
});

// ─── getPairings ──────────────────────────────────────────────────────────────
describe('OrganizerProvider.getPairings', () => {
    it('returns pairing rows', async () => {
        const rows = [{ pairing_id: 'p1' }];
        mockDbQuery.mockResolvedValueOnce({ rows, rowCount: 1 } as any);
        expect(await provider.getPairings('r1')).toEqual(rows);
    });

    it('returns empty array when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        expect(await provider.getPairings('r1')).toEqual([]);
    });
});

// ─── deletePairing ────────────────────────────────────────────────────────────
describe('OrganizerProvider.deletePairing', () => {
    it('returns true when deleted', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ pairing_id: 'p1' }], rowCount: 1 } as any);
        expect(await provider.deletePairing('p1')).toBe(true);
    });

    it('returns false when not found', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.deletePairing('p1')).toBe(false);
    });
});

// ─── getPairingScorers ────────────────────────────────────────────────────────
describe('OrganizerProvider.getPairingScorers', () => {
    it('returns registered and paper scorers with presider flag', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ scorer_assignment_id: 'a1' }], rowCount: 1 } as any) // presider
            .mockResolvedValueOnce({ rows: [{ assignment_id: 'a1', scorer_id: 's1', first_name: 'A', last_name: 'B' }], rowCount: 1 } as any) // registered
            .mockResolvedValueOnce({ rows: [{ assignment_id: 'a2', scorer_id: 'ps1', name: 'Paper' }], rowCount: 1 } as any); // paper
        const result = await provider.getPairingScorers('p1');
        expect(result).toHaveLength(2);
        expect(result.find(r => r.assignment_id === 'a1')?.is_presider).toBe(true);
        expect(result.find(r => r.assignment_id === 'a2')?.is_presider).toBe(false);
    });
});

// ─── assignScorerToPairing ────────────────────────────────────────────────────
describe('OrganizerProvider.assignScorerToPairing', () => {
    it('returns assignment_id on success', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ assignment_id: 'a1' }], rowCount: 1 } as any);
        expect(await provider.assignScorerToPairing('p1', 's1')).toEqual({ assignment_id: 'a1' });
    });

    it('returns null when insert fails', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.assignScorerToPairing('p1', 's1')).toBeNull();
    });
});

// ─── addPaperScorer ───────────────────────────────────────────────────────────
describe('OrganizerProvider.addPaperScorer', () => {
    it('returns assignment and scorer id on success', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ scorer_id: 'ps1' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [{ assignment_id: 'a1', scorer_id: 'ps1' }], rowCount: 1 } as any);
        expect(await provider.addPaperScorer('p1', 'Paper')).toEqual({ assignment_id: 'a1', scorer_id: 'ps1' });
    });

    it('returns null when paper scorer insert fails', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.addPaperScorer('p1', 'Paper')).toBeNull();
    });
});

// ─── removeScorerAssignment ───────────────────────────────────────────────────
describe('OrganizerProvider.removeScorerAssignment', () => {
    it('returns false when assignment not found', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.removeScorerAssignment('a1')).toBe(false);
    });

    it('returns true for registered scorer (no paper cleanup)', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ paper_scorer_id: null }], rowCount: 1 } as any);
        expect(await provider.removeScorerAssignment('a1')).toBe(true);
    });

    it('cleans up paper scorer row', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ paper_scorer_id: 'ps1' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // DELETE paper_scorer
        expect(await provider.removeScorerAssignment('a1')).toBe(true);
    });
});

// ─── setPresider / clearPresider ──────────────────────────────────────────────
describe('OrganizerProvider.setPresider', () => {
    it('returns true on success', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        expect(await provider.setPresider('p1', 'a1')).toBe(true);
    });
});

describe('OrganizerProvider.clearPresider', () => {
    it('returns true', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        expect(await provider.clearPresider('p1')).toBe(true);
    });
});

// ─── createTournament ─────────────────────────────────────────────────────────
describe('OrganizerProvider.createTournament', () => {
    const payload = {
        tournament: { name: 'T', location: 'L', startDate: null, endDate: null },
        caseFormat: { caseName: 'C', criminalCase: false, pWitnessesCalled: 1, dWitnessesCalled: 1, hasSwing: false, pWitnessNames: ['W1'], dWitnessNames: ['W2'], swingWitnessNames: [] },
        scoringCategories: [],
        standingsConfigId: null,
    } as any;

    it('returns tournament on success', async () => {
        const tournament = { id: 't1', name: 'T' };
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // INSERT format
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // INSERT tournament
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // INSERT witness P
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // INSERT witness D
            .mockResolvedValueOnce({ rows: [tournament], rowCount: 1 } as any); // SELECT
        expect(await provider.createTournament(payload)).toEqual(tournament);
    });

    it('returns null when format insert fails', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.createTournament(payload)).toBeNull();
    });

    it('returns null when tournament insert fails', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // INSERT format ok
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // INSERT tournament fails
        expect(await provider.createTournament(payload)).toBeNull();
    });
});

// ─── updateTournament ─────────────────────────────────────────────────────────
describe('OrganizerProvider.updateTournament', () => {
    const payload = {
        tournament: { name: 'T', location: 'L', startDate: null, endDate: null },
        caseFormat: { caseName: 'C', criminalCase: false, pWitnessesCalled: 1, dWitnessesCalled: 1, hasSwing: false, pWitnessNames: [], dWitnessNames: [], swingWitnessNames: [] },
        scoringCategories: [],
    } as any;

    it('returns true on success', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // UPDATE tournaments
            .mockResolvedValueOnce({ rows: [{ case_format_id: 'f1' }], rowCount: 1 } as any) // SELECT format
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // UPDATE format
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // DELETE witnesses
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // DELETE fields
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // DELETE categories
        expect(await provider.updateTournament('t1', payload)).toBe(true);
    });

    it('returns false when update fails', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.updateTournament('t1', payload)).toBe(false);
    });

    it('returns false when format not found', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // UPDATE ok
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // SELECT format (not found)
        expect(await provider.updateTournament('t1', payload)).toBe(false);
    });
});