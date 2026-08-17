/**
 * Coverage gap tests for organizerTournamentRoutes.ts:
 * - POST /import/scorers (CSV import)
 * - POST /import/teams (CSV import)
 * - GET /export/standings (CSV export)
 * - GET /export/results (CSV export)
 * - GET /awards
 * - GET /bounced-emails
 * - GET /standings
 * - PATCH /status
 */
jest.mock('../../src/email', () => jest.requireActual('../mocks/email'));
import request from 'supertest';
import app from '../../src/appService';
import { dbQuery } from '../../src/db';
import { setupAuth, makeAuth, makeMockAccess } from '../helpers/auth';

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;

const T = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const getToken = setupAuth();
const auth = () => makeAuth(getToken());
const mockAccess = () => makeMockAccess(mockDbQuery as jest.MockedFunction<(...args: unknown[]) => unknown>);

// ═══════════════════════════════════════════════════════════════════════════════
// POST /import/scorers
// ═══════════════════════════════════════════════════════════════════════════════
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
        const res = await request(app).post(url).set(auth()).send({ csv: '   ' });
        expect(res.status).toBe(400);
    });

    it('returns 400 when csv has only empty lines', async () => {
        mockAccess();
        const res = await request(app).post(url).set(auth()).send({ csv: '\n\n\n' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/no csv|empty/i);
    });

    it('imports scorers successfully with header row', async () => {
        mockAccess();
        const csv = 'first_name,last_name,email\nAlice,Smith,alice@test.com\nBob,Jones,bob@test.com';
        // Two addScorer calls
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // insert Alice
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // insert Bob
        const res = await request(app).post(url).set(auth()).send({ csv });
        expect(res.status).toBe(200);
        expect(res.body.created).toBe(2);
        expect(res.body.errors).toHaveLength(0);
    });

    it('imports scorers without header row', async () => {
        mockAccess();
        const csv = 'Alice,Smith,alice@test.com';
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const res = await request(app).post(url).set(auth()).send({ csv });
        expect(res.status).toBe(200);
        expect(res.body.created).toBe(1);
    });

    it('reports errors for rows with missing names', async () => {
        mockAccess();
        const csv = 'first_name,last_name,email\n,Smith,a@b.com\nBob,,b@c.com';
        const res = await request(app).post(url).set(auth()).send({ csv });
        expect(res.status).toBe(200);
        expect(res.body.created).toBe(0);
        expect(res.body.errors).toHaveLength(2);
        expect(res.body.errors[0].message).toMatch(/missing first or last name/i);
    });

    it('reports errors for rows with invalid email', async () => {
        mockAccess();
        const csv = 'Alice,Smith,not-an-email';
        const res = await request(app).post(url).set(auth()).send({ csv });
        expect(res.status).toBe(200);
        expect(res.body.created).toBe(0);
        expect(res.body.errors[0].message).toMatch(/invalid email/i);
    });

    it('reports errors for rows with empty email', async () => {
        mockAccess();
        const csv = 'Alice,Smith,';
        const res = await request(app).post(url).set(auth()).send({ csv });
        expect(res.status).toBe(200);
        expect(res.body.errors[0].message).toMatch(/invalid email/i);
    });

    it('reports db errors per row without failing the whole import', async () => {
        mockAccess();
        const csv = 'first_name,last_name,email\nAlice,Smith,alice@test.com\nBob,Jones,bob@test.com';
        mockDbQuery.mockResolvedValueOnce(null); // Alice fails (DbError)
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // Bob succeeds
        const res = await request(app).post(url).set(auth()).send({ csv });
        expect(res.status).toBe(200);
        expect(res.body.created).toBe(1);
        expect(res.body.errors).toHaveLength(1);
    });

    it('handles quoted CSV fields with commas', async () => {
        mockAccess();
        const csv = '"Smith, Jr.",Bob,bob@test.com';
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const res = await request(app).post(url).set(auth()).send({ csv });
        expect(res.status).toBe(200);
        expect(res.body.created).toBe(1);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /import/teams
// ═══════════════════════════════════════════════════════════════════════════════
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
        const res = await request(app).post(url).set(auth()).send({ csv: '' });
        expect(res.status).toBe(400);
    });

    it('imports teams with header row', async () => {
        mockAccess();
        const csv = 'name,coach_email,code\nEagles,coach@test.com,EAG\nHawks,coach2@test.com,HWK';
        // For each team: teamNameExists + addTeam (INSERT team, SELECT auth, INSERT invite)
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // Eagles doesn't exist
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ id: 't1', tournament_id: T, name: 'Eagles', code: 'EAG' }], rowCount: 1 } as any) // INSERT team
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // SELECT auth (no user)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // INSERT invite
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // Hawks doesn't exist
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ id: 't2', tournament_id: T, name: 'Hawks', code: 'HWK' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const res = await request(app).post(url).set(auth()).send({ csv });
        expect(res.status).toBe(200);
        expect(res.body.created).toBe(2);
        expect(res.body.errors).toHaveLength(0);
    });

    it('imports teams without header row', async () => {
        mockAccess();
        const csv = 'Eagles,coach@test.com,EAG';
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ id: 't1', tournament_id: T, name: 'Eagles', code: 'EAG' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const res = await request(app).post(url).set(auth()).send({ csv });
        expect(res.status).toBe(200);
        expect(res.body.created).toBe(1);
    });

    it('reports error for missing team name', async () => {
        mockAccess();
        const csv = ',coach@test.com,EAG';
        const res = await request(app).post(url).set(auth()).send({ csv });
        expect(res.status).toBe(200);
        expect(res.body.errors[0].message).toMatch(/missing team name/i);
    });

    it('reports error for invalid coach email', async () => {
        mockAccess();
        const csv = 'Eagles,not-an-email,EAG';
        const res = await request(app).post(url).set(auth()).send({ csv });
        expect(res.status).toBe(200);
        expect(res.body.errors[0].message).toMatch(/invalid coach email/i);
    });

    it('reports error for duplicate team name', async () => {
        mockAccess();
        const csv = 'Eagles,coach@test.com,EAG';
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'existing' }], rowCount: 1 } as any); // teamNameExists
        const res = await request(app).post(url).set(auth()).send({ csv });
        expect(res.status).toBe(200);
        expect(res.body.errors[0].message).toMatch(/already exists/i);
    });

    it('uses team name as code when code column is missing', async () => {
        mockAccess();
        const csv = 'Eagles,coach@test.com';
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ id: 't1', tournament_id: T, name: 'Eagles', code: 'Eagles' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).post(url).set(auth()).send({ csv });
        expect(res.status).toBe(200);
        expect(res.body.created).toBe(1);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /export/standings
// ═══════════════════════════════════════════════════════════════════════════════
describe('GET /api/organizer/tournament/:id/export/standings', () => {
    const url = `/organizer/tournament/${T}/export/standings`;

    it('returns CSV with standings data', async () => {
        mockAccess();
        // getOrganizerStandingsData returns config, teams, ballots, rounds
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ stats_xml: '<s/>', standings_xml: '<st/>' }], rowCount: 1 } as any) // config
            .mockResolvedValueOnce({ rows: [
                { id: 't1', name: 'Eagles', code: 'EAG' },
                { id: 't2', name: 'Hawks', code: 'HWK' },
            ], rowCount: 2 } as any) // teams
            .mockResolvedValueOnce({ rows: [{ round_id: 'r1', name: 'Round 1' }], rowCount: 1 } as any) // rounds
            .mockResolvedValueOnce({ rows: [
                { p_team_id: 't1', d_team_id: 't2', p_points: 80, d_points: 70, pairing_id: 'p1', round_id: 'r1' },
            ], rowCount: 1 } as any); // ballots
        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/csv/);
        expect(res.headers['content-disposition']).toMatch(/standings\.csv/);
        expect(res.text).toContain('Team Name,Team Code,Ballots Won');
        expect(res.text).toContain('Eagles');
        expect(res.text).toContain('Hawks');
    });

    it('returns CSV with empty data when no teams', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(200);
        expect(res.text).toContain('Team Name');
    });

    it('returns 500 on db failure', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce(null) // config query fails
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);
        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(500);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /export/results
// ═══════════════════════════════════════════════════════════════════════════════
describe('GET /api/organizer/tournament/:id/export/results', () => {
    const url = `/organizer/tournament/${T}/export/results`;

    it('returns CSV with results data', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // config
            .mockResolvedValueOnce({ rows: [
                { id: 't1', name: 'Eagles', code: 'EAG' },
                { id: 't2', name: 'Hawks', code: 'HWK' },
            ], rowCount: 2 } as any)
            .mockResolvedValueOnce({ rows: [{ round_id: 'r1', name: 'Round 1' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [
                { p_team_id: 't1', d_team_id: 't2', p_points: 80, d_points: 70, pairing_id: 'p1', round_id: 'r1' },
            ], rowCount: 1 } as any);
        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/csv/);
        expect(res.headers['content-disposition']).toMatch(/results\.csv/);
        expect(res.text).toContain('Round,Prosecution,Defense,P Points,D Points');
        expect(res.text).toContain('Round 1');
    });

    it('handles unknown team/round IDs gracefully', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // no teams
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // no rounds
            .mockResolvedValueOnce({ rows: [
                { p_team_id: 'unknown1', d_team_id: 'unknown2', p_points: 50, d_points: 60, pairing_id: 'p1', round_id: 'unknownR' },
            ], rowCount: 1 } as any);
        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(200);
        expect(res.text).toContain('Unknown');
    });

    it('returns 500 on db failure', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);
        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(500);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /awards
// ═══════════════════════════════════════════════════════════════════════════════
describe('GET /api/organizer/tournament/:id/awards', () => {
    const url = `/organizer/tournament/${T}/awards`;

    it('returns empty array when no ballots exist', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('returns empty array when ballots have no nominations', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({
            rows: [
                { ballot_json: { scores: [], nominations: [] } },
                { ballot_json: { scores: [] } }, // no nominations key
            ],
            rowCount: 2,
        } as any);
        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('aggregates nominations and returns sorted results', async () => {
        mockAccess();
        const s1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        const s2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
        // ballots with nominations
        mockDbQuery.mockResolvedValueOnce({
            rows: [
                { ballot_json: { nominations: [{ studentId: s1, rank: 1 }, { studentId: s2, rank: 2 }] } },
                { ballot_json: { nominations: [{ studentId: s1, rank: 2 }] } },
            ],
            rowCount: 2,
        } as any);
        // student info lookup
        mockDbQuery.mockResolvedValueOnce({
            rows: [
                { student_id: s1, student_name: 'Alice', team_name: 'Eagles', team_code: 'EAG' },
                { student_id: s2, student_name: 'Bob', team_name: 'Hawks', team_code: 'HWK' },
            ],
            rowCount: 2,
        } as any);
        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        // s1 has 2 nominations, s2 has 1 — s1 should be first
        expect(res.body[0].student_id).toBe(s1);
        expect(res.body[0].total_nominations).toBe(2);
        expect(res.body[0].average_rank).toBe(1.5);
        expect(res.body[1].student_id).toBe(s2);
        expect(res.body[1].total_nominations).toBe(1);
    });

    it('handles nominations with unknown students', async () => {
        mockAccess();
        const s1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ ballot_json: { nominations: [{ studentId: s1, rank: 1 }] } }],
            rowCount: 1,
        } as any);
        // student lookup returns empty
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(200);
        expect(res.body[0].student_name).toBe('Unknown');
    });

    it('skips invalid nomination entries', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ ballot_json: { nominations: [{ studentId: null, rank: 1 }, { studentId: 'x', rank: 'bad' }] } }],
            rowCount: 1,
        } as any);
        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /bounced-emails
// ═══════════════════════════════════════════════════════════════════════════════
describe('GET /api/organizer/tournament/:id/bounced-emails', () => {
    const url = `/organizer/tournament/${T}/bounced-emails`;

    it('returns array of bounced email addresses', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ email: 'bad@test.com' }, { email: 'invalid@test.com' }],
            rowCount: 2,
        } as any);
        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toEqual(['bad@test.com', 'invalid@test.com']);
    });

    it('returns empty array when no bounced emails', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('returns empty array when query returns null', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /standings
// ═══════════════════════════════════════════════════════════════════════════════
describe('GET /api/organizer/tournament/:id/standings', () => {
    const url = `/organizer/tournament/${T}/standings`;

    it('returns 200 with standings data', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ stats_xml: '<s/>', standings_xml: '<st/>' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [{ id: 't1', name: 'Eagles', code: 'EAG' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [{ round_id: 'r1', name: 'Round 1' }], rowCount: 1 } as any)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('teams');
        expect(res.body).toHaveProperty('ballots');
    });

    it('returns 500 on db failure', async () => {
        mockAccess();
        mockDbQuery
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);
        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(500);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /status
// ═══════════════════════════════════════════════════════════════════════════════
describe('PATCH /api/organizer/tournament/:id/status', () => {
    const url = `/organizer/tournament/${T}/status`;

    it('returns 400 when status is missing', async () => {
        mockAccess();
        const res = await request(app).patch(url).set(auth()).send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/active, completed, or archived/i);
    });

    it('returns 400 for invalid status value', async () => {
        mockAccess();
        const res = await request(app).patch(url).set(auth()).send({ status: 'invalid' });
        expect(res.status).toBe(400);
    });

    it('returns 200 on success with "active"', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: T }], rowCount: 1 } as any);
        const res = await request(app).patch(url).set(auth()).send({ status: 'active' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('returns 200 on success with "completed"', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: T }], rowCount: 1 } as any);
        const res = await request(app).patch(url).set(auth()).send({ status: 'completed' });
        expect(res.status).toBe(200);
    });

    it('returns 200 on success with "archived"', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: T }], rowCount: 1 } as any);
        const res = await request(app).patch(url).set(auth()).send({ status: 'archived' });
        expect(res.status).toBe(200);
    });

    it('returns 404 when tournament not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).patch(url).set(auth()).send({ status: 'active' });
        expect(res.status).toBe(404);
    });

    it('returns 500 on db failure', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app).patch(url).set(auth()).send({ status: 'active' });
        expect(res.status).toBe(500);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /pairings/:pairingId/scoresheets/:assignmentId — DbError (500)
// (400/200/404 cases are in organizerRoundAndScorecard.test.ts)
// ═══════════════════════════════════════════════════════════════════════════════
describe('PUT /api/organizer/tournament/:id/pairings/:pid/scoresheets/:aid — DbError', () => {
    const PID = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const AID = 'c1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const url = `/organizer/tournament/${T}/pairings/${PID}/scoresheets/${AID}`;

    it('returns 500 on db failure', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app).put(url).set(auth())
            .send({ scores: [{ assignmentKey: 'k1', side: 'P', score: 9, studentId: null, categoryId: 'c1' }], reason: 'Fix' });
        expect(res.status).toBe(500);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /pairings/:pairingId/scoresheets/:assignmentId — DbError (500)
// (400/204/404 cases are in organizerRoundAndScorecard.test.ts)
// ═══════════════════════════════════════════════════════════════════════════════
describe('DELETE /api/organizer/tournament/:id/pairings/:pid/scoresheets/:aid — DbError', () => {
    const PID = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const AID = 'c1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const url = `/organizer/tournament/${T}/pairings/${PID}/scoresheets/${AID}`;

    it('returns 500 on db failure', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app).delete(url).set(auth());
        expect(res.status).toBe(500);
    });
});
