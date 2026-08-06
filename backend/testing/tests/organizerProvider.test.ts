jest.mock('../../src/email', () => jest.requireActual('../mocks/email'));
import * as provider from '../../src/providers/organizerProvider';
import { AlreadyExistsError, DbError, NotFoundError, OrganizerAlreadyJoinedError } from '../../src/errors';
import { dbQuery } from '../../src/db';

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;
const ok = (rows: unknown[] = [], rowCount = rows.length) =>
    ({ rows, rowCount } as any);

beforeEach(() => jest.clearAllMocks());

// ─── getTournaments ───────────────────────────────────────────────────────────
describe('getTournaments', () => {
    it('returns rows on success', async () => {
        const rows = [{ id: 't1' }];
        mockDbQuery.mockResolvedValueOnce(ok(rows));
        expect(await provider.getTournaments('u1')).toEqual(rows);
    });
    it('throws DbError when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(provider.getTournaments('u1')).rejects.toThrow(DbError);
    });
});

// ─── getTournament ────────────────────────────────────────────────────────────
describe('getTournament', () => {
    it('returns the row', async () => {
        const row = { id: 't1' };
        mockDbQuery.mockResolvedValueOnce(ok([row]));
        expect(await provider.getTournament('t1')).toEqual(row);
    });
    it('throws NotFoundError when not found', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.getTournament('t1')).rejects.toThrow(NotFoundError);
    });
});

// ─── createTournament ─────────────────────────────────────────────────────────
describe('createTournament', () => {
    const payload = {
        tournament: { name: 'T', location: 'L', startDate: null, endDate: null },
        caseFormat: { caseName: 'C', criminalCase: false, pWitnessesCalled: 1, dWitnessesCalled: 1, hasSwing: false, pWitnessNames: ['W1'], dWitnessNames: ['W2'], swingWitnessNames: [] },
        scoringCategories: [],
        standingsConfigId: null,
    } as any;

    it('returns the created tournament', async () => {
        const tournament = { id: 't1' };
        mockDbQuery
            .mockResolvedValueOnce(ok([], 1))   // INSERT format
            .mockResolvedValueOnce(ok([], 1))   // INSERT tournament
            .mockResolvedValueOnce(ok([], 1))   // INSERT witness P
            .mockResolvedValueOnce(ok([], 1))   // INSERT witness D
            .mockResolvedValueOnce(ok([tournament])); // SELECT
        expect(await provider.createTournament(payload)).toEqual(tournament);
    });
    it('throws DbError when format insert fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(provider.createTournament(payload)).rejects.toThrow(DbError);
    });
    it('throws DbError when tournament insert fails', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([], 1))
            .mockResolvedValueOnce(null);
        await expect(provider.createTournament(payload)).rejects.toThrow(DbError);
    });
});

// ─── deleteTournament ─────────────────────────────────────────────────────────
describe('deleteTournament', () => {
    it('resolves when deleted', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([{ id: 't1' }]));
        await expect(provider.deleteTournament('t1')).resolves.toBeUndefined();
    });
    it('throws NotFoundError when nothing deleted', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.deleteTournament('t1')).rejects.toThrow(NotFoundError);
    });
});

// ─── addTournamentOrganizer ───────────────────────────────────────────────────
describe('addTournamentOrganizer', () => {
    it('resolves on success', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.addTournamentOrganizer('t1', 'u1', 'owner')).resolves.toBeUndefined();
    });
    it('throws DbError when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(provider.addTournamentOrganizer('t1', 'u1', 'owner')).rejects.toThrow(DbError);
    });
});

// ─── getScorers ───────────────────────────────────────────────────────────────
describe('getScorers', () => {
    it('returns rows', async () => {
        const rows = [{ scorer_id: 's1' }];
        mockDbQuery.mockResolvedValueOnce(ok(rows));
        expect(await provider.getScorers('t1')).toEqual(rows);
    });
    it('throws DbError when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(provider.getScorers('t1')).rejects.toThrow(DbError);
    });
});

// ─── addScorer ────────────────────────────────────────────────────────────────
describe('addScorer', () => {
    const scorer = { scorer_id: 's1', first_name: 'A', last_name: 'B', email: 'a@b.com' } as any;
    it('resolves on success', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.addScorer(scorer, 't1')).resolves.toBeUndefined();
    });
    it('throws DbError when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(provider.addScorer(scorer, 't1')).rejects.toThrow(DbError);
    });
});

// ─── updateScorer ─────────────────────────────────────────────────────────────
describe('updateScorer', () => {
    const scorer = { scorer_id: 's1', first_name: 'A', last_name: 'B', email: 'a@b.com' } as any;
    it('resolves on success', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([], 1));
        await expect(provider.updateScorer(scorer, 't1')).resolves.toBeUndefined();
    });
    it('throws NotFoundError when no row matched', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([], 0));
        await expect(provider.updateScorer(scorer, 't1')).rejects.toThrow(NotFoundError);
    });
    it('throws DbError when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(provider.updateScorer(scorer, 't1')).rejects.toThrow(DbError);
    });
});

// ─── deleteScorer ─────────────────────────────────────────────────────────────
describe('deleteScorer', () => {
    it('resolves on success', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([{ scorer_id: 's1' }]));
        await expect(provider.deleteScorer('s1')).resolves.toBeUndefined();
    });
    it('throws NotFoundError when scorer not found', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.deleteScorer('s1')).rejects.toThrow(NotFoundError);
    });
    it('throws DbError when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(provider.deleteScorer('s1')).rejects.toThrow(DbError);
    });
});

// ─── getAllConflicts / getConflicts / addConflict / removeConflict ─────────────
describe('getAllConflicts', () => {
    it('returns rows', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([{ scorer_id: 's1', team_id: 'tm1' }]));
        expect(await provider.getAllConflicts('t1')).toHaveLength(1);
    });
    it('throws DbError when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(provider.getAllConflicts('t1')).rejects.toThrow(DbError);
    });
});

describe('addConflict', () => {
    it('returns the conflict row', async () => {
        const row = { id: 'cf1', scorer_id: 's1', team_id: 'tm1', team_name: 'Eagles' };
        mockDbQuery.mockResolvedValueOnce(ok([row]));
        expect(await provider.addConflict('s1', 'tm1')).toEqual(row);
    });
    it('throws AlreadyExistsError when conflict already exists (ON CONFLICT DO NOTHING)', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.addConflict('s1', 'tm1')).rejects.toThrow(AlreadyExistsError);
    });
});

describe('removeConflict', () => {
    it('resolves when deleted', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([{ scorer_id: 's1' }]));
        await expect(provider.removeConflict('s1', 'tm1')).resolves.toBeUndefined();
    });
    it('throws NotFoundError when not found', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.removeConflict('s1', 'tm1')).rejects.toThrow(NotFoundError);
    });
});

// ─── getOrganizers ────────────────────────────────────────────────────────────
describe('getOrganizers', () => {
    it('merges active and invited', async () => {
        const active = [{ id: 'u1', name: 'Alice', email: 'a@b.com', role: 'owner', has_joined: true }];
        const invited = [{ id: 'inv1', name: 'Bob', email: 'b@c.com', role: 'delegate', has_joined: false }];
        mockDbQuery
            .mockResolvedValueOnce(ok(active))
            .mockResolvedValueOnce(ok(invited));
        expect(await provider.getOrganizers('t1')).toEqual([...active, ...invited]);
    });
    it('throws DbError when either query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
        await expect(provider.getOrganizers('t1')).rejects.toThrow(DbError);
    });
});

// ─── addOrganizer ─────────────────────────────────────────────────────────────
describe('addOrganizer', () => {
    it('creates an invite when user does not exist', async () => {
        const inviteRow = { id: 'inv1', tournament_id: 't1', name: 'Bob', email: 'b@c.com' };
        mockDbQuery
            .mockResolvedValueOnce(ok([]))                // SELECT auth
            .mockResolvedValueOnce(ok([]))                // SELECT duplicate invite
            .mockResolvedValueOnce(ok([inviteRow]));      // INSERT invite
        const result = await provider.addOrganizer('t1', 'Bob', 'b@c.com', 'delegate');
        expect(result).toMatchObject({ role: 'delegate', has_joined: false });
    });
    it('adds owner row when user exists', async () => {
        const user = { user_id: 'u1', first_name: 'Alice', last_name: 'Smith', email: 'a@b.com' };
        const ownerRow = { tournament_id: 't1', delegate_id: 'u1', role: 'delegate' };
        mockDbQuery
            .mockResolvedValueOnce(ok([user]))            // SELECT auth
            .mockResolvedValueOnce(ok([]))                // SELECT duplicate owner
            .mockResolvedValueOnce(ok([ownerRow]));       // INSERT owner
        const result = await provider.addOrganizer('t1', 'Alice', 'a@b.com', 'delegate');
        expect(result).toMatchObject({ has_joined: true });
    });
    it('throws AlreadyExistsError when invite already exists', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([]))                         // SELECT auth
            .mockResolvedValueOnce(ok([{ id: 'inv1' }]));         // SELECT duplicate invite
        await expect(provider.addOrganizer('t1', 'Bob', 'b@c.com', 'delegate')).rejects.toThrow(AlreadyExistsError);
    });
    it('throws AlreadyExistsError when user already an owner', async () => {
        const user = { user_id: 'u1', first_name: 'Alice', last_name: 'Smith', email: 'a@b.com' };
        mockDbQuery
            .mockResolvedValueOnce(ok([user]))
            .mockResolvedValueOnce(ok([{ tournament_id: 't1' }])); // duplicate owner
        await expect(provider.addOrganizer('t1', 'Alice', 'a@b.com', 'delegate')).rejects.toThrow(AlreadyExistsError);
    });
    it('throws DbError when invite insert fails', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([]))
            .mockResolvedValueOnce(ok([]))
            .mockResolvedValueOnce(null);
        await expect(provider.addOrganizer('t1', 'Bob', 'b@c.com', 'delegate')).rejects.toThrow(DbError);
    });
});

// ─── updateOrganizer ──────────────────────────────────────────────────────────
describe('updateOrganizer', () => {
    it('returns updated invite row', async () => {
        const org = { id: 'inv1', name: 'Bob', email: 'new@c.com', role: 'delegate', has_joined: false } as any;
        const row = { id: 'inv1', tournament_id: 't1', name: 'Bob', email: 'new@c.com' };
        mockDbQuery.mockResolvedValueOnce(ok([row]));
        const result = await provider.updateOrganizer(org);
        expect(result).toMatchObject({ has_joined: false, role: 'delegate' });
    });
    it('throws OrganizerAlreadyJoinedError when has_joined', async () => {
        const org = { id: 'u1', has_joined: true } as any;
        await expect(provider.updateOrganizer(org)).rejects.toThrow(OrganizerAlreadyJoinedError);
    });
    it('throws NotFoundError when no row updated', async () => {
        const org = { id: 'inv1', name: 'Bob', email: 'b@c.com', has_joined: false } as any;
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.updateOrganizer(org)).rejects.toThrow(NotFoundError);
    });
});

// ─── deleteOrganizer ──────────────────────────────────────────────────────────
describe('deleteOrganizer', () => {
    it('deletes from tournament_owners when has_joined', async () => {
        const org = { id: 'u1', has_joined: true } as any;
        mockDbQuery.mockResolvedValueOnce(ok([{ delegate_id: 'u1' }]));
        await expect(provider.deleteOrganizer(org)).resolves.toBeUndefined();
    });
    it('deletes from invites when not joined', async () => {
        const org = { id: 'inv1', has_joined: false } as any;
        mockDbQuery.mockResolvedValueOnce(ok([{ id: 'inv1' }]));
        await expect(provider.deleteOrganizer(org)).resolves.toBeUndefined();
    });
    it('throws NotFoundError when nothing deleted', async () => {
        const org = { id: 'inv1', has_joined: false } as any;
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.deleteOrganizer(org)).rejects.toThrow(NotFoundError);
    });
});

// ─── getCourtrooms / addCourtroom / updateCourtroom / deleteCourtroom ─────────
describe('getCourtrooms', () => {
    it('returns rows', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([{ id: 'c1' }]));
        expect(await provider.getCourtrooms('t1')).toEqual([{ id: 'c1' }]);
    });
    it('throws DbError when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(provider.getCourtrooms('t1')).rejects.toThrow(DbError);
    });
});

describe('addCourtroom', () => {
    it('returns the inserted row', async () => {
        const row = { id: 'c1', name: 'Room 1' };
        mockDbQuery.mockResolvedValueOnce(ok([row]));
        expect(await provider.addCourtroom('t1', { id: 'c1', name: 'Room 1' } as any)).toEqual(row);
    });
    it('throws DbError when insert fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(provider.addCourtroom('t1', { id: 'c1', name: 'Room 1' } as any)).rejects.toThrow(DbError);
    });
});

describe('updateCourtroom', () => {
    it('returns updated row', async () => {
        const row = { id: 'c1', name: 'Updated' };
        mockDbQuery.mockResolvedValueOnce(ok([row]));
        expect(await provider.updateCourtroom({ id: 'c1', name: 'Updated' } as any)).toEqual(row);
    });
    it('throws NotFoundError when not found', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.updateCourtroom({ id: 'c1', name: 'X' } as any)).rejects.toThrow(NotFoundError);
    });
});

describe('deleteCourtroom', () => {
    it('resolves when deleted', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([{ id: 'c1' }]));
        await expect(provider.deleteCourtroom('c1')).resolves.toBeUndefined();
    });
    it('throws NotFoundError when not found', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.deleteCourtroom('c1')).rejects.toThrow(NotFoundError);
    });
});

// ─── getRounds / getRound / createRound / deleteRound / updateRound ───────────
describe('getRounds', () => {
    it('returns rows', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([{ round_id: 'r1' }]));
        expect(await provider.getRounds('t1')).toHaveLength(1);
    });
    it('throws DbError when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(provider.getRounds('t1')).rejects.toThrow(DbError);
    });
});

describe('getRound', () => {
    it('returns the round', async () => {
        const row = { round_id: 'r1' };
        mockDbQuery.mockResolvedValueOnce(ok([row]));
        expect(await provider.getRound('t1', 'r1')).toEqual(row);
    });
    it('throws NotFoundError when not found', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.getRound('t1', 'r1')).rejects.toThrow(NotFoundError);
    });
});

describe('createRound', () => {
    it('returns new round', async () => {
        const row = { round_id: 'r1', name: 'Round 1' };
        mockDbQuery
            .mockResolvedValueOnce(ok([{ num_rounds: '0' }]))
            .mockResolvedValueOnce(ok([row]));
        expect(await provider.createRound('t1')).toEqual(row);
    });
    it('throws DbError when insert fails', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([{ num_rounds: '0' }]))
            .mockResolvedValueOnce(null);
        await expect(provider.createRound('t1')).rejects.toThrow(DbError);
    });
});

describe('deleteRound', () => {
    it('returns deleted row', async () => {
        const row = { round_id: 'r1' };
        mockDbQuery.mockResolvedValueOnce(ok([row]));
        expect(await provider.deleteRound('r1')).toEqual(row);
    });
    it('throws NotFoundError when not found', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.deleteRound('r1')).rejects.toThrow(NotFoundError);
    });
});

describe('updateRound', () => {
    it('returns updated round', async () => {
        const row = { round_id: 'r1', name: 'Round 1' };
        mockDbQuery.mockResolvedValueOnce(ok([row]));
        expect(await provider.updateRound('r1', { name: 'Round 1' } as any)).toEqual(row);
    });
    it('throws NotFoundError when not found', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.updateRound('r1', {} as any)).rejects.toThrow(NotFoundError);
    });
});

// ─── getTeams / addTeam / updateTeam / deleteTeam ─────────────────────────────
describe('addTeam', () => {
    it('creates invite when user not found', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([{ id: 'tm1', tournament_id: 't1', name: 'Eagles', code: 'E' }]))
            .mockResolvedValueOnce(ok([]))   // SELECT auth
            .mockResolvedValueOnce(ok([]));  // INSERT invite
        expect(await provider.addTeam('t1', 'Eagles', 'c@x.com', 'E')).toMatchObject({ has_joined: false });
    });
    it('adds coach when user exists', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([{ id: 'tm1', tournament_id: 't1', name: 'Eagles', code: 'E' }]))
            .mockResolvedValueOnce(ok([{ user_id: 'u1', email: 'c@x.com' }]))
            .mockResolvedValueOnce(ok([]));
        expect(await provider.addTeam('t1', 'Eagles', 'c@x.com', 'E')).toMatchObject({ has_joined: true });
    });
    it('throws DbError when team insert fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(provider.addTeam('t1', 'Eagles', 'c@x.com', 'E')).rejects.toThrow(DbError);
    });
});

describe('updateTeam', () => {
    it('throws NotFoundError when team not found', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.updateTeam('tm1', 'Eagles', 'c@x.com', 'E')).rejects.toThrow(NotFoundError);
    });
    it('returns has_joined true when coach exists', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([{ id: 'tm1', tournament_id: 't1' }]))
            .mockResolvedValueOnce(ok([], 1))           // UPDATE teams
            .mockResolvedValueOnce(ok([{ coach_id: 'u1' }])); // coach found
        expect(await provider.updateTeam('tm1', 'Eagles', 'c@x.com', 'E')).toMatchObject({ has_joined: true });
    });
    it('returns has_joined false and updates invite when no coach', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([{ id: 'tm1', tournament_id: 't1' }]))
            .mockResolvedValueOnce(ok([], 1))          // UPDATE teams
            .mockResolvedValueOnce(ok([]))             // no coach
            .mockResolvedValueOnce(ok([{ id: 'inv' }])) // invite exists
            .mockResolvedValueOnce(ok([], 1));          // UPDATE invite
        expect(await provider.updateTeam('tm1', 'Eagles', 'c@x.com', 'E')).toMatchObject({ has_joined: false });
    });
});

describe('deleteTeam', () => {
    it('resolves when deleted', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([{ id: 'tm1' }]));
        await expect(provider.deleteTeam('tm1')).resolves.toBeUndefined();
    });
    it('throws NotFoundError when not found', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.deleteTeam('tm1')).rejects.toThrow(NotFoundError);
    });
});

// ─── createRoundPairing / getPairings / deletePairing ────────────────────────
describe('createRoundPairing', () => {
    it('returns new pairing', async () => {
        const row = { pairing_id: 'p1' };
        mockDbQuery.mockResolvedValueOnce(ok([row]));
        expect(await provider.createRoundPairing('r1', 'tm1', 'tm2', 'c1')).toEqual(row);
    });
    it('throws DbError when insert fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(provider.createRoundPairing('r1', 'tm1', 'tm2', 'c1')).rejects.toThrow(DbError);
    });
});

describe('getPairings', () => {
    it('returns rows', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([{ pairing_id: 'p1' }]));
        expect(await provider.getPairings('r1')).toHaveLength(1);
    });
    it('throws DbError when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(provider.getPairings('r1')).rejects.toThrow(DbError);
    });
});

describe('deletePairing', () => {
    it('resolves when deleted', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([{ pairing_id: 'p1' }]));
        await expect(provider.deletePairing('p1')).resolves.toBeUndefined();
    });
    it('throws NotFoundError when not found', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.deletePairing('p1')).rejects.toThrow(NotFoundError);
    });
});

// ─── getPairingScorers ────────────────────────────────────────────────────────
describe('getPairingScorers', () => {
    it('returns scorers with presider flag', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([{ scorer_assignment_id: 'a1' }]))
            .mockResolvedValueOnce(ok([{ assignment_id: 'a1', scorer_id: 's1', first_name: 'A', last_name: 'B' }]))
            .mockResolvedValueOnce(ok([{ assignment_id: 'a2', scorer_id: 'ps1', name: 'Paper' }]));
        const result = await provider.getPairingScorers('p1');
        expect(result).toHaveLength(2);
        expect(result.find(r => r.assignment_id === 'a1')?.is_presider).toBe(true);
        expect(result.find(r => r.assignment_id === 'a2')?.is_presider).toBe(false);
    });
});

// ─── assignScorerToPairing / addPaperScorer / removeScorerAssignment ──────────
describe('assignScorerToPairing', () => {
    it('returns assignment', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([{ assignment_id: 'a1' }]));
        expect(await provider.assignScorerToPairing('p1', 's1')).toEqual({ assignment_id: 'a1' });
    });
    it('throws DbError when insert fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(provider.assignScorerToPairing('p1', 's1')).rejects.toThrow(DbError);
    });
});

describe('addPaperScorer', () => {
    it('returns assignment and scorer id', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([{ scorer_id: 'ps1' }]))
            .mockResolvedValueOnce(ok([{ assignment_id: 'a1', scorer_id: 'ps1' }]));
        expect(await provider.addPaperScorer('p1', 'Paper')).toEqual({ assignment_id: 'a1', scorer_id: 'ps1' });
    });
    it('throws DbError when paper scorer insert fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(provider.addPaperScorer('p1', 'Paper')).rejects.toThrow(DbError);
    });
});

describe('removeScorerAssignment', () => {
    it('resolves for registered scorer', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([])); // DELETE ballots
        mockDbQuery.mockResolvedValueOnce(ok([{ paper_scorer_id: null }]));
        await expect(provider.removeScorerAssignment('a1')).resolves.toBeUndefined();
    });
    it('cleans up paper scorer row', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([])) // DELETE ballots
            .mockResolvedValueOnce(ok([{ paper_scorer_id: 'ps1' }]))
            .mockResolvedValueOnce(ok([]));
        await expect(provider.removeScorerAssignment('a1')).resolves.toBeUndefined();
    });
    it('throws NotFoundError when assignment not found', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([])); // DELETE ballots
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.removeScorerAssignment('a1')).rejects.toThrow(NotFoundError);
    });
});

// ─── setPresider / clearPresider ──────────────────────────────────────────────
describe('setPresider', () => {
    it('resolves on success', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.setPresider('p1', 'a1')).resolves.toBeUndefined();
    });
    it('throws DbError when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(provider.setPresider('p1', 'a1')).rejects.toThrow(DbError);
    });
});

describe('clearPresider', () => {
    it('resolves regardless of rows deleted', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.clearPresider('p1')).resolves.toBeUndefined();
    });
});

// ─── getFormat / updateFormat / getWitnesses / updateWitnesses ────────────────
describe('getFormat', () => {
    it('returns format row', async () => {
        const row = { format_id: 'f1', case_format_id: 'f1', case_name: 'Case' };
        mockDbQuery.mockResolvedValueOnce(ok([row]));
        expect(await provider.getFormat('t1')).toEqual(row);
    });
    it('throws NotFoundError when not found', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.getFormat('t1')).rejects.toThrow(NotFoundError);
    });
});

describe('updateFormat', () => {
    it('resolves on success', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([{ case_format_id: 'f1' }]))
            .mockResolvedValueOnce(ok([], 1));
        await expect(provider.updateFormat('t1', { caseName: 'C' } as any)).resolves.toBeUndefined();
    });
    it('throws NotFoundError when tournament not found', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.updateFormat('t1', {} as any)).rejects.toThrow(NotFoundError);
    });
});

describe('getWitnesses', () => {
    it('returns witnesses grouped by side', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([{ case_format_id: 'f1' }]))
            .mockResolvedValueOnce(ok([{ side: 'P', name: 'W1' }, { side: 'D', name: 'W2' }, { side: 'S', name: 'W3' }]));
        expect(await provider.getWitnesses('t1')).toEqual({ pWitnessNames: ['W1'], dWitnessNames: ['W2'], swingWitnessNames: ['W3'] });
    });
    it('throws NotFoundError when tournament not found', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.getWitnesses('t1')).rejects.toThrow(NotFoundError);
    });
});

describe('updateWitnesses', () => {
    it('resolves on success', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([{ case_format_id: 'f1' }]))
            .mockResolvedValueOnce(ok([])); // DELETE
        await expect(provider.updateWitnesses('t1', { pWitnessNames: [], dWitnessNames: [], swingWitnessNames: [] })).resolves.toBeUndefined();
    });
    it('throws NotFoundError when tournament not found', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.updateWitnesses('t1', { pWitnessNames: [], dWitnessNames: [], swingWitnessNames: [] })).rejects.toThrow(NotFoundError);
    });
});

// ─── updateTournamentDetails ──────────────────────────────────────────────────
describe('updateTournamentDetails', () => {
    it('resolves when rowCount is 1', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([], 1));
        await expect(provider.updateTournamentDetails('t1', { name: 'N', location: 'L' })).resolves.toBeUndefined();
    });
    it('throws NotFoundError when rowCount is 0', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([], 0));
        await expect(provider.updateTournamentDetails('t1', { name: 'N', location: 'L' })).rejects.toThrow(NotFoundError);
    });
    it('throws DbError when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(provider.updateTournamentDetails('t1', { name: 'N', location: 'L' })).rejects.toThrow(DbError);
    });
});

// ─── getScoringCategories / updateScoringCategories ───────────────────────────
describe('getScoringCategories', () => {
    it('returns empty array when no categories', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        expect(await provider.getScoringCategories('t1')).toEqual([]);
    });
    it('returns categories with fields', async () => {
        const cat = { id: 'c1', name: 'Direct', witness_category: true, position: 1 };
        const field = { id: 'f1', category_id: 'c1', label: 'Score', min_score: 1, max_score: 10, multiplier: '1', assignable: true, eligible_for_award: false, visible_to_scorers: true, prosecution: true, defense: false, calling: true, crossing: false };
        mockDbQuery
            .mockResolvedValueOnce(ok([cat]))
            .mockResolvedValueOnce(ok([field]));
        const result = await provider.getScoringCategories('t1');
        expect(result[0].fields).toHaveLength(1);
    });
});

describe('updateScoringCategories', () => {
    it('resolves on success', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([]))
            .mockResolvedValueOnce(ok([]));
        await expect(provider.updateScoringCategories('t1', [])).resolves.toBeUndefined();
    });
});

// ─── getStandingsConfig / upsertStandingsConfig / getStandingsTemplates ───────
describe('getStandingsConfig', () => {
    it('returns config', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([{ id: 'sc1', stats_xml: '<s/>', standings_xml: '<st/>' }]));
        expect(await provider.getStandingsConfig('t1')).toEqual({ id: 'sc1', statsXml: '<s/>', standingsXml: '<st/>' });
    });
    it('returns null when not found', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        expect(await provider.getStandingsConfig('t1')).toBeNull();
    });
    it('throws DbError when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(provider.getStandingsConfig('t1')).rejects.toThrow(DbError);
    });
});

describe('upsertStandingsConfig', () => {
    it('inserts new config when none exists', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([{ standings_config_id: null }]))
            .mockResolvedValueOnce(ok([{ id: 'sc1' }]))
            .mockResolvedValueOnce(ok([]));
        await expect(provider.upsertStandingsConfig('t1', '<s/>', '<st/>')).resolves.toBeUndefined();
    });
    it('updates non-template config in place', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([{ standings_config_id: 'sc1' }]))
            .mockResolvedValueOnce(ok([]))   // not a template
            .mockResolvedValueOnce(ok([]));  // UPDATE
        await expect(provider.upsertStandingsConfig('t1', '<s/>', '<st/>')).resolves.toBeUndefined();
    });
    it('creates new config when existing is a template', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([{ standings_config_id: 'sc1' }]))
            .mockResolvedValueOnce(ok([{ id: 'sc1' }]))  // is template
            .mockResolvedValueOnce(ok([{ id: 'sc2' }]))  // INSERT new
            .mockResolvedValueOnce(ok([]));               // UPDATE tournament
        await expect(provider.upsertStandingsConfig('t1', '<s/>', '<st/>')).resolves.toBeUndefined();
    });
    it('throws DbError when insert fails', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([{ standings_config_id: null }]))
            .mockResolvedValueOnce(null);
        await expect(provider.upsertStandingsConfig('t1', '<s/>', '<st/>')).rejects.toThrow(DbError);
    });
});

describe('getStandingsTemplates', () => {
    it('returns rows', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([{ id: 'st1', label: 'Default' }]));
        expect(await provider.getStandingsTemplates()).toHaveLength(1);
    });
    it('throws DbError when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(provider.getStandingsTemplates()).rejects.toThrow(DbError);
    });
});
