jest.mock('../../src/email', () => jest.requireActual('../mocks/email'));

import request from 'supertest';
import app from '../../src/appService';
import { dbQuery } from '../../src/db';
import { sendEmail, sendTrackedEmail } from '../../src/email';
import * as organizer from '../../src/providers/organizerProvider';
import { DbError, NotFoundError } from '../../src/errors';
import { setupAuth, makeAuth, makeMockAccess } from '../helpers/auth';

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;
const mockSendTrackedEmail = sendTrackedEmail as jest.MockedFunction<typeof sendTrackedEmail>;

/** Flush fire-and-forget promise chains used by invitation emails. */
const flushAsync = () => new Promise<void>(resolve => setImmediate(resolve));

const T = 'a1b2c3d4-e5f6-4789-abcd-ef1234567890';
const PID = 'b1b2c3d4-e5f6-4789-abcd-ef1234567890';
const AID = 'c1b2c3d4-e5f6-4789-abcd-ef1234567890';

const getToken = setupAuth();
const auth = () => makeAuth(getToken());

const mockAccess = () =>
    makeMockAccess(
        mockDbQuery as jest.MockedFunction<(...args: unknown[]) => unknown>
    );

/**
 * Avoid relying on error constructor signatures while still satisfying
 * `instanceof DbError` / `instanceof NotFoundError` checks in the routers.
 */
const dbError = (message = 'database failure') =>
    Object.setPrototypeOf(new Error(message), DbError.prototype) as DbError;

const notFoundError = (message = 'not found') =>
    Object.setPrototypeOf(new Error(message), NotFoundError.prototype) as NotFoundError;

/**
 * Requests below /pairings/:pairingId first pass through verifyPairing(),
 * which calls organizer.getPairing().
 */
function mockPairingAccess(pairingId = PID) {
    mockAccess();
    jest.spyOn(organizer, 'getPairing').mockResolvedValue({
        pairing_id: pairingId,
    } as any);
}

beforeEach(() => {
    mockDbQuery.mockReset();
    mockSendEmail.mockClear();
    mockSendTrackedEmail.mockClear();
});

afterEach(() => {
    jest.restoreAllMocks();
});

// ============================================================================
// POST /import/scorers
// ============================================================================

describe('POST /api/organizer/tournament/:id/import/scorers', () => {
    const url = `/organizer/tournament/${T}/import/scorers`;

    it('returns 400 when csv is missing', async () => {
        mockAccess();

        const res = await request(app).post(url).set(auth()).send({});

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/no csv/i);
    });

    it('returns 400 when csv is empty string', async () => {
        mockAccess();

        const res = await request(app)
            .post(url)
            .set(auth())
            .send({ csv: '   ' });

        expect(res.status).toBe(400);
    });

    it('returns 400 when csv has only empty lines', async () => {
        mockAccess();

        const res = await request(app)
            .post(url)
            .set(auth())
            .send({ csv: '\n\n\n' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/no csv|empty/i);
    });

    it('imports scorers successfully with header row', async () => {
        mockAccess();
        const addScorer = jest
            .spyOn(organizer, 'addScorer')
            .mockResolvedValue(undefined as any);

        const csv =
            'first_name,last_name,email\n' +
            'Alice,Smith,alice@test.com\n' +
            'Bob,Jones,bob@test.com';

        const res = await request(app).post(url).set(auth()).send({ csv });

        expect(res.status).toBe(200);
        expect(res.body.created).toBe(2);
        expect(res.body.errors).toHaveLength(0);
        expect(addScorer).toHaveBeenCalledTimes(2);
        expect(addScorer).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                first_name: 'Alice',
                last_name: 'Smith',
                email: 'alice@test.com',
                scorer_id: expect.any(String),
            }),
            T
        );
    });

    it('imports scorers without header row', async () => {
        mockAccess();
        const addScorer = jest
            .spyOn(organizer, 'addScorer')
            .mockResolvedValue(undefined as any);

        const res = await request(app)
            .post(url)
            .set(auth())
            .send({ csv: 'Alice,Smith,alice@test.com' });

        expect(res.status).toBe(200);
        expect(res.body.created).toBe(1);
        expect(addScorer).toHaveBeenCalledTimes(1);
    });

    it('reports errors for rows with missing names', async () => {
        mockAccess();

        const csv =
            'first_name,last_name,email\n' +
            ',Smith,a@b.com\n' +
            'Bob,,b@c.com';

        const res = await request(app).post(url).set(auth()).send({ csv });

        expect(res.status).toBe(200);
        expect(res.body.created).toBe(0);
        expect(res.body.errors).toHaveLength(2);
        expect(res.body.errors[0].message).toMatch(/missing first or last name/i);
    });

    it('reports errors for rows with invalid email', async () => {
        mockAccess();

        const res = await request(app)
            .post(url)
            .set(auth())
            .send({ csv: 'Alice,Smith,not-an-email' });

        expect(res.status).toBe(200);
        expect(res.body.created).toBe(0);
        expect(res.body.errors).toHaveLength(1);
        expect(res.body.errors[0].message).toMatch(/invalid email/i);
    });

    it('reports errors for rows with empty email', async () => {
        mockAccess();

        const res = await request(app)
            .post(url)
            .set(auth())
            .send({ csv: 'Alice,Smith,' });

        expect(res.status).toBe(200);
        expect(res.body.created).toBe(0);
        expect(res.body.errors[0].message).toMatch(/invalid email/i);
    });

    it('reports provider errors per row without failing the whole import', async () => {
        mockAccess();
        jest.spyOn(organizer, 'addScorer')
            .mockRejectedValueOnce(dbError())
            .mockResolvedValueOnce(undefined as any);

        const csv =
            'first_name,last_name,email\n' +
            'Alice,Smith,alice@test.com\n' +
            'Bob,Jones,bob@test.com';

        const res = await request(app).post(url).set(auth()).send({ csv });

        expect(res.status).toBe(200);
        expect(res.body.created).toBe(1);
        expect(res.body.errors).toHaveLength(1);
    });

    it('handles quoted CSV fields with commas', async () => {
        mockAccess();
        const addScorer = jest
            .spyOn(organizer, 'addScorer')
            .mockResolvedValue(undefined as any);

        const res = await request(app)
            .post(url)
            .set(auth())
            .send({ csv: '"Smith, Jr.",Bob,bob@test.com' });

        expect(res.status).toBe(200);
        expect(res.body.created).toBe(1);
        expect(addScorer).toHaveBeenCalledWith(
            expect.objectContaining({
                first_name: 'Smith, Jr.',
                last_name: 'Bob',
                email: 'bob@test.com',
            }),
            T
        );
    });
});

// ============================================================================
// POST /import/teams
// ============================================================================

describe('POST /api/organizer/tournament/:id/import/teams', () => {
    const url = `/organizer/tournament/${T}/import/teams`;

    it('returns 400 when csv is missing', async () => {
        mockAccess();

        const res = await request(app).post(url).set(auth()).send({});

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/no csv/i);
    });

    it('returns 400 when csv is empty', async () => {
        mockAccess();

        const res = await request(app)
            .post(url)
            .set(auth())
            .send({ csv: '' });

        expect(res.status).toBe(400);
    });

    it('imports teams with header row and sends invitations', async () => {
        mockAccess();

        jest.spyOn(organizer, 'teamNameExists')
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(false);

        const addTeam = jest.spyOn(organizer, 'addTeam')
            .mockResolvedValueOnce({
                id: '11111111-1111-4111-8111-111111111111',
                tournament_id: T,
                name: 'Eagles',
                code: 'EAG',
            } as any)
            .mockResolvedValueOnce({
                id: '22222222-2222-4222-8222-222222222222',
                tournament_id: T,
                name: 'Hawks',
                code: 'HWK',
            } as any);

        jest.spyOn(organizer, 'getTournament').mockResolvedValue({
            id: T,
            name: 'Regionals 2026',
        } as any);

        const csv =
            'name,coach_email,code\n' +
            'Eagles,coach@test.com,EAG\n' +
            'Hawks,coach2@test.com,HWK';

        const res = await request(app).post(url).set(auth()).send({ csv });

        expect(res.status).toBe(200);
        expect(res.body.created).toBe(2);
        expect(res.body.errors).toHaveLength(0);
        expect(addTeam).toHaveBeenCalledTimes(2);

        await flushAsync();

        expect(mockSendTrackedEmail).toHaveBeenCalledTimes(2);
        expect(mockSendTrackedEmail).toHaveBeenCalledWith(
            'coach@test.com',
            expect.any(String),
            expect.any(String),
            expect.any(String),
            expect.objectContaining({ type: 'coach_invite' })
        );
        expect(mockSendTrackedEmail).toHaveBeenCalledWith(
            'coach2@test.com',
            expect.any(String),
            expect.any(String),
            expect.any(String),
            expect.objectContaining({ type: 'coach_invite' })
        );
    });

    it('imports teams without header row', async () => {
        mockAccess();

        jest.spyOn(organizer, 'teamNameExists').mockResolvedValue(false);
        const addTeam = jest.spyOn(organizer, 'addTeam').mockResolvedValue({
            id: '11111111-1111-4111-8111-111111111111',
            tournament_id: T,
            name: 'Eagles',
            code: 'EAG',
        } as any);
        jest.spyOn(organizer, 'getTournament').mockResolvedValue({
            id: T,
            name: 'Regionals 2026',
        } as any);

        const res = await request(app)
            .post(url)
            .set(auth())
            .send({ csv: 'Eagles,coach@test.com,EAG' });

        expect(res.status).toBe(200);
        expect(res.body.created).toBe(1);
        expect(addTeam).toHaveBeenCalledWith(
            T,
            'Eagles',
            'coach@test.com',
            'EAG'
        );

        await flushAsync();
    });

    it('reports error for missing team name', async () => {
        mockAccess();

        const res = await request(app)
            .post(url)
            .set(auth())
            .send({ csv: ',coach@test.com,EAG' });

        expect(res.status).toBe(200);
        expect(res.body.created).toBe(0);
        expect(res.body.errors[0].message).toMatch(/missing team name/i);
    });

    it('reports error for invalid coach email', async () => {
        mockAccess();

        const res = await request(app)
            .post(url)
            .set(auth())
            .send({ csv: 'Eagles,not-an-email,EAG' });

        expect(res.status).toBe(200);
        expect(res.body.created).toBe(0);
        expect(res.body.errors[0].message).toMatch(/invalid coach email/i);
    });

    it('reports error for duplicate team name and sends no invitation', async () => {
        mockAccess();
        jest.spyOn(organizer, 'teamNameExists').mockResolvedValue(true);

        const res = await request(app)
            .post(url)
            .set(auth())
            .send({ csv: 'Eagles,coach@test.com,EAG' });

        expect(res.status).toBe(200);
        expect(res.body.created).toBe(0);
        expect(res.body.errors[0].message).toMatch(/already exists/i);

        await flushAsync();

        expect(mockSendTrackedEmail).not.toHaveBeenCalled();
        expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('uses team name as code when code column is missing', async () => {
        mockAccess();

        jest.spyOn(organizer, 'teamNameExists').mockResolvedValue(false);
        const addTeam = jest.spyOn(organizer, 'addTeam').mockResolvedValue({
            id: '11111111-1111-4111-8111-111111111111',
            tournament_id: T,
            name: 'Eagles',
            code: 'Eagles',
        } as any);
        jest.spyOn(organizer, 'getTournament').mockResolvedValue({
            id: T,
            name: 'Regionals 2026',
        } as any);

        const res = await request(app)
            .post(url)
            .set(auth())
            .send({ csv: 'Eagles,coach@test.com' });

        expect(res.status).toBe(200);
        expect(res.body.created).toBe(1);
        expect(addTeam).toHaveBeenCalledWith(
            T,
            'Eagles',
            'coach@test.com',
            'Eagles'
        );

        await flushAsync();
    });

    it('reports addTeam errors per row', async () => {
        mockAccess();

        jest.spyOn(organizer, 'teamNameExists').mockResolvedValue(false);
        jest.spyOn(organizer, 'addTeam').mockRejectedValue(dbError('insert failed'));

        const res = await request(app)
            .post(url)
            .set(auth())
            .send({ csv: 'Eagles,coach@test.com,EAG' });

        expect(res.status).toBe(200);
        expect(res.body.created).toBe(0);
        expect(res.body.errors).toHaveLength(1);
        expect(res.body.errors[0].message).toMatch(/insert failed/i);
    });
});

// ============================================================================
// GET /export/standings
// ============================================================================

describe('GET /api/organizer/tournament/:id/export/standings', () => {
    const url = `/organizer/tournament/${T}/export/standings`;

    it('returns CSV with standings data', async () => {
        mockAccess();

        jest.spyOn(organizer, 'getOrganizerStandingsData').mockResolvedValue({
            config: null,
            teams: [
                { id: 't1', name: 'Eagles', code: 'EAG' },
                { id: 't2', name: 'Hawks', code: 'HWK' },
            ],
            rounds: [{ round_id: 'r1', name: 'Round 1' }],
            ballots: [
                {
                    p_team_id: 't1',
                    d_team_id: 't2',
                    p_points: 80,
                    d_points: 70,
                    pairing_id: 'p1',
                    round_id: 'r1',
                },
            ],
        } as any);

        const res = await request(app).get(url).set(auth());

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/csv/);
        expect(res.headers['content-disposition']).toMatch(/standings\.csv/);
        expect(res.text).toContain(
            'Team Name,Team Code,Ballots Won,Ballots Lost,Total Points For,Total Points Against'
        );
        expect(res.text).toContain('Eagles,EAG,1,0,80,70');
        expect(res.text).toContain('Hawks,HWK,0,1,70,80');
    });

    it('returns CSV with only the header when there are no teams', async () => {
        mockAccess();

        jest.spyOn(organizer, 'getOrganizerStandingsData').mockResolvedValue({
            config: null,
            teams: [],
            rounds: [],
            ballots: [],
        } as any);

        const res = await request(app).get(url).set(auth());

        expect(res.status).toBe(200);
        expect(res.text).toContain('Team Name');
    });

    it('returns 500 when standings provider throws DbError', async () => {
        mockAccess();

        jest.spyOn(organizer, 'getOrganizerStandingsData')
            .mockRejectedValue(dbError());

        const res = await request(app).get(url).set(auth());

        expect(res.status).toBe(500);
    });
});

// ============================================================================
// GET /export/results
// ============================================================================

describe('GET /api/organizer/tournament/:id/export/results', () => {
    const url = `/organizer/tournament/${T}/export/results`;

    it('returns CSV with results data', async () => {
        mockAccess();

        jest.spyOn(organizer, 'getOrganizerStandingsData').mockResolvedValue({
            config: null,
            teams: [
                { id: 't1', name: 'Eagles', code: 'EAG' },
                { id: 't2', name: 'Hawks', code: 'HWK' },
            ],
            rounds: [{ round_id: 'r1', name: 'Round 1' }],
            ballots: [
                {
                    p_team_id: 't1',
                    d_team_id: 't2',
                    p_points: 80,
                    d_points: 70,
                    pairing_id: 'p1',
                    round_id: 'r1',
                },
            ],
        } as any);

        const res = await request(app).get(url).set(auth());

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/csv/);
        expect(res.headers['content-disposition']).toMatch(/results\.csv/);
        expect(res.text).toContain(
            'Round,Prosecution,Defense,P Points,D Points'
        );
        expect(res.text).toContain('Round 1,Eagles,Hawks,80,70');
    });

    it('handles unknown team and round IDs gracefully', async () => {
        mockAccess();

        jest.spyOn(organizer, 'getOrganizerStandingsData').mockResolvedValue({
            config: null,
            teams: [],
            rounds: [],
            ballots: [
                {
                    p_team_id: 'unknown1',
                    d_team_id: 'unknown2',
                    p_points: 50,
                    d_points: 60,
                    pairing_id: 'p1',
                    round_id: 'unknownR',
                },
            ],
        } as any);

        const res = await request(app).get(url).set(auth());

        expect(res.status).toBe(200);
        expect(res.text).toContain('Unknown,Unknown,Unknown,50,60');
    });

    it('returns 500 when standings provider throws DbError', async () => {
        mockAccess();

        jest.spyOn(organizer, 'getOrganizerStandingsData')
            .mockRejectedValue(dbError());

        const res = await request(app).get(url).set(auth());

        expect(res.status).toBe(500);
    });
});

// ============================================================================
// GET /awards
// ============================================================================

describe('GET /api/organizer/tournament/:id/awards', () => {
    const url = `/organizer/tournament/${T}/awards`;

    it('returns an empty array when there are no award results', async () => {
        mockAccess();
        jest.spyOn(organizer, 'getAwardsSummary').mockResolvedValue([] as any);

        const res = await request(app).get(url).set(auth());

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('returns the aggregated award summary from the provider', async () => {
        mockAccess();

        const s1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        const s2 = 'bbbbbbbb-bbbb-4bbb-9bbb-bbbbbbbbbbbb';
        const cat1 = 'cccccccc-cccc-4ccc-accc-cccccccccccc';

        jest.spyOn(organizer, 'getAwardsSummary').mockResolvedValue([
            {
                award_category_id: cat1,
                award_category_name: 'Best Attorney',
                student_id: s1,
                student_name: 'Alice',
                team_name: 'Eagles',
                team_code: 'EAG',
                total_nominations: 2,
                average_rank: 1.5,
            },
            {
                award_category_id: cat1,
                award_category_name: 'Best Attorney',
                student_id: s2,
                student_name: 'Bob',
                team_name: 'Hawks',
                team_code: 'HWK',
                total_nominations: 1,
                average_rank: 2,
            },
        ] as any);

        const res = await request(app).get(url).set(auth());

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        expect(res.body[0]).toEqual(
            expect.objectContaining({
                student_id: s1,
                total_nominations: 2,
                average_rank: 1.5,
                award_category_name: 'Best Attorney',
            })
        );
        expect(res.body[1].student_id).toBe(s2);
    });

    it('preserves Unknown student data returned by the provider', async () => {
        mockAccess();

        jest.spyOn(organizer, 'getAwardsSummary').mockResolvedValue([
            {
                student_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                student_name: 'Unknown',
                team_name: 'Unknown',
                team_code: 'Unknown',
                total_nominations: 1,
                average_rank: 1,
            },
        ] as any);

        const res = await request(app).get(url).set(auth());

        expect(res.status).toBe(200);
        expect(res.body[0].student_name).toBe('Unknown');
    });

    it('returns 500 when award provider throws DbError', async () => {
        mockAccess();

        jest.spyOn(organizer, 'getAwardsSummary')
            .mockRejectedValue(dbError());

        const res = await request(app).get(url).set(auth());

        expect(res.status).toBe(500);
    });
});

// ============================================================================
// GET /bounced-emails
// ============================================================================

describe('GET /api/organizer/tournament/:id/bounced-emails', () => {
    const url = `/organizer/tournament/${T}/bounced-emails`;

    it('returns array of bounced email addresses', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({
            rows: [
                { email: 'bad@test.com' },
                { email: 'invalid@test.com' },
            ],
            rowCount: 2,
        } as any);

        const res = await request(app).get(url).set(auth());

        expect(res.status).toBe(200);
        expect(res.body).toEqual([
            'bad@test.com',
            'invalid@test.com',
        ]);
    });

    it('returns empty array when no bounced emails exist', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({
            rows: [],
            rowCount: 0,
        } as any);

        const res = await request(app).get(url).set(auth());

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('returns empty array when dbQuery returns null', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(null as any);

        const res = await request(app).get(url).set(auth());

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});

// ============================================================================
// GET /standings
// ============================================================================

describe('GET /api/organizer/tournament/:id/standings', () => {
    const url = `/organizer/tournament/${T}/standings`;

    it('returns 200 with standings data', async () => {
        mockAccess();

        const data = {
            config: { standings_dsl: '(config (columns) (tiebreakers))' },
            teams: [{ id: 't1', name: 'Eagles', code: 'EAG' }],
            rounds: [{ round_id: 'r1', name: 'Round 1' }],
            ballots: [],
        };

        jest.spyOn(organizer, 'getOrganizerStandingsData')
            .mockResolvedValue(data as any);

        const res = await request(app).get(url).set(auth());

        expect(res.status).toBe(200);
        expect(res.body).toEqual(data);
        expect(res.body).toHaveProperty('teams');
        expect(res.body).toHaveProperty('ballots');
    });

    it('returns 500 when standings provider throws DbError', async () => {
        mockAccess();

        jest.spyOn(organizer, 'getOrganizerStandingsData')
            .mockRejectedValue(dbError());

        const res = await request(app).get(url).set(auth());

        expect(res.status).toBe(500);
    });
});

// ============================================================================
// PATCH /status
// ============================================================================

describe('PATCH /api/organizer/tournament/:id/status', () => {
    const url = `/organizer/tournament/${T}/status`;

    it('returns 400 when status is missing', async () => {
        mockAccess();

        const res = await request(app)
            .patch(url)
            .set(auth())
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/active, completed, or archived/i);
    });

    it('returns 400 for invalid status value', async () => {
        mockAccess();

        const res = await request(app)
            .patch(url)
            .set(auth())
            .send({ status: 'invalid' });

        expect(res.status).toBe(400);
    });

    it.each(['active', 'completed', 'archived'] as const)(
        'returns 200 on success with "%s"',
        async status => {
            mockAccess();

            const updateStatus = jest
                .spyOn(organizer, 'updateTournamentStatus')
                .mockResolvedValue(undefined as any);

            const res = await request(app)
                .patch(url)
                .set(auth())
                .send({ status });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(updateStatus).toHaveBeenCalledWith(T, status);
        }
    );

    it('returns 404 when tournament status target is not found', async () => {
        mockAccess();

        jest.spyOn(organizer, 'updateTournamentStatus')
            .mockRejectedValue(notFoundError('Tournament not found'));

        const res = await request(app)
            .patch(url)
            .set(auth())
            .send({ status: 'active' });

        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/not found/i);
    });

    it('returns 500 when status update throws DbError', async () => {
        mockAccess();

        jest.spyOn(organizer, 'updateTournamentStatus')
            .mockRejectedValue(dbError());

        const res = await request(app)
            .patch(url)
            .set(auth())
            .send({ status: 'active' });

        expect(res.status).toBe(500);
    });
});

// ============================================================================
// PUT /pairings/:pairingId/scoresheets/:assignmentId - DbError
// ============================================================================

describe('PUT /api/organizer/tournament/:id/pairings/:pid/scoresheets/:aid - DbError', () => {
    const url =
        `/organizer/tournament/${T}/pairings/${PID}/scoresheets/${AID}`;

    it('returns 500 on db failure', async () => {
        mockPairingAccess();

        jest.spyOn(organizer, 'editBallot')
            .mockRejectedValue(dbError());

        const res = await request(app)
            .put(url)
            .set(auth())
            .send({
                scores: [{
                    assignmentKey: 'k1',
                    side: 'P',
                    score: 9,
                    studentId: null,
                    categoryId: 'c1',
                }],
                reason: 'Fix',
            });

        expect(res.status).toBe(500);
    });
});

// ============================================================================
// DELETE /pairings/:pairingId/scoresheets/:ballotId - DbError
// ============================================================================

describe('DELETE /api/organizer/tournament/:id/pairings/:pid/scoresheets/:bid - DbError', () => {
    const url =
        `/organizer/tournament/${T}/pairings/${PID}/scoresheets/${AID}`;

    it('returns 500 on db failure', async () => {
        mockPairingAccess();

        jest.spyOn(organizer, 'deleteBallot')
            .mockRejectedValue(dbError());

        const res = await request(app)
            .delete(url)
            .set(auth());

        expect(res.status).toBe(500);
    });
});