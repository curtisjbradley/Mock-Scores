jest.mock('../../src/email', () => jest.requireActual('../mocks/email'));

import request from 'supertest';
import testApp from '../../src/appService';
import { dbQuery } from '../../src/db';
import { sendEmail, conflictReportEmail } from '../../src/email';

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;
const mockConflictReportEmail = conflictReportEmail as jest.MockedFunction<typeof conflictReportEmail>;

beforeEach(() => jest.clearAllMocks());

const VALID_UUID = '00000000-0000-0000-0000-000000000001';
const INVALID_UUID = 'not-a-uuid';

// ─── GET /api/score/:assignmentId ─────────────────────────────────────────────
describe('GET /api/score/:assignmentId', () => {
    it('returns 400 for an invalid assignment ID', async () => {
        const res = await request(testApp).get(`/score/${INVALID_UUID}`);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid assignment/i);
    });

    it('returns 404 when assignment does not exist', async () => {
        // getScoreSheet query 1: assignment lookup returns empty
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

        const res = await request(testApp).get(`/score/${VALID_UUID}`);
        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/not found/i);
    });

    it('returns 410 when ballot already submitted', async () => {
        // Query 1: assignment lookup
        mockDbQuery.mockResolvedValueOnce({
            rows: [{
                pairing_id: 'p1',
                registered_scorer_id: 's1',
                paper_scorer_id: null,
                p_team: 't1',
                d_team: 't2',
                courtroom_name: 'Room 101',
                tournament_id: 'tour1',
                presider_scorer_assignment_id: null,
                show_scores: null,
                conflict_reported: false,
            }],
            rowCount: 1,
        } as never);
        // Query 2: existing ballot check — ballot exists
        mockDbQuery.mockResolvedValueOnce({ rows: [{ ballot_id: 'b1' }], rowCount: 1 } as never);

        const res = await request(testApp).get(`/score/${VALID_UUID}`);
        expect(res.status).toBe(410);
        expect(res.body.message).toMatch(/already submitted/i);
    });

    it('returns 409 when conflict reported', async () => {
        // Query 1: assignment lookup with conflict_reported = true
        mockDbQuery.mockResolvedValueOnce({
            rows: [{
                pairing_id: 'p1',
                registered_scorer_id: 's1',
                paper_scorer_id: null,
                p_team: 't1',
                d_team: 't2',
                courtroom_name: 'Room 101',
                tournament_id: 'tour1',
                presider_scorer_assignment_id: null,
                show_scores: null,
                conflict_reported: true,
            }],
            rowCount: 1,
        } as never);

        const res = await request(testApp).get(`/score/${VALID_UUID}`);
        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/conflict/i);
    });

    it('returns 200 with a score sheet format for a valid assignment', async () => {
        // Query 1: assignment lookup
        mockDbQuery.mockResolvedValueOnce({
            rows: [{
                pairing_id: 'p1',
                registered_scorer_id: 's1',
                paper_scorer_id: null,
                p_team: 't1',
                d_team: 't2',
                courtroom_name: 'Room 101',
                tournament_id: 'tour1',
                presider_scorer_assignment_id: null,
                show_scores: null,
                conflict_reported: false,
            }],
            rowCount: 1,
        } as never);
        // Query 2: existing ballot check — no ballot
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        // Query 3: scorer name lookup
        mockDbQuery.mockResolvedValueOnce({ rows: [{ first_name: 'Jane', last_name: 'Judge' }], rowCount: 1 } as never);
        // Query 4: tournament/format lookup
        mockDbQuery.mockResolvedValueOnce({
            rows: [{
                case_name: 'State v. Doe',
                criminal_case: true,
                p_witnesses_called: 2,
                d_witnesses_called: 2,
                has_swing: false,
                format_id: 'fmt1',
            }],
            rowCount: 1,
        } as never);
        // Query 5: teams
        mockDbQuery.mockResolvedValueOnce({
            rows: [
                { id: 't1', code: '101', name: 'Team Alpha' },
                { id: 't2', code: '202', name: 'Team Beta' },
            ],
            rowCount: 2,
        } as never);
        // Query 6: presider name (no presider)
        // skipped since presider_scorer_assignment_id is null

        // Query 6: scoring categories
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ id: 'cat1', name: 'Opening', witness_category: false, position: 1 }],
            rowCount: 1,
        } as never);
        // Query 7: scoring fields
        mockDbQuery.mockResolvedValueOnce({
            rows: [{
                id: 'f1', category_id: 'cat1', label: 'Opening Statement',
                min_score: 1, max_score: 10, assignable: true,
                prosecution: true, defense: true, calling: false, crossing: false,
                visible_to_scorers: true, position: 1,
            }],
            rowCount: 1,
        } as never);
        // Query 8: witnesses
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        // Query 9: witness call order
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        // Query 10: student assignments
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

        const res = await request(testApp).get(`/score/${VALID_UUID}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('isCriminal', true);
        expect(res.body).toHaveProperty('caseName', 'State v. Doe');
        expect(res.body).toHaveProperty('prosecutionCode', '101');
        expect(res.body).toHaveProperty('defenseCode', '202');
        expect(res.body.scorer).toEqual(expect.objectContaining({
            firstName: 'Jane',
            lastName: 'Judge',
        }));
        expect(res.body.scoringCategories).toHaveProperty('cat1');
    });
});

// ─── POST /api/score/:assignmentId/ballot ─────────────────────────────────────
describe('POST /api/score/:assignmentId/ballot', () => {
    const validPayload = {
        pairingID: 'p1',
        scores: [
            { categoryId: 'cat1', assignmentKey: 'open1', side: 'P', studentId: 's1', score: 8 },
            { categoryId: 'cat1', assignmentKey: 'open1', side: 'D', studentId: 's2', score: 7 },
        ],
        tiebreaker : VALID_UUID,
        nominations: [],
    };

    it('returns 400 for an invalid assignment ID', async () => {
        const res = await request(testApp)
            .post(`/score/${INVALID_UUID}/ballot`)
            .send(validPayload);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid assignment/i);
    });

    it('returns 400 when payload is missing pairingID', async () => {
        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/ballot`)
            .send({ scores: [] });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid payload/i);
    });

    it('returns 400 when payload is missing scores array', async () => {
        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/ballot`)
            .send({ pairingID: 'p1' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid payload/i);
    });

    it('returns 404 when assignment does not exist', async () => {
        // submitBallot query 1: assignment lookup
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/ballot`)
            .send(validPayload);
        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/not found/i);
    });

    it('returns 409 when ballot already submitted (unique constraint)', async () => {
        // submitBallot query 1: assignment lookup
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ pairing_id: 'p1', tournament_id: 'tour1', p_team: 't1', d_team: 't2' }],
            rowCount: 1,
        } as never);
        // submitBallot query 2: insert fails with unique constraint
        const pgError = new Error('duplicate key') as Error & { code: string; detail: string };
        pgError.code = '23505';
        pgError.detail = 'scorer_assignment_id';
        mockDbQuery.mockRejectedValueOnce(pgError);

        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/ballot`)
            .send(validPayload);
        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/already submitted/i);
    });

    it('returns 201 on successful ballot submission', async () => {
        // submitBallot query 1: assignment lookup
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ pairing_id: 'p1', tournament_id: 'tour1', p_team: 't1', d_team: 't2' }],
            rowCount: 1,
        } as never);
        // submitBallot query 2: insert succeeds (RETURNING ballot_id)
        mockDbQuery.mockResolvedValueOnce({ rows: [{ ballot_id: 'b1' }], rowCount: 1 } as never);

        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/ballot`)
            .send(validPayload);
        expect(res.status).toBe(201);
        expect(res.body.message).toMatch(/ballot submitted/i);

        // Verify the insert was called with correct point totals (8 + 7 = 15)
        const insertCall = mockDbQuery.mock.calls[1];
        expect(insertCall[1]).toContain(8); // p_points
        expect(insertCall[1]).toContain(7); // d_points
    });

    it('calculates p_points and d_points correctly from scores', async () => {
        const payload = {
            pairingID: 'p1',
            scores: [
                { categoryId: 'c1', assignmentKey: 'k1', side: 'P', studentId: null, score: 5 },
                { categoryId: 'c1', assignmentKey: 'k2', side: 'P', studentId: null, score: 3 },
                { categoryId: 'c1', assignmentKey: 'k3', side: 'D', studentId: null, score: 9 },
                { categoryId: 'c1', assignmentKey: 'k4', side: 'D', studentId: null, score: 6 },
            ],
            tiebreaker: VALID_UUID,
            nominations: [],
        };

        mockDbQuery.mockResolvedValueOnce({
            rows: [{ pairing_id: 'p1', tournament_id: 'tour1', p_team: 't1', d_team: 't2' }],
            rowCount: 1,
        } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ ballot_id: 'b1' }], rowCount: 1 } as never);

        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/ballot`)
            .send(payload);
        expect(res.status).toBe(201);

        // p_points = 5 + 3 = 8, d_points = 9 + 6 = 15
        const insertArgs = mockDbQuery.mock.calls[1][1] as unknown[];
        expect(insertArgs[6]).toBe(8);  // p_points
        expect(insertArgs[7]).toBe(15); // d_points
    });

    it('inserts nominations in the same transaction after the ballot', async () => {
        const payload = {
            pairingID: 'p1',
            scores: [{ categoryId: 'c1', assignmentKey: 'k1', side: 'P', studentId: null, score: 5 }],
            nominations: [
                { awardCategoryId: 'award1', studentId: 'stu1', rank: 1 },
                { awardCategoryId: 'award1', studentId: 'stu2', rank: 2 },
            ],
            tiebreaker: VALID_UUID,
        };

        // Query 1: assignment lookup
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ pairing_id: 'p1', tournament_id: 'tour1', p_team: 't1', d_team: 't2' }],
            rowCount: 1,
        } as never);
        // Query 2: ballot insert (RETURNING ballot_id)
        mockDbQuery.mockResolvedValueOnce({ rows: [{ ballot_id: 'b1' }], rowCount: 1 } as never);
        // Query 3 & 4: nomination inserts
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/ballot`)
            .send(payload);
        expect(res.status).toBe(201);

        // Ballot insert, then one insert per nomination — all on the tx client.
        expect(mockDbQuery.mock.calls[1][0]).toMatch(/INSERT INTO ballots/i);
        expect(mockDbQuery.mock.calls[2][0]).toMatch(/INSERT INTO nominations/i);
        expect(mockDbQuery.mock.calls[2][1]).toEqual(['b1', 'award1', 'stu1', 1]);
        expect(mockDbQuery.mock.calls[3][1]).toEqual(['b1', 'award1', 'stu2', 2]);
    });

    it('rolls back (rejects) when a nomination insert fails, so no partial write is committed', async () => {
        const payload = {
            pairingID: 'p1',
            tiebreaker: VALID_UUID,
            scores: [{ categoryId: 'c1', assignmentKey: 'k1', side: 'P', studentId: null, score: 5 }],
            nominations: [{ awardCategoryId: 'award1', studentId: 'stu1', rank: 1 }],
        };

        // Query 1: assignment lookup
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ pairing_id: 'p1', tournament_id: 'tour1', p_team: 't1', d_team: 't2' }],
            rowCount: 1,
        } as never);
        // Query 2: ballot insert succeeds
        mockDbQuery.mockResolvedValueOnce({ rows: [{ ballot_id: 'b1' }], rowCount: 1 } as never);
        // Query 3: nomination insert fails — must abort the transaction
        mockDbQuery.mockRejectedValueOnce(new Error('nomination FK violation'));

        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/ballot`)
            .send(payload);
        // Non-409/404 provider error surfaces as a 500 — the point is the request
        // did NOT succeed, so the ballot would have been rolled back in real PG.
        expect(res.status).toBe(500);
    });
});

// ─── POST /api/score/:assignmentId/conflict ───────────────────────────────────
describe('POST /api/score/:assignmentId/conflict', () => {
    it('returns 400 for an invalid assignment ID', async () => {
        const res = await request(testApp)
            .post(`/score/${INVALID_UUID}/conflict`);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid assignment/i);
    });

    it('returns 200 immediately (fire-and-forget)', async () => {
        // The route doesn't await the provider call, so it returns 200 regardless
        // Mock the provider's flag update (fire-and-forget, so won't affect response)
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/conflict`);
        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/conflict reported/i);
    });

    it('sends conflict notification email when flag is newly set', async () => {
        // Query 1: UPDATE sets conflict_reported (rowCount=1 means success)
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
        // Query 2: context lookup for email
        mockDbQuery.mockResolvedValueOnce({
            rows: [{
                scorer_first_name: 'Jane',
                scorer_last_name: 'Judge',
                paper_name: null,
                tournament_name: 'State Championship',
                round_name: 'Round 1',
                courtroom_name: 'Room A',
                owner_email: 'owner@example.com',
                owner_first_name: 'Alex',
            }],
            rowCount: 1,
        } as never);

        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/conflict`);
        expect(res.status).toBe(200);

        // Wait a tick for the fire-and-forget promise to resolve
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(mockConflictReportEmail).toHaveBeenCalledWith(
            'Alex',
            'Jane Judge',
            'State Championship',
            'Round 1',
            'Room A',
        );
        expect(mockSendEmail).toHaveBeenCalled();
    });

    it('does not send email when conflict was already reported', async () => {
        // Query 1: UPDATE returns rowCount=0 (already reported)
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        // Query 2: exists check — assignment exists
        mockDbQuery.mockResolvedValueOnce({ rows: [{ assignment_id: VALID_UUID }], rowCount: 1 } as never);

        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/conflict`);
        expect(res.status).toBe(200);

        await new Promise(resolve => setTimeout(resolve, 50));
        expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('does not send email when assignment does not exist', async () => {
        // Query 1: UPDATE returns rowCount=0 (not found)
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        // Query 2: exists check — not found
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

        const res = await request(testApp)
            .post(`/score/${VALID_UUID}/conflict`);
        expect(res.status).toBe(200);

        await new Promise(resolve => setTimeout(resolve, 50));
        expect(mockSendEmail).not.toHaveBeenCalled();
    });
});

// ─── GET /api/score/:assignmentId — paper scorer path ─────────────────────────
describe('GET /api/score/:assignmentId — paper scorer path', () => {
    it('returns score sheet with paper scorer name', async () => {
        // Query 1: assignment lookup (paper_scorer_id set, registered_scorer_id null)
        mockDbQuery.mockResolvedValueOnce({
            rows: [{
                pairing_id: 'p1',
                registered_scorer_id: null,
                paper_scorer_id: 'ps1',
                p_team: 't1',
                d_team: 't2',
                courtroom_name: 'Room A',
                tournament_id: 'tour1',
                presider_scorer_assignment_id: null,
                show_scores: null,
                conflict_reported: false,
            }],
            rowCount: 1,
        } as never);
        // Query 2: existing ballot check — no ballot
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        // Query 3: paper scorer name lookup
        mockDbQuery.mockResolvedValueOnce({ rows: [{ name: 'Paper Pat' }], rowCount: 1 } as never);
        // Query 4: tournament/format
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ case_name: 'State v. Smith', criminal_case: false, p_witnesses_called: 2, d_witnesses_called: 2, has_swing: false, format_id: 'fmt1' }],
            rowCount: 1,
        } as never);
        // Query 5: teams
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ id: 't1', code: '101', name: 'Alpha' }, { id: 't2', code: '202', name: 'Beta' }],
            rowCount: 2,
        } as never);
        // Query 6: scoring categories
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        // Query 7: scoring fields
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        // Query 8: witnesses
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        // Query 9: witness call order
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        // Query 10: student assignments
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

        const res = await request(testApp).get(`/score/${VALID_UUID}`);
        expect(res.status).toBe(200);
        expect(res.body.scorer.firstName).toBe('Paper Pat');
        expect(res.body.scorer.lastName).toBe('');
        expect(res.body.scorer.isPaper).toBe(true);
    });
});

// ─── GET /api/score/:assignmentId — presider name resolution ──────────────────
describe('GET /api/score/:assignmentId — presider name resolution', () => {
    it('resolves presider name from registered scorer', async () => {
        const PRESIDER_ASG = '00000000-0000-0000-0000-000000000099';
        mockDbQuery.mockResolvedValueOnce({
            rows: [{
                pairing_id: 'p1', registered_scorer_id: 's1', paper_scorer_id: null,
                p_team: 't1', d_team: 't2', courtroom_name: 'Room B', tournament_id: 'tour1',
                presider_scorer_assignment_id: PRESIDER_ASG, show_scores: true, conflict_reported: false,
            }],
            rowCount: 1,
        } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ first_name: 'Jane', last_name: 'Judge' }], rowCount: 1 } as never);
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ case_name: 'Case', criminal_case: true, p_witnesses_called: 2, d_witnesses_called: 2, has_swing: false, format_id: 'fmt1' }],
            rowCount: 1,
        } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 't1', code: 'P1', name: 'Team P' }, { id: 't2', code: 'D1', name: 'Team D' }], rowCount: 2 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ registered_scorer_id: 'presider-scorer-id', paper_scorer_id: null }], rowCount: 1 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ first_name: 'Alex', last_name: 'Presider' }], rowCount: 1 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

        const res = await request(testApp).get(`/score/${VALID_UUID}`);
        expect(res.status).toBe(200);
        expect(res.body.presiderName).toBe('Alex Presider');
        expect(res.body.ballotOptions.fillableScores).toBe(true);
    });

    it('resolves presider name from paper scorer', async () => {
        const PRESIDER_ASG = '00000000-0000-0000-0000-000000000099';
        mockDbQuery.mockResolvedValueOnce({
            rows: [{
                pairing_id: 'p1', registered_scorer_id: 's1', paper_scorer_id: null,
                p_team: 't1', d_team: 't2', courtroom_name: 'Room C', tournament_id: 'tour1',
                presider_scorer_assignment_id: PRESIDER_ASG, show_scores: null, conflict_reported: false,
            }],
            rowCount: 1,
        } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ first_name: 'Jane', last_name: 'Judge' }], rowCount: 1 } as never);
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ case_name: 'Case', criminal_case: false, p_witnesses_called: 2, d_witnesses_called: 2, has_swing: false, format_id: 'fmt1' }],
            rowCount: 1,
        } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 't1', code: 'P1', name: 'Team P' }, { id: 't2', code: 'D1', name: 'Team D' }], rowCount: 2 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ registered_scorer_id: null, paper_scorer_id: 'paper-presider' }], rowCount: 1 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ name: 'Paper Presider' }], rowCount: 1 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

        const res = await request(testApp).get(`/score/${VALID_UUID}`);
        expect(res.status).toBe(200);
        expect(res.body.presiderName).toBe('Paper Presider');
    });

    it('returns showTiebreaker=true when presider with show_scores=false', async () => {
        mockDbQuery.mockResolvedValueOnce({
            rows: [{
                pairing_id: 'p1', registered_scorer_id: 's1', paper_scorer_id: null,
                p_team: 't1', d_team: 't2', courtroom_name: 'Room D', tournament_id: 'tour1',
                presider_scorer_assignment_id: VALID_UUID, show_scores: false, conflict_reported: false,
            }],
            rowCount: 1,
        } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ first_name: 'Jane', last_name: 'Judge' }], rowCount: 1 } as never);
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ case_name: 'Case', criminal_case: false, p_witnesses_called: 2, d_witnesses_called: 2, has_swing: false, format_id: 'fmt1' }],
            rowCount: 1,
        } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 't1', code: 'P1', name: 'Team P' }, { id: 't2', code: 'D1', name: 'Team D' }], rowCount: 2 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ registered_scorer_id: 's1', paper_scorer_id: null }], rowCount: 1 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ first_name: 'Jane', last_name: 'Judge' }], rowCount: 1 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

        const res = await request(testApp).get(`/score/${VALID_UUID}`);
        expect(res.status).toBe(200);
        expect(res.body.ballotOptions.fillableScores).toBe(false);
    });
});

// ─── GET /api/score/:assignmentId — witness categories + student assignments ──
describe('GET /api/score/:assignmentId — witness categories + student assignments', () => {
    it('returns witness category fields with call order and student data', async () => {
        mockDbQuery.mockResolvedValueOnce({
            rows: [{
                pairing_id: 'p1', registered_scorer_id: 's1', paper_scorer_id: null,
                p_team: 't1', d_team: 't2', courtroom_name: 'Room 1', tournament_id: 'tour1',
                presider_scorer_assignment_id: null, show_scores: null, conflict_reported: false,
            }],
            rowCount: 1,
        } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ first_name: 'Bob', last_name: 'Scorer' }], rowCount: 1 } as never);
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ case_name: 'Case', criminal_case: true, p_witnesses_called: 2, d_witnesses_called: 1, has_swing: true, format_id: 'fmt1' }],
            rowCount: 1,
        } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 't1', code: '101', name: 'Alpha' }, { id: 't2', code: '202', name: 'Beta' }], rowCount: 2 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'cat1', name: 'Witnesses', witness_category: true, position: 1 }], rowCount: 1 } as never);
        mockDbQuery.mockResolvedValueOnce({
            rows: [
                { id: 'f1', category_id: 'cat1', label: 'Direct Exam', min_score: 1, max_score: 10, assignable: true, prosecution: true, defense: false, calling: true, crossing: false, visible_to_scorers: true, position: 1 },
                { id: 'f2', category_id: 'cat1', label: 'Cross Exam', min_score: 1, max_score: 10, assignable: true, prosecution: false, defense: true, calling: false, crossing: true, visible_to_scorers: true, position: 2 },
            ],
            rowCount: 2,
        } as never);
        mockDbQuery.mockResolvedValueOnce({
            rows: [
                { id: 'w1', name: 'Witness A', side: 'P' }, { id: 'w2', name: 'Witness B', side: 'P' },
                { id: 'w3', name: 'Witness C', side: 'D' }, { id: 'w4', name: 'Swing Dan', side: 'S' },
            ],
            rowCount: 4,
        } as never);
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ team_id: 't1', witness_id: 'w2', position: 1 }, { team_id: 't1', witness_id: 'w1', position: 2 }],
            rowCount: 2,
        } as never);
        mockDbQuery.mockResolvedValueOnce({
            rows: [
                { field_id: 'f1', witness_id: 'w2', student_id: 'stu1', team_id: 't1' },
                { field_id: 'f2', witness_id: 'w2', student_id: 'stu2', team_id: 't2' },
            ],
            rowCount: 2,
        } as never);
        mockDbQuery.mockResolvedValueOnce({
            rows: [
                { student_id: 'stu1', student_name: 'Alice', pronouns: 'she/her', team_id: 't1' },
                { student_id: 'stu2', student_name: 'Bob', pronouns: null, team_id: 't2' },
            ],
            rowCount: 2,
        } as never);

        const res = await request(testApp).get(`/score/${VALID_UUID}`);
        expect(res.status).toBe(200);
        expect(res.body.witnesses).toBeTruthy();
        expect(res.body.witnesses.w2).toEqual({ characterName: 'Witness B' });
        expect(res.body.students.stu1).toEqual({ name: 'Alice', pronouns: 'she/her', schoolId: 't1' });
        expect(res.body.students.stu2).toEqual({ name: 'Bob', pronouns: null, schoolId: 't2' });
        expect(res.body.categoryOrder.length).toBeGreaterThan(0);
        expect(res.body.categoryOrder[0]).toBe('cat1__w2');
    });
});
