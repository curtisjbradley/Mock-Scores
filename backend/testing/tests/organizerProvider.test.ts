jest.mock('../../src/email', () => jest.requireActual('../mocks/email'));

jest.mock('../../src/db', () => ({
    dbQuery: jest.fn(),
    withTransaction: jest.fn(),
}));

jest.mock('../../src/providers/scorerProvider', () => ({
    getFieldMultipliers: jest.fn(),
    computeBallotTotals: jest.fn(),
}));

import * as provider from '../../src/providers/organizerProvider';
import { AlreadyExistsError, DbError, NotFoundError, OrganizerAlreadyJoinedError } from '../../src/errors';
import { dbQuery, withTransaction } from '../../src/db';
import { computeBallotTotals, getFieldMultipliers } from '../../src/providers/scorerProvider';

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;
const mockWithTransaction = withTransaction as jest.MockedFunction<typeof withTransaction>;
const mockGetFieldMultipliers = getFieldMultipliers as jest.MockedFunction<typeof getFieldMultipliers>;
const mockComputeBallotTotals = computeBallotTotals as jest.MockedFunction<typeof computeBallotTotals>;

const ok = (rows: unknown[] = [], rowCount = rows.length) =>
    ({ rows, rowCount } as any);

const TID = '00000000-0000-0000-0000-000000000001';
const BID = '00000000-0000-0000-0000-000000000002';
const AID = '00000000-0000-0000-0000-000000000003';

beforeEach(() => {
    jest.resetAllMocks();

    // organizerProvider.updateRound uses withTransaction(client => client.query(...)).
    // Forward transaction-client queries through the same dbQuery mock used by the
    // rest of this provider suite, preserving the existing mockResolvedValueOnce order.
    mockWithTransaction.mockImplementation(async (callback: any) => {
        const client = {
            query: (text: string, params?: unknown[]) => (mockDbQuery as any)(text, params),
        };
        return callback(client as any);
    });

    // Defaults used only by editBallot tests; individual tests can override them.
    mockGetFieldMultipliers.mockResolvedValue(new Map([['f1', 2]]));
    mockComputeBallotTotals.mockReturnValue({ pPoints: 16, dPoints: 7 });
});
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
        // updateRound first SELECTs `locked FOR UPDATE`, then UPDATEs the row.
        mockDbQuery.mockResolvedValueOnce(ok([{ locked: false }]));
        mockDbQuery.mockResolvedValueOnce(ok([row]));
        expect(await provider.updateRound('r1', { name: 'Round 1' } as any)).toEqual(row);
    });
    it('throws NotFoundError when not found', async () => {
        // SELECT `locked FOR UPDATE` returns no row → round does not exist.
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

describe('updatePairing', () => {
    it('returns the updated pairing', async () => {
        const row = { pairing_id: 'p1', round_id: 'r1', p_team: 'tm1', d_team: 'tm2', courtroom: 'c1' };
        mockDbQuery.mockResolvedValueOnce(ok([row]));
        expect(await provider.updatePairing('p1', 'tm1', 'tm2', 'c1')).toEqual(row);
    });
    it('throws DbError when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(provider.updatePairing('p1', 'tm1', 'tm2', 'c1')).rejects.toThrow(DbError);
    });
    it('throws NotFoundError when pairing does not exist', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(provider.updatePairing('p1', 'tm1', 'tm2', null)).rejects.toThrow(NotFoundError);
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
        mockDbQuery.mockResolvedValueOnce(ok([{ id: 'sc1', standings_dsl: '(config (columns) (tiebreakers))' }]));
        expect(await provider.getStandingsConfig('t1')).toEqual({ id: 'sc1', dsl: '(config (columns) (tiebreakers))' });
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
        await expect(provider.upsertStandingsConfig('t1', '<s/>')).resolves.toBeUndefined();
    });
    it('updates non-template config in place', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([{ standings_config_id: 'sc1' }]))
            .mockResolvedValueOnce(ok([]))   // not a template
            .mockResolvedValueOnce(ok([]));  // UPDATE
        await expect(provider.upsertStandingsConfig('t1', '<s/>')).resolves.toBeUndefined();
    });
    it('creates new config when existing is a template', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([{ standings_config_id: 'sc1' }]))
            .mockResolvedValueOnce(ok([{ id: 'sc1' }]))  // is template
            .mockResolvedValueOnce(ok([{ id: 'sc2' }]))  // INSERT new
            .mockResolvedValueOnce(ok([]));               // UPDATE tournament
        await expect(provider.upsertStandingsConfig('t1', '<s/>')).resolves.toBeUndefined();
    });
    it('throws DbError when insert fails', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([{ standings_config_id: null }]))
            .mockResolvedValueOnce(null);
        await expect(provider.upsertStandingsConfig('t1', '<s/>')).rejects.toThrow(DbError);
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

describe('deleteBallot', () => {
    it('deletes an existing ballot', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ ballot_id: BID }], rowCount: 1 } as any);

        await expect(provider.deleteBallot(BID)).resolves.toBeUndefined();
        expect(mockDbQuery).toHaveBeenCalledWith(
            'DELETE FROM ballots WHERE ballot_id=$1 RETURNING ballot_id',
            [BID],
        );
    });

    it('throws DbError when the delete query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null as any);
        await expect(provider.deleteBallot(BID)).rejects.toBeInstanceOf(DbError);
    });

    it('throws NotFoundError when no ballot is deleted', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        await expect(provider.deleteBallot(BID)).rejects.toBeInstanceOf(NotFoundError);
    });
});

describe('editBallot', () => {
    const newPayload = {
        scores: [
            { assignmentKey: 'cat__f1', side: 'P' as const, score: 8, studentId: 's1', categoryId: 'cat' },
            { assignmentKey: 'cat__f2', side: 'D' as const, score: 7, studentId: 's2', categoryId: 'cat' },
        ],
    };

    it('recomputes points, preserves other ballot data, updates, and audits', async () => {
        const original = {
            pairingID: 'pair1',
            scores: [{ assignmentKey: 'old', side: 'P', score: 3 }],
            nominations: [{ awardCategoryId: 'award1', studentId: 's1', rank: 1 }],
            tiebreaker: 'team1',
        };
        mockDbQuery
            .mockResolvedValueOnce({
                rows: [{
                    ballot_id: BID,
                    ballot_json: JSON.stringify(original),
                    p_points: 3,
                    d_points: 4,
                    tournament_id: TID,
                }],
                rowCount: 1,
            } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

        await provider.editBallot(AID, newPayload, 'editor@example.com', 'Correction');

        expect(mockGetFieldMultipliers).toHaveBeenCalledWith(TID);
        expect(mockComputeBallotTotals).toHaveBeenCalledWith(newPayload.scores, expect.any(Map));

        const updateCall = mockDbQuery.mock.calls[1];
        expect(updateCall[0]).toMatch(/UPDATE ballots SET ballot_json/i);
        expect(updateCall[1]).toEqual([
            expect.any(String),
            16,
            7,
            BID,
        ]);
        expect(JSON.parse((updateCall[1] as unknown[])[0] as string)).toEqual({
            ...original,
            scores: newPayload.scores,
        });

        const auditCall = mockDbQuery.mock.calls[2];
        expect(auditCall[0]).toMatch(/INSERT INTO ballot_edit_log/i);
        expect(auditCall[1]).toEqual([
            BID,
            'editor@example.com',
            'Correction',
            JSON.stringify(original),
            JSON.stringify({ ...original, scores: newPayload.scores }),
            3,
            16,
            4,
            7,
        ]);
    });

    it('supports an already-parsed ballot_json object', async () => {
        const original = { pairingID: 'pair1', scores: [], nominations: [] };
        mockDbQuery
            .mockResolvedValueOnce({
                rows: [{
                    ballot_id: BID,
                    ballot_json: original,
                    p_points: 0,
                    d_points: 0,
                    tournament_id: TID,
                }],
                rowCount: 1,
            } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

        await provider.editBallot(AID, newPayload, 'editor@example.com', 'Correction');

        expect(JSON.parse((mockDbQuery.mock.calls[1][1] as unknown[])[0] as string)).toEqual({
            ...original,
            scores: newPayload.scores,
        });
    });

    it('throws DbError when the initial query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null as any);
        await expect(provider.editBallot(AID, newPayload, 'e@example.com', 'x')).rejects.toBeInstanceOf(DbError);
    });

    it('throws NotFoundError when the ballot does not exist', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        await expect(provider.editBallot(AID, newPayload, 'e@example.com', 'x')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws DbError when updating the ballot fails', async () => {
        mockDbQuery
            .mockResolvedValueOnce({
                rows: [{
                    ballot_id: BID,
                    ballot_json: { scores: [] },
                    p_points: 0,
                    d_points: 0,
                    tournament_id: TID,
                }],
                rowCount: 1,
            } as any)
            .mockResolvedValueOnce(null as any);

        await expect(provider.editBallot(AID, newPayload, 'e@example.com', 'x')).rejects.toBeInstanceOf(DbError);
    });
});

describe('getBallotEditLog', () => {
    it('returns edit log rows', async () => {
        const rows = [{
            editor_email: 'editor@example.com',
            edited_at: '2026-01-01',
            reason: 'Correction',
            p_points_before: 10,
            p_points_after: 11,
            d_points_before: 9,
            d_points_after: 9,
        }];
        mockDbQuery.mockResolvedValueOnce({ rows, rowCount: 1 } as any);

        await expect(provider.getBallotEditLog(BID)).resolves.toEqual(rows);
    });

    it('returns an empty array when the query has no result', async () => {
        mockDbQuery.mockResolvedValueOnce(null as any);
        await expect(provider.getBallotEditLog(BID)).resolves.toEqual([]);
    });
});

describe('getTournamentSummary', () => {
    const summaryRow = {
        teams_total: 10,
        teams_with_rosters: 8,
        teams_without_rosters: 2,
        teams_with_default_assignments: 7,
        teams_without_default_assignments: 3,
        teams_with_default_call_orders: 6,
        teams_without_default_call_orders: 4,
        teams_with_coaches: 9,
        teams_without_coaches: 1,
        rounds_total: 4,
        rounds_with_pairings: 3,
        rounds_without_pairings: 1,
        pairings_total: 20,
        pairings_with_scorers: 18,
        pairings_without_scorers: 2,
        pairings_with_presiders: 15,
        pairings_without_presiders: 5,
        pairings_with_courtrooms: 19,
        pairings_without_courtrooms: 1,
        courtrooms_double_booked: 2,
        pairings_in_double_booked_courtrooms: 4,
        ballots_submitted: 30,
        paper_ballots_awaiting_input: 3,
        scorers_total: 12,
        scorers_with_conflicts: 5,
    };

    it('maps the summary query into the public summary shape', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [summaryRow], rowCount: 1 } as any);

        await expect(provider.getTournamentSummary(TID)).resolves.toEqual({
            teams: {
                total: 10,
                withRosters: 8,
                withoutRosters: 2,
                withDefaultAssignments: 7,
                withoutDefaultAssignments: 3,
                withDefaultCallOrders: 6,
                withoutDefaultCallOrders: 4,
                withCoaches: 9,
                withoutCoaches: 1,
            },
            rounds: { total: 4, withPairings: 3, withoutPairings: 1 },
            pairings: {
                total: 20,
                withScorers: 18,
                withoutScorers: 2,
                withPresiders: 15,
                withoutPresiders: 5,
                withCourtrooms: 19,
                withoutCourtrooms: 1,
                courtroomsDoubleBooked: 2,
                pairingsInDoubleBookedCourtrooms: 4,
            },
            ballots: { submitted: 30, paperAwaitingInput: 3 },
            scorers: { total: 12, withConflicts: 5 },
        });
        expect(mockDbQuery.mock.calls[0][0]).toMatch(/WITH params AS/i);
        expect(mockDbQuery.mock.calls[0][1]).toEqual([TID]);
    });

    it('throws NotFoundError when the summary query returns no row', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        await expect(provider.getTournamentSummary(TID)).rejects.toBeInstanceOf(NotFoundError);
    });
});

describe('custom roster columns', () => {
    it('gets and maps custom roster columns', async () => {
        mockDbQuery.mockResolvedValueOnce({
            rows: [
                { column_name: 'Year', type: 'int', position: 0 },
                { column_name: 'Section', type: 'string', position: 1 },
            ],
            rowCount: 2,
        } as any);

        await expect(provider.getCustomRosterColumns(TID)).resolves.toEqual([
            { field: 'Year', type: 'int' },
            { field: 'Section', type: 'string' },
        ]);
    });

    it('throws when custom roster columns cannot be queried', async () => {
        mockDbQuery.mockResolvedValueOnce(null as any);
        await expect(provider.getCustomRosterColumns(TID)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('returns all roster export rows', async () => {
        const rows = [{
            team_name: 'Team A',
            student_name: 'Alex',
            pronouns: 'they/them',
            custom_data: [{ field: 'Year', type: 'int', value: 2027 }],
        }];
        mockDbQuery.mockResolvedValueOnce({ rows, rowCount: 1 } as any);

        await expect(provider.getAllRosters(TID)).resolves.toEqual(rows);
    });

    it('throws DbError when roster export query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null as any);
        await expect(provider.getAllRosters(TID)).rejects.toBeInstanceOf(DbError);
    });

    it('rejects a duplicate custom roster column', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ column_name: 'Year' }], rowCount: 1 } as any);
        await expect(provider.addCustomRosterColumn(TID, 'Year', 'int')).rejects.toBeInstanceOf(AlreadyExistsError);
    });

    it('adds a custom roster column', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [{ column_name: 'Year', type: 'int', position: 0 }], rowCount: 1 } as any);

        await expect(provider.addCustomRosterColumn(TID, 'Year', 'int')).resolves.toEqual({ field: 'Year', type: 'int' });
    });

    it('throws DbError when adding a column returns no row', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

        await expect(provider.addCustomRosterColumn(TID, 'Year', 'int')).rejects.toBeInstanceOf(DbError);
    });

    it('updates a column without a clash lookup when case-insensitively unchanged', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ column_name: 'YEAR', type: 'string' }], rowCount: 1 } as any);

        await expect(provider.updateCustomRosterColumn(TID, 'Year', 'YEAR', 'string')).resolves.toEqual({
            field: 'YEAR',
            type: 'string',
        });
        expect(mockDbQuery).toHaveBeenCalledTimes(1);
    });

    it('rejects a rename that clashes with another column', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ column_name: 'Section' }], rowCount: 1 } as any);

        await expect(
            provider.updateCustomRosterColumn(TID, 'Year', 'Section', 'string'),
        ).rejects.toBeInstanceOf(AlreadyExistsError);
    });

    it('renames a column when there is no clash', async () => {
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [{ column_name: 'Class Year', type: 'int' }], rowCount: 1 } as any);

        await expect(
            provider.updateCustomRosterColumn(TID, 'Year', 'Class Year', 'int'),
        ).resolves.toEqual({ field: 'Class Year', type: 'int' });
    });

    it('throws NotFoundError when updating a column returns no row', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

        await expect(
            provider.updateCustomRosterColumn(TID, 'Year', 'YEAR', 'int'),
        ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('deletes a custom roster column', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [{ column_name: 'Year' }], rowCount: 1 } as any);
        await expect(provider.deleteCustomRosterColumn(TID, 'Year')).resolves.toBeUndefined();
    });

    it('throws NotFoundError when deleting an unknown column', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        await expect(provider.deleteCustomRosterColumn(TID, 'Year')).rejects.toBeInstanceOf(NotFoundError);
    });
});

describe('submitted ballots and award summary', () => {
    it('lists submitted ballots', async () => {
        const rows = [{ ballot_id: 'b1' }, { ballot_id: 'b2' }];
        mockDbQuery.mockResolvedValueOnce({ rows, rowCount: 2 } as any);

        await expect(provider.listSubmittedBallots('pair1')).resolves.toEqual(rows);
    });

    it('throws NotFoundError when submitted ballots cannot be queried', async () => {
        mockDbQuery.mockResolvedValueOnce(null as any);
        await expect(provider.listSubmittedBallots('pair1')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('returns award nominations', async () => {
        const rows = [{
            student_name: 'Alex',
            student_id: 's1',
            team_id: 'team1',
            team_code: '101',
            team_name: 'Team A',
            award_name: 'Best Attorney',
            award_category_id: 'award1',
            scorer_id: 'sc1',
            scorer_name: 'Judge One',
            side: 'P',
            pairing_id: 'pair1',
            round_id: 'round1',
            round_name: 'Round 1',
            ballot_id: BID,
            tournament_id: TID,
            rank: 1,
        }];
        mockDbQuery.mockResolvedValueOnce({ rows, rowCount: 1 } as any);

        await expect(provider.getAwardsSummary(TID)).resolves.toEqual(rows);
    });

    it('returns an empty award summary when the query has no rows', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        await expect(provider.getAwardsSummary(TID)).resolves.toEqual([]);
    });

    it('throws NotFoundError when award nominations cannot be queried', async () => {
        mockDbQuery.mockResolvedValueOnce(null as any);
        await expect(provider.getAwardsSummary(TID)).rejects.toBeInstanceOf(NotFoundError);
    });
});

// ─── Remaining coverage: scoring templates ───────────────────────────────────

describe('getScoringTemplates', () => {
    it('returns scoring template rows', async () => {
        const rows = [{ id: 'tpl1', label: 'Standard', description: 'Default format' }];
        mockDbQuery.mockResolvedValueOnce(ok(rows));

        await expect(provider.getScoringTemplates()).resolves.toEqual(rows);
    });

    it('throws DbError when the query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);

        await expect(provider.getScoringTemplates()).rejects.toBeInstanceOf(DbError);
    });
});

describe('copyScoringTemplateToTournament', () => {
    it('throws NotFoundError when the template does not exist', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));

        await expect(
            provider.copyScoringTemplateToTournament('missing-template', TID),
        ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('returns after copying awards when the template has no scoring categories', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([{ id: 'tpl1' }]))
            .mockResolvedValueOnce(ok([
                { id: 'award-old', name: 'Best Attorney', min_nominees: 1, max_nominees: 2 },
            ]))
            .mockResolvedValueOnce(ok([{ id: 'award-new' }]))
            .mockResolvedValueOnce(ok([]));

        await expect(
            provider.copyScoringTemplateToTournament('tpl1', TID),
        ).resolves.toBeUndefined();

        expect(mockDbQuery).toHaveBeenCalledTimes(4);
        expect(mockDbQuery.mock.calls[2][0]).toMatch(/INSERT INTO individual_award_categories/i);
    });

    it('copies categories and fields while remapping award-category links', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([{ id: 'tpl1' }]))
            .mockResolvedValueOnce(ok([
                { id: 'award-old', name: 'Best Attorney', min_nominees: 1, max_nominees: 2 },
            ]))
            .mockResolvedValueOnce(ok([{ id: 'award-new' }]))
            .mockResolvedValueOnce(ok([
                { id: 'cat-old', name: 'Openings', witness_category: false, position: 1 },
            ]))
            .mockResolvedValueOnce(ok([
                {
                    template_category_id: 'cat-old',
                    label: 'Opening',
                    min_score: 1,
                    max_score: 10,
                    multiplier: '2',
                    assignable: true,
                    visible_to_scorers: true,
                    prosecution: true,
                    defense: true,
                    calling: false,
                    crossing: false,
                    position: 1,
                    award_category_id: 'award-old',
                },
            ]))
            .mockResolvedValueOnce(ok([], 1))
            .mockResolvedValueOnce(ok([], 1));

        await provider.copyScoringTemplateToTournament('tpl1', TID);

        const fieldInsert = mockDbQuery.mock.calls.find(([sql]) =>
            /INSERT INTO scoring_fields/i.test(sql as string),
        );
        expect(fieldInsert).toBeDefined();
        expect(fieldInsert?.[1]).toEqual(expect.arrayContaining(['award-new']));
    });
});

// ─── Remaining coverage: round locking / inherited defaults ─────────────────

describe('updateRound locking behavior', () => {
    it('copies team defaults when a round transitions from unlocked to locked', async () => {
        const updated = { round_id: 'r1', name: 'Round 1', locked: true };
        mockDbQuery
            .mockResolvedValueOnce(ok([{ locked: false }]))
            .mockResolvedValueOnce(ok([updated]))
            .mockResolvedValueOnce(ok([], 1))
            .mockResolvedValueOnce(ok([], 1));

        await expect(provider.updateRound('r1', {
            name: 'Round 1',
            round_time: null,
            teams_public: true,
            results_public: false,
            locked: true,
        } as any)).resolves.toEqual(updated);

        expect(mockDbQuery).toHaveBeenCalledTimes(4);
        expect(mockDbQuery.mock.calls[2][0]).toMatch(/INSERT INTO witness_call_order/i);
        expect(mockDbQuery.mock.calls[3][0]).toMatch(/INSERT INTO student_assignments/i);
    });

    it('does not copy defaults again when the round was already locked', async () => {
        const updated = { round_id: 'r1', name: 'Round 1', locked: true };
        mockDbQuery
            .mockResolvedValueOnce(ok([{ locked: true }]))
            .mockResolvedValueOnce(ok([updated]));

        await provider.updateRound('r1', {
            name: 'Round 1',
            locked: false,
        } as any);

        expect(mockDbQuery).toHaveBeenCalledTimes(2);
        expect((mockDbQuery.mock.calls[1][1] as unknown[])[4]).toBe(true);
    });

    it('throws NotFoundError when the update returns no row', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([{ locked: false }]))
            .mockResolvedValueOnce(ok([]));

        await expect(provider.updateRound('r1', { locked: false } as any))
            .rejects.toBeInstanceOf(NotFoundError);
    });
});

// ─── Remaining coverage: team invite branch ─────────────────────────────────

describe('updateTeam additional branches', () => {
    it('creates an invite when the team has no joined owner and no existing invite', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([{ id: 'tm1', tournament_id: 't1' }]))
            .mockResolvedValueOnce(ok([], 1))
            .mockResolvedValueOnce(ok([]))
            .mockResolvedValueOnce(ok([]))
            .mockResolvedValueOnce(ok([], 1));

        await expect(
            provider.updateTeam('tm1', 'Renamed Team', 'coach@example.com', ''),
        ).resolves.toMatchObject({
            name: 'Renamed Team',
            code: 'Renamed Team',
            coach_email: 'coach@example.com',
            has_joined: false,
        });

        expect(mockDbQuery.mock.calls[4][0]).toMatch(/INSERT INTO team_invites/i);
    });
});

// ─── Remaining coverage: ballot status ───────────────────────────────────────

describe('getBallotStatus', () => {
    it('returns ballot-status rows', async () => {
        const rows = [{ pairing_id: 'p1', total_scorers: 3, submitted: 2 }];
        mockDbQuery.mockResolvedValueOnce(ok(rows));

        await expect(provider.getBallotStatus('r1')).resolves.toEqual(rows);
    });

    it('throws DbError when the query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);

        await expect(provider.getBallotStatus('r1')).rejects.toBeInstanceOf(DbError);
    });
});

// ─── Remaining coverage: notification contexts ───────────────────────────────

describe('getRoundResultsPublicContext', () => {
    it('returns null when the round does not exist', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));

        await expect(provider.getRoundResultsPublicContext('r1')).resolves.toBeNull();
    });

    it('returns null when the tournament does not exist', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([{ name: 'Round 1', tournament_id: TID }]))
            .mockResolvedValueOnce(ok([]));

        await expect(provider.getRoundResultsPublicContext('r1')).resolves.toBeNull();
    });

    it('returns tournament, round, and coach email context', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([{ name: 'Round 1', tournament_id: TID }]))
            .mockResolvedValueOnce(ok([{ name: 'State Championship' }]))
            .mockResolvedValueOnce(ok([
                { email: 'one@example.com' },
                { email: 'two@example.com' },
            ]));

        await expect(provider.getRoundResultsPublicContext('r1')).resolves.toEqual({
            tournamentName: 'State Championship',
            roundName: 'Round 1',
            coachEmails: ['one@example.com', 'two@example.com'],
        });
    });

    it('uses an empty coach list when the email query fails', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([{ name: 'Round 1', tournament_id: TID }]))
            .mockResolvedValueOnce(ok([{ name: 'State Championship' }]))
            .mockResolvedValueOnce(null);

        await expect(provider.getRoundResultsPublicContext('r1')).resolves.toEqual({
            tournamentName: 'State Championship',
            roundName: 'Round 1',
            coachEmails: [],
        });
    });
});

describe('getScorerInviteContextsForRound', () => {
    it('maps scorer invite rows', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([
            {
                email: 'judge@example.com',
                first_name: 'Jane',
                last_name: 'Judge',
                tournament_name: 'State Championship',
                assignment_id: AID,
            },
        ]));

        await expect(provider.getScorerInviteContextsForRound('r1')).resolves.toEqual([
            {
                email: 'judge@example.com',
                firstName: 'Jane',
                lastName: 'Judge',
                tournamentName: 'State Championship',
                assignmentId: AID,
            },
        ]);
    });

    it('returns an empty array when the query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);

        await expect(provider.getScorerInviteContextsForRound('r1')).resolves.toEqual([]);
    });
});

describe('hasSentScoringLinksForRound', () => {
    it('returns true when a scoring-link email exists', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([{ exists: true }]));

        await expect(provider.hasSentScoringLinksForRound('r1')).resolves.toBe(true);
    });

    it('returns false when the EXISTS query is false', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([{ exists: false }]));

        await expect(provider.hasSentScoringLinksForRound('r1')).resolves.toBe(false);
    });

    it('defaults to false when the query has no row', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));

        await expect(provider.hasSentScoringLinksForRound('r1')).resolves.toBe(false);
    });
});

describe('getScorerInviteContextForAssignment', () => {
    it('maps a scorer invite context', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([
            {
                email: 'judge@example.com',
                first_name: 'Jane',
                last_name: 'Judge',
                tournament_name: 'State Championship',
                assignment_id: AID,
            },
        ]));

        await expect(provider.getScorerInviteContextForAssignment(AID)).resolves.toEqual({
            email: 'judge@example.com',
            firstName: 'Jane',
            lastName: 'Judge',
            tournamentName: 'State Championship',
            assignmentId: AID,
        });
    });

    it('returns null when there is no registered scorer context', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));

        await expect(provider.getScorerInviteContextForAssignment(AID)).resolves.toBeNull();
    });

    it('returns null when the query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);

        await expect(provider.getScorerInviteContextForAssignment(AID)).resolves.toBeNull();
    });
});

// ─── Remaining coverage: tournament duplication helpers ──────────────────────

describe('duplicateTournament helper branches', () => {
    const sourceTournament = {
        id: 'source-tournament',
        name: 'Original',
        location: 'Somewhere',
        case_format_id: 'source-format',
        share_individual_rankings: true,
    } as any;

    const copiedTournament = {
        id: 'copied-tournament',
        name: 'Original (copy)',
    } as any;

    it('duplicates awards and scoring categories with award links remapped', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([sourceTournament]))
            .mockResolvedValueOnce(ok([], 1)) // INSERT tournament_format
            .mockResolvedValueOnce(ok([], 1)) // INSERT tournament
            .mockResolvedValueOnce(ok([
                { id: 'award-old', name: 'Best Attorney', min_nominees: 1, max_nominees: 2 },
            ]))
            .mockResolvedValueOnce(ok([{ id: 'award-new' }]))
            .mockResolvedValueOnce(ok([
                { id: 'cat-old', name: 'Openings', witness_category: false, position: 1 },
            ]))
            .mockResolvedValueOnce(ok([
                {
                    category_id: 'cat-old',
                    label: 'Opening',
                    min_score: 1,
                    max_score: 10,
                    multiplier: 1,
                    assignable: true,
                    visible_to_scorers: true,
                    prosecution: true,
                    defense: true,
                    calling: false,
                    crossing: false,
                    position: 1,
                    award_category_id: 'award-old',
                },
            ]))
            .mockResolvedValueOnce(ok([], 1)) // INSERT scoring category
            .mockResolvedValueOnce(ok([], 1)) // INSERT scoring field
            .mockResolvedValueOnce(ok([copiedTournament]));

        await expect(provider.duplicateTournament('source-tournament', {
            format: false,
            witnesses: false,
            awards: true,
            scoringCategories: true,
            scorers: false,
            courtrooms: false,
            tiebreaker: false,
        } as any)).resolves.toEqual(copiedTournament);

        const fieldInsert = mockDbQuery.mock.calls.find(([sql]) =>
            /INSERT INTO scoring_fields/i.test(sql as string),
        );
        expect(fieldInsert).toBeDefined();
        expect(fieldInsert?.[1]).toEqual(expect.arrayContaining(['award-new']));
    });

    it('reuses a standings template config when duplicating a tiebreaker', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([sourceTournament]))
            .mockResolvedValueOnce(ok([], 1))
            .mockResolvedValueOnce(ok([], 1))
            .mockResolvedValueOnce(ok([{ id: 'cfg1', standings_dsl: '(config)' }]))
            .mockResolvedValueOnce(ok([{ id: 'template1' }]))
            .mockResolvedValueOnce(ok([], 1))
            .mockResolvedValueOnce(ok([copiedTournament]));

        await provider.duplicateTournament('source-tournament', {
            format: false,
            witnesses: false,
            awards: false,
            scoringCategories: false,
            scorers: false,
            courtrooms: false,
            tiebreaker: true,
        } as any);

        const configUpdate = mockDbQuery.mock.calls.find(([sql]) =>
            /UPDATE tournaments SET standings_config_id/i.test(sql as string),
        );
        expect(configUpdate?.[1]).toEqual(['cfg1', expect.any(String)]);
    });

    it('clones a non-template standings config when duplicating a tiebreaker', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([sourceTournament]))
            .mockResolvedValueOnce(ok([], 1))
            .mockResolvedValueOnce(ok([], 1))
            .mockResolvedValueOnce(ok([{ id: 'cfg1', standings_dsl: '(custom)' }]))
            .mockResolvedValueOnce(ok([]))
            .mockResolvedValueOnce(ok([{ id: 'cfg2' }]))
            .mockResolvedValueOnce(ok([], 1))
            .mockResolvedValueOnce(ok([copiedTournament]));

        await provider.duplicateTournament('source-tournament', {
            format: false,
            witnesses: false,
            awards: false,
            scoringCategories: false,
            scorers: false,
            courtrooms: false,
            tiebreaker: true,
        } as any);

        const configInsert = mockDbQuery.mock.calls.find(([sql]) =>
            /INSERT INTO standings_configs/i.test(sql as string),
        );
        expect(configInsert?.[1]).toEqual(['(custom)']);

        const configUpdate = mockDbQuery.mock.calls.find(([sql]) =>
            /UPDATE tournaments SET standings_config_id/i.test(sql as string),
        );
        expect(configUpdate?.[1]).toEqual(['cfg2', expect.any(String)]);
    });

    it('skips tiebreaker copying when the source has no standings config', async () => {
        mockDbQuery
            .mockResolvedValueOnce(ok([sourceTournament]))
            .mockResolvedValueOnce(ok([], 1))
            .mockResolvedValueOnce(ok([], 1))
            .mockResolvedValueOnce(ok([]))
            .mockResolvedValueOnce(ok([copiedTournament]));

        await expect(provider.duplicateTournament('source-tournament', {
            format: false,
            witnesses: false,
            awards: false,
            scoringCategories: false,
            scorers: false,
            courtrooms: false,
            tiebreaker: true,
        } as any)).resolves.toEqual(copiedTournament);

        expect(mockDbQuery.mock.calls.some(([sql]) =>
            /INSERT INTO standings_configs/i.test(sql as string),
        )).toBe(false);
    });
});
