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
        const res = await request(testApp).get(`/api/score/${INVALID_UUID}`);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid assignment/i);
    });

    it('returns 404 when assignment does not exist', async () => {
        // getScoreSheet query 1: assignment lookup returns empty
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

        const res = await request(testApp).get(`/api/score/${VALID_UUID}`);
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

        const res = await request(testApp).get(`/api/score/${VALID_UUID}`);
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

        const res = await request(testApp).get(`/api/score/${VALID_UUID}`);
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

        const res = await request(testApp).get(`/api/score/${VALID_UUID}`);
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
        nominations: [],
    };

    it('returns 400 for an invalid assignment ID', async () => {
        const res = await request(testApp)
            .post(`/api/score/${INVALID_UUID}/ballot`)
            .send(validPayload);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid assignment/i);
    });

    it('returns 400 when payload is missing pairingID', async () => {
        const res = await request(testApp)
            .post(`/api/score/${VALID_UUID}/ballot`)
            .send({ scores: [] });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid payload/i);
    });

    it('returns 400 when payload is missing scores array', async () => {
        const res = await request(testApp)
            .post(`/api/score/${VALID_UUID}/ballot`)
            .send({ pairingID: 'p1' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid payload/i);
    });

    it('returns 404 when assignment does not exist', async () => {
        // submitBallot query 1: assignment lookup
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

        const res = await request(testApp)
            .post(`/api/score/${VALID_UUID}/ballot`)
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
            .post(`/api/score/${VALID_UUID}/ballot`)
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
        // submitBallot query 2: insert succeeds
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

        const res = await request(testApp)
            .post(`/api/score/${VALID_UUID}/ballot`)
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
            nominations: [],
        };

        mockDbQuery.mockResolvedValueOnce({
            rows: [{ pairing_id: 'p1', tournament_id: 'tour1', p_team: 't1', d_team: 't2' }],
            rowCount: 1,
        } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

        const res = await request(testApp)
            .post(`/api/score/${VALID_UUID}/ballot`)
            .send(payload);
        expect(res.status).toBe(201);

        // p_points = 5 + 3 = 8, d_points = 9 + 6 = 15
        const insertArgs = mockDbQuery.mock.calls[1][1] as unknown[];
        expect(insertArgs[6]).toBe(8);  // p_points
        expect(insertArgs[7]).toBe(15); // d_points
    });
});

// ─── POST /api/score/:assignmentId/conflict ───────────────────────────────────
describe('POST /api/score/:assignmentId/conflict', () => {
    it('returns 400 for an invalid assignment ID', async () => {
        const res = await request(testApp)
            .post(`/api/score/${INVALID_UUID}/conflict`);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid assignment/i);
    });

    it('returns 200 immediately (fire-and-forget)', async () => {
        // The route doesn't await the provider call, so it returns 200 regardless
        // Mock the provider's flag update (fire-and-forget, so won't affect response)
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

        const res = await request(testApp)
            .post(`/api/score/${VALID_UUID}/conflict`);
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
            .post(`/api/score/${VALID_UUID}/conflict`);
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
            .post(`/api/score/${VALID_UUID}/conflict`);
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
            .post(`/api/score/${VALID_UUID}/conflict`);
        expect(res.status).toBe(200);

        await new Promise(resolve => setTimeout(resolve, 50));
        expect(mockSendEmail).not.toHaveBeenCalled();
    });
});
