import { OrganizerProvider } from '../../src/providers/organizerProvider';
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
            .mockResolvedValueOnce({ rows: [inviteRow], rowCount: 1 } as any); // INSERT invite
        const result = await provider.addOrganizer('t1', 'Bob', 'b@c.com', 'delegate');
        expect(result).toMatchObject({ email: 'b@c.com', role: 'delegate', has_joined: false });
    });

    it('adds to tournament_owners when user exists', async () => {
        const user = { user_id: 'u1', first_name: 'Alice', last_name: 'Smith', email: 'a@b.com' };
        const ownerRow = { tournament_id: 't1', delegate_id: 'u1', role: 'delegate' };
        mockDbQuery
            .mockResolvedValueOnce({ rows: [user], rowCount: 1 } as any)       // SELECT auth
            .mockResolvedValueOnce({ rows: [ownerRow], rowCount: 1 } as any);  // INSERT owners
        const result = await provider.addOrganizer('t1', 'Alice Smith', 'a@b.com', 'delegate');
        expect(result).toMatchObject({ email: 'a@b.com', has_joined: true });
    });

    it('returns undefined when invite insert fails', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        expect(await provider.addOrganizer('t1', 'Bob', 'b@c.com', 'delegate')).toBeUndefined();
    });
});

// ─── updateOrganizer ──────────────────────────────────────────────────────────
describe('OrganizerProvider.updateOrganizer', () => {
    it('throws when organizer has already joined', async () => {
        const org = { id: 'u1', name: 'Alice', email: 'a@b.com', role: 'delegate', has_joined: true } as any;
        await expect(provider.updateOrganizer(org)).rejects.toThrow('Organizer has already created an account');
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
