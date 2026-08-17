/**
 * Tests for individual award categories:
 * - Provider: getAwardCategories, createAwardCategory, updateAwardCategory, deleteAwardCategory
 * - Routes: GET/POST/PUT/DELETE /award-categories
 * - Scorer: POST /score/:assignmentId/nominations
 * - Provider: submitNominations
 */
jest.mock('../../src/email', () => jest.requireActual('../mocks/email'));
import request from 'supertest';
import app from '../../src/appService';
import { dbQuery } from '../../src/db';
import { setupAuth, makeAuth, makeMockAccess } from '../helpers/auth';
import * as organizerProvider from '../../src/providers/organizerProvider';
import * as scorerProvider from '../../src/providers/scorerProvider';
import { DbError, NotFoundError } from '../../src/errors';

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;

const T = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const CAT_ID = 'c1d2e3f4-a5b6-7890-cdef-123456789abc';

const getToken = setupAuth();
const auth = () => makeAuth(getToken());
const mockAccess = () => makeMockAccess(mockDbQuery as jest.MockedFunction<(...args: unknown[]) => unknown>);

const ok = (rows: unknown[] = [], rowCount = rows.length) =>
    ({ rows, rowCount } as any);

// ═══════════════════════════════════════════════════════════════════════════════
// Provider: getAwardCategories
// ═══════════════════════════════════════════════════════════════════════════════
describe('organizerProvider.getAwardCategories', () => {
    it('returns mapped award categories', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([
            { id: CAT_ID, name: 'Best Attorney', min_nominees: 1, max_nominees: 3 },
        ]));
        const result = await organizerProvider.getAwardCategories(T);
        expect(result).toEqual([{ id: CAT_ID, name: 'Best Attorney', minNominees: 1, maxNominees: 3 }]);
    });

    it('returns empty array when no categories', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        expect(await organizerProvider.getAwardCategories(T)).toEqual([]);
    });

    it('throws DbError when query fails', async () => {
        mockDbQuery.mockResolvedValueOnce(null);
        await expect(organizerProvider.getAwardCategories(T)).rejects.toThrow(DbError);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Provider: createAwardCategory
// ═══════════════════════════════════════════════════════════════════════════════
describe('organizerProvider.createAwardCategory', () => {
    it('returns created category', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([{ id: CAT_ID, name: 'Best Witness', min_nominees: 1, max_nominees: 2 }]));
        const result = await organizerProvider.createAwardCategory(T, 'Best Witness', 1, 2);
        expect(result).toEqual({ id: CAT_ID, name: 'Best Witness', minNominees: 1, maxNominees: 2 });
    });

    it('throws DbError when insert fails', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(organizerProvider.createAwardCategory(T, 'X', 1, 3)).rejects.toThrow(DbError);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Provider: updateAwardCategory
// ═══════════════════════════════════════════════════════════════════════════════
describe('organizerProvider.updateAwardCategory', () => {
    it('returns updated category', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([{ id: CAT_ID, name: 'Updated', min_nominees: 2, max_nominees: 5 }]));
        const result = await organizerProvider.updateAwardCategory(CAT_ID, 'Updated', 2, 5);
        expect(result).toEqual({ id: CAT_ID, name: 'Updated', minNominees: 2, maxNominees: 5 });
    });

    it('throws NotFoundError when category not found', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(organizerProvider.updateAwardCategory(CAT_ID, 'X', 1, 3)).rejects.toThrow(NotFoundError);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Provider: deleteAwardCategory
// ═══════════════════════════════════════════════════════════════════════════════
describe('organizerProvider.deleteAwardCategory', () => {
    it('resolves when deleted', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([{ id: CAT_ID }]));
        await expect(organizerProvider.deleteAwardCategory(CAT_ID)).resolves.toBeUndefined();
    });

    it('throws NotFoundError when not found', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(organizerProvider.deleteAwardCategory(CAT_ID)).rejects.toThrow(NotFoundError);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Routes: GET /award-categories
// ═══════════════════════════════════════════════════════════════════════════════
describe('GET /api/organizer/tournament/:id/award-categories', () => {
    const url = `/organizer/tournament/${T}/award-categories`;

    it('returns 200 with categories', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(ok([
            { id: CAT_ID, name: 'Best Attorney', min_nominees: 1, max_nominees: 3 },
        ]));
        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].name).toBe('Best Attorney');
    });

    it('returns 500 on db failure', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app).get(url).set(auth());
        expect(res.status).toBe(500);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Routes: POST /award-categories
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /api/organizer/tournament/:id/award-categories', () => {
    const url = `/organizer/tournament/${T}/award-categories`;

    it('returns 400 when name is missing', async () => {
        mockAccess();
        const res = await request(app).post(url).set(auth()).send({ minNominees: 1, maxNominees: 3 });
        expect(res.status).toBe(400);
    });

    it('returns 400 when minNominees is missing', async () => {
        mockAccess();
        const res = await request(app).post(url).set(auth()).send({ name: 'X', maxNominees: 3 });
        expect(res.status).toBe(400);
    });

    it('returns 400 when maxNominees < 1', async () => {
        mockAccess();
        const res = await request(app).post(url).set(auth()).send({ name: 'X', minNominees: 0, maxNominees: 0 });
        expect(res.status).toBe(400);
    });

    it('returns 400 when minNominees > maxNominees', async () => {
        mockAccess();
        const res = await request(app).post(url).set(auth()).send({ name: 'X', minNominees: 5, maxNominees: 3 });
        expect(res.status).toBe(400);
    });

    it('returns 201 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(ok([{ id: CAT_ID, name: 'Best Attorney', min_nominees: 1, max_nominees: 3 }]));
        const res = await request(app).post(url).set(auth()).send({ name: 'Best Attorney', minNominees: 1, maxNominees: 3 });
        expect(res.status).toBe(201);
        expect(res.body.id).toBe(CAT_ID);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Routes: PUT /award-categories/:categoryId
// ═══════════════════════════════════════════════════════════════════════════════
describe('PUT /api/organizer/tournament/:id/award-categories/:categoryId', () => {
    const url = `/organizer/tournament/${T}/award-categories/${CAT_ID}`;

    it('returns 400 for invalid UUID', async () => {
        mockAccess();
        const res = await request(app).put(`/organizer/tournament/${T}/award-categories/bad-id`).set(auth())
            .send({ name: 'X', minNominees: 1, maxNominees: 3 });
        expect(res.status).toBe(400);
    });

    it('returns 400 when name is empty', async () => {
        mockAccess();
        const res = await request(app).put(url).set(auth()).send({ name: '', minNominees: 1, maxNominees: 3 });
        expect(res.status).toBe(400);
    });

    it('returns 404 when not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(ok([]));
        const res = await request(app).put(url).set(auth()).send({ name: 'Updated', minNominees: 1, maxNominees: 5 });
        expect(res.status).toBe(404);
    });

    it('returns 200 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(ok([{ id: CAT_ID, name: 'Updated', min_nominees: 1, max_nominees: 5 }]));
        const res = await request(app).put(url).set(auth()).send({ name: 'Updated', minNominees: 1, maxNominees: 5 });
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Updated');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Routes: DELETE /award-categories/:categoryId
// ═══════════════════════════════════════════════════════════════════════════════
describe('DELETE /api/organizer/tournament/:id/award-categories/:categoryId', () => {
    const url = `/organizer/tournament/${T}/award-categories/${CAT_ID}`;

    it('returns 400 for invalid UUID', async () => {
        mockAccess();
        const res = await request(app).delete(`/organizer/tournament/${T}/award-categories/bad-id`).set(auth());
        expect(res.status).toBe(400);
    });

    it('returns 404 when not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(ok([]));
        const res = await request(app).delete(url).set(auth());
        expect(res.status).toBe(404);
    });

    it('returns 204 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(ok([{ id: CAT_ID }]));
        const res = await request(app).delete(url).set(auth());
        expect(res.status).toBe(204);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scorer: POST /score/:assignmentId/nominations
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /api/score/:assignmentId/nominations', () => {
    const VALID_UUID = '00000000-0000-0000-0000-000000000001';
    const url = `/score/${VALID_UUID}/nominations`;

    it('returns 400 for invalid assignment ID', async () => {
        const res = await request(app).post('/score/bad-id/nominations').send({ nominations: [] });
        expect(res.status).toBe(400);
    });

    it('returns 400 when nominations is not an array', async () => {
        const res = await request(app).post(url).send({ nominations: 'bad' });
        expect(res.status).toBe(400);
    });

    it('returns 404 when no ballot exists', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([])); // SELECT ballot → not found
        const res = await request(app).post(url).send({ nominations: [{ awardCategoryId: CAT_ID, studentId: 's1', rank: 1 }] });
        expect(res.status).toBe(404);
    });

    it('returns 200 on success', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([{
            ballot_id: 'b1',
            ballot_json: { pairingID: 'p1', scores: [], nominations: [] },
        }])); // SELECT existing ballot
        mockDbQuery.mockResolvedValueOnce(ok([], 1)); // UPDATE ballot
        mockDbQuery.mockResolvedValueOnce(ok([], 0)); // DELETE FROM nominations
        mockDbQuery.mockResolvedValueOnce(ok([], 1)); // INSERT nomination
        const res = await request(app).post(url).send({
            nominations: [{ awardCategoryId: CAT_ID, studentId: 's1', rank: 1 }],
        });
        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/nominations saved/i);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Provider: submitNominations
// ═══════════════════════════════════════════════════════════════════════════════
describe('scorerProvider.submitNominations', () => {
    it('updates ballot_json with nominations', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([{
            ballot_id: 'b1',
            ballot_json: { pairingID: 'p1', scores: [{ categoryId: 'c1', assignmentKey: 'k1', side: 'P', studentId: 's1', score: 8 }], nominations: [] },
        }]));
        mockDbQuery.mockResolvedValueOnce(ok([], 1)); // UPDATE ballot_json
        mockDbQuery.mockResolvedValueOnce(ok([], 0)); // DELETE FROM nominations
        mockDbQuery.mockResolvedValueOnce(ok([], 1)); // INSERT nomination
        await expect(scorerProvider.submitNominations('a1', [
            { awardCategoryId: CAT_ID, studentId: 's1', rank: 1 },
        ])).resolves.toBeUndefined();

        // Verify UPDATE was called with nominations merged in
        const updateCall = mockDbQuery.mock.calls[1];
        const updatedJson = JSON.parse(updateCall[1][0] as string);
        expect(updatedJson.nominations).toEqual([{ awardCategoryId: CAT_ID, studentId: 's1', rank: 1 }]);
        expect(updatedJson.scores).toHaveLength(1); // scores preserved
    });

    it('throws NotFoundError when no ballot exists', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([]));
        await expect(scorerProvider.submitNominations('a1', [])).rejects.toThrow(NotFoundError);
    });

    it('throws DbError when update fails', async () => {
        mockDbQuery.mockResolvedValueOnce(ok([{
            ballot_id: 'b1',
            ballot_json: { pairingID: 'p1', scores: [], nominations: [] },
        }]));
        mockDbQuery.mockResolvedValueOnce(null); // UPDATE fails
        await expect(scorerProvider.submitNominations('a1', [])).rejects.toThrow(DbError);
    });
});
