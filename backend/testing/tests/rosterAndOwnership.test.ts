import request from 'supertest';
import app from '../../src/appService';
import { dbQuery } from '../../src/db';
import { setupAuth, makeAuth, makeMockAccess } from '../helpers/auth';

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;

const TOURNAMENT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TEAM_ID       = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const COACH_ID      = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
const STUDENT_ID    = 'd4e5f6a7-b8c9-0123-defa-234567890123';

const getToken = setupAuth();
const auth = () => makeAuth(getToken());

/** Mock verifyTournamentAccess */
const mockOrgAccess = () => makeMockAccess(mockDbQuery as jest.MockedFunction<(...args: unknown[]) => unknown>);

/** Mock verifyTeamAccess (coach routes) */
const mockCoachAccess = () =>
    mockDbQuery.mockResolvedValueOnce({ rows: [{ coach_id: 'user-1' }], rowCount: 1 } as any);

// ─── PUT /api/organizer/tournament/:id/teams/:teamId/owner ────────────────────
describe('PUT /api/organizer/tournament/:id/teams/:teamId/owner', () => {
    it('returns 401 with no token', async () => {
        const res = await request(app).put(`/api/organizer/tournament/${TOURNAMENT_ID}/teams/${TEAM_ID}/owner`);
        expect(res.status).toBe(401);
    });

    it('returns 400 for invalid teamId', async () => {
        mockOrgAccess();
        const res = await request(app)
            .put(`/api/organizer/tournament/${TOURNAMENT_ID}/teams/bad-id/owner`)
            .set(auth()).send({ coachId: COACH_ID });
        expect(res.status).toBe(400);
    });

    it('returns 400 when coachId is missing', async () => {
        mockOrgAccess();
        const res = await request(app)
            .put(`/api/organizer/tournament/${TOURNAMENT_ID}/teams/${TEAM_ID}/owner`)
            .set(auth()).send({});
        expect(res.status).toBe(400);
    });

    it('returns 400 when coachId is invalid uuid', async () => {
        mockOrgAccess();
        const res = await request(app)
            .put(`/api/organizer/tournament/${TOURNAMENT_ID}/teams/${TEAM_ID}/owner`)
            .set(auth()).send({ coachId: 'not-a-uuid' });
        expect(res.status).toBe(400);
    });

    it('returns 404 when coach is not on the team', async () => {
        mockOrgAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // member check
        const res = await request(app)
            .put(`/api/organizer/tournament/${TOURNAMENT_ID}/teams/${TEAM_ID}/owner`)
            .set(auth()).send({ coachId: COACH_ID });
        expect(res.status).toBe(404);
    });

    it('returns 204 on successful ownership transfer', async () => {
        mockOrgAccess();
        mockDbQuery
            .mockResolvedValueOnce({ rows: [{ coach_id: COACH_ID }], rowCount: 1 } as any) // member check
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)                        // UPDATE is_owner=false
            .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);                       // UPDATE is_owner=true
        const res = await request(app)
            .put(`/api/organizer/tournament/${TOURNAMENT_ID}/teams/${TEAM_ID}/owner`)
            .set(auth()).send({ coachId: COACH_ID });
        expect(res.status).toBe(204);
    });
});

// ─── POST /api/organizer/tournament/:id/teams/:teamId/students (pronouns) ─────
describe('POST /api/organizer/tournament/:id/teams/:teamId/students', () => {
    it('returns 400 when student_name is missing', async () => {
        mockOrgAccess();
        const res = await request(app)
            .post(`/api/organizer/tournament/${TOURNAMENT_ID}/teams/${TEAM_ID}/students`)
            .set(auth()).send({ pronouns: 'she/her' });
        expect(res.status).toBe(400);
    });

    it('stores and returns pronouns', async () => {
        mockOrgAccess();
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ student_id: STUDENT_ID, team_id: TEAM_ID, student_name: 'Alice', pronouns: 'she/her' }],
            rowCount: 1,
        } as any);
        const res = await request(app)
            .post(`/api/organizer/tournament/${TOURNAMENT_ID}/teams/${TEAM_ID}/students`)
            .set(auth()).send({ student_name: 'Alice', pronouns: 'she/her' });
        expect(res.status).toBe(201);
        expect(res.body.pronouns).toBe('she/her');
    });

    it('returns 409 on duplicate student name', async () => {
        mockOrgAccess();
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // conflict
        const res = await request(app)
            .post(`/api/organizer/tournament/${TOURNAMENT_ID}/teams/${TEAM_ID}/students`)
            .set(auth()).send({ student_name: 'Alice', pronouns: 'she/her' });
        expect(res.status).toBe(409);
    });
});

// ─── POST /api/coach/teams/:teamId/students (pronouns) ────────────────────────
describe('POST /api/coach/teams/:teamId/students', () => {
    it('returns 400 when student_name is missing', async () => {
        mockCoachAccess();
        const res = await request(app)
            .post(`/api/coach/teams/${TEAM_ID}/students`)
            .set(auth()).send({ pronouns: 'he/him' });
        expect(res.status).toBe(400);
    });

    it('stores and returns pronouns', async () => {
        mockCoachAccess();
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ student_id: STUDENT_ID, team_id: TEAM_ID, student_name: 'Bob', pronouns: 'he/him' }],
            rowCount: 1,
        } as any);
        const res = await request(app)
            .post(`/api/coach/teams/${TEAM_ID}/students`)
            .set(auth()).send({ student_name: 'Bob', pronouns: 'he/him' });
        expect(res.status).toBe(201);
        expect(res.body.pronouns).toBe('he/him');
    });

    it('accepts null pronouns', async () => {
        mockCoachAccess();
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ student_id: STUDENT_ID, team_id: TEAM_ID, student_name: 'Sam', pronouns: null }],
            rowCount: 1,
        } as any);
        const res = await request(app)
            .post(`/api/coach/teams/${TEAM_ID}/students`)
            .set(auth()).send({ student_name: 'Sam' });
        expect(res.status).toBe(201);
        expect(res.body.pronouns).toBeNull();
    });
});
