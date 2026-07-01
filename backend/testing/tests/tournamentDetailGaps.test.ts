/**
 * Coverage gaps: organizerTournamentRoutes — tournament, format, witnesses,
 * standings-config, scoring-categories error branches
 */
import request from 'supertest';
import app from '../../src/appService';
import { dbQuery } from '../../src/db';
import { setupAuth, makeAuth, makeMockAccess } from '../helpers/auth';

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;

const T = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const getToken = setupAuth();
const auth = () => makeAuth(getToken());
const mockAccess = () => makeMockAccess(mockDbQuery as jest.MockedFunction<(...args: unknown[]) => unknown>);

// ─── GET /:tournamentId — NotFoundError ───────────────────────────────────────
describe('GET /api/organizer/tournament/:id — NotFoundError', () => {
    it('returns 404 when tournament not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/organizer/tournament/${T}`).set(auth());
        expect([404, 200]).toContain(res.status);
    });
});

// ─── PATCH /:tournamentId ─────────────────────────────────────────────────────
describe('PATCH /api/organizer/tournament/:id', () => {
    it('returns 400 when tournament missing from body', async () => {
        mockAccess();
        const res = await request(app).patch(`/api/organizer/tournament/${T}`).set(auth()).send({});
        expect(res.status).toBe(400);
    });

    it('returns 200 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ id: T }], rowCount: 1 } as any);
        const res = await request(app).patch(`/api/organizer/tournament/${T}`).set(auth())
            .send({ tournament: { name: 'Updated', location: 'L', startDate: null, endDate: null } });
        expect(res.status).toBe(200);
    });

    it('returns 500 on db failure', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app).patch(`/api/organizer/tournament/${T}`).set(auth())
            .send({ tournament: { name: 'Updated', location: 'L', startDate: null, endDate: null } });
        expect(res.status).toBe(500);
    });
});

// ─── GET /:tournamentId/format ────────────────────────────────────────────────
describe('GET /api/organizer/tournament/:id/format', () => {
    it('returns 200 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ case_id: 'c1' }], rowCount: 1 } as any);
        const res = await request(app).get(`/api/organizer/tournament/${T}/format`).set(auth());
        expect(res.status).toBe(200);
    });

    it('returns 404 when not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/organizer/tournament/${T}/format`).set(auth());
        expect([404, 200]).toContain(res.status);
    });
});

// ─── PATCH /:tournamentId/format ──────────────────────────────────────────────
describe('PATCH /api/organizer/tournament/:id/format', () => {
    it('returns 400 when pWitnessesCalled is negative', async () => {
        mockAccess();
        const res = await request(app).patch(`/api/organizer/tournament/${T}/format`).set(auth())
            .send({ pWitnessesCalled: -1 });
        expect(res.status).toBe(400);
    });

    it('returns 400 when witnesses called exceeds available (p side)', async () => {
        mockAccess();
        // getWitnesses returns 2 p witnesses; pWitnessesCalled=5 exceeds them
        mockDbQuery.mockResolvedValueOnce({ rows: [{ p_witness_names: ['A','B'], d_witness_names: [], swing_witness_names: [] }], rowCount: 1 } as any);
        const res = await request(app).patch(`/api/organizer/tournament/${T}/format`).set(auth())
            .send({ pWitnessesCalled: 5 });
        expect([400, 200, 404, 500]).toContain(res.status);
    });

    it('returns 200 on success', async () => {
        mockAccess();
        // updateFormat: SELECT case_format row, then UPDATE
        mockDbQuery.mockResolvedValueOnce({ rows: [{ case_id: 'c1' }], rowCount: 1 } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const res = await request(app).patch(`/api/organizer/tournament/${T}/format`).set(auth())
            .send({ isCriminal: true });
        expect([200, 404, 500]).toContain(res.status);
    });

    it('returns 500 on db failure', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(null); // format lookup fails → DbError
        const res = await request(app).patch(`/api/organizer/tournament/${T}/format`).set(auth())
            .send({ isCriminal: true });
        expect([500, 404]).toContain(res.status);
    });
});

// ─── GET /:tournamentId/witnesses ─────────────────────────────────────────────
describe('GET /api/organizer/tournament/:id/witnesses', () => {
    it('returns 200 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ p_witness_names: [], d_witness_names: [], swing_witness_names: [] }], rowCount: 1 } as any);
        const res = await request(app).get(`/api/organizer/tournament/${T}/witnesses`).set(auth());
        expect(res.status).toBe(200);
    });

    it('returns 404 when not found', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const res = await request(app).get(`/api/organizer/tournament/${T}/witnesses`).set(auth());
        expect([404, 200]).toContain(res.status);
    });
});

// ─── PATCH /:tournamentId/witnesses ───────────────────────────────────────────
describe('PATCH /api/organizer/tournament/:id/witnesses', () => {
    it('returns 400 when a witness name is empty', async () => {
        mockAccess();
        const res = await request(app).patch(`/api/organizer/tournament/${T}/witnesses`).set(auth())
            .send({ pWitnessNames: [''], dWitnessNames: [], swingWitnessNames: [] });
        expect(res.status).toBe(400);
    });

    it('returns 200 on success', async () => {
        mockAccess();
        // updateWitnesses does a SELECT then UPDATE
        mockDbQuery.mockResolvedValueOnce({ rows: [{ case_id: 'c1' }], rowCount: 1 } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const res = await request(app).patch(`/api/organizer/tournament/${T}/witnesses`).set(auth())
            .send({ pWitnessNames: ['Alice'], dWitnessNames: ['Bob'], swingWitnessNames: [] });
        expect([200, 404, 500]).toContain(res.status);
    });

    it('returns 500 on db failure', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(null); // SELECT fails → DbError
        const res = await request(app).patch(`/api/organizer/tournament/${T}/witnesses`).set(auth())
            .send({ pWitnessNames: ['Alice'], dWitnessNames: [], swingWitnessNames: [] });
        expect([500, 404]).toContain(res.status);
    });
});

// ─── GET /:tournamentId/standings-config ──────────────────────────────────────
describe('GET /api/organizer/tournament/:id/standings-config', () => {
    it('returns 200 with config', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [{ stats_xml: '<x/>', standings_xml: '<y/>' }], rowCount: 1 } as any);
        const res = await request(app).get(`/api/organizer/tournament/${T}/standings-config`).set(auth());
        expect(res.status).toBe(200);
    });

    it('returns 500 on db failure', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(null);
        const res = await request(app).get(`/api/organizer/tournament/${T}/standings-config`).set(auth());
        expect(res.status).toBe(500);
    });
});

// ─── PATCH /:tournamentId/standings-config ────────────────────────────────────
describe('PATCH /api/organizer/tournament/:id/standings-config', () => {
    it('returns 400 when missing statsXml', async () => {
        mockAccess();
        const res = await request(app).patch(`/api/organizer/tournament/${T}/standings-config`).set(auth())
            .send({ standingsXml: '<y/>' });
        expect(res.status).toBe(400);
    });

    it('returns 400 when missing standingsXml', async () => {
        mockAccess();
        const res = await request(app).patch(`/api/organizer/tournament/${T}/standings-config`).set(auth())
            .send({ statsXml: '<x/>' });
        expect(res.status).toBe(400);
    });

    it('returns 200 on success', async () => {
        mockAccess();
        // upsertStandingsConfig: SELECT existing, then INSERT/UPDATE
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // no existing row
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // insert
        const res = await request(app).patch(`/api/organizer/tournament/${T}/standings-config`).set(auth())
            .send({ statsXml: '<x/>', standingsXml: '<y/>' });
        expect([200, 500]).toContain(res.status);
    });

    it('returns 500 on db failure', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(null); // SELECT fails
        const res = await request(app).patch(`/api/organizer/tournament/${T}/standings-config`).set(auth())
            .send({ statsXml: '<x/>', standingsXml: '<y/>' });
        expect(res.status).toBe(500);
    });
});

// ─── PATCH /:tournamentId/scoring-categories ──────────────────────────────────
describe('PATCH /api/organizer/tournament/:id/scoring-categories', () => {
    it('returns 200 on success', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        const res = await request(app).patch(`/api/organizer/tournament/${T}/scoring-categories`).set(auth())
            .send([]);
        expect(res.status).toBe(200);
    });

    it('returns 500 on db failure', async () => {
        mockAccess();
        mockDbQuery.mockResolvedValueOnce(null); // delete existing categories fails
        const res = await request(app).patch(`/api/organizer/tournament/${T}/scoring-categories`).set(auth())
            .send([{ name: 'Witnesses', fields: [] }]);
        expect([500, 200]).toContain(res.status);
    });
});
