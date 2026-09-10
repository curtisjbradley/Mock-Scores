jest.mock('../../src/db', () => ({
    dbQuery: jest.fn(),
    withTransaction: jest.fn(),
}));

import { dbQuery, withTransaction } from '../../src/db';
import {
    computeBallotTotals,
    fieldIdFromAssignmentKey,
    getBallot,
    getConflictReportContext,
    getFieldMultipliers,
    getPairingBallotFormat,
    getSheetFromAssignment,
    getSheetFromBallot,
    submitBallot,
    submitNominations,
} from '../../src/providers/scorerProvider';
import {
    AlreadySubmittedError,
    ConflictReportedError,
    DbError,
    NotFoundError,
    RoundNotLockedError,
} from '../../src/errors';

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>;
const mockWithTransaction = withTransaction as jest.MockedFunction<typeof withTransaction>;

const ASSIGNMENT = '00000000-0000-0000-0000-000000000001';
const BALLOT = '00000000-0000-0000-0000-000000000002';
const PAIRING = '00000000-0000-0000-0000-000000000003';
const TOURNAMENT = '00000000-0000-0000-0000-000000000004';
const P_TEAM = '00000000-0000-0000-0000-000000000005';
const D_TEAM = '00000000-0000-0000-0000-000000000006';
const TIEBREAKER = '00000000-0000-0000-0000-000000000007';

const mockClient = {
    query: jest.fn(),
};

beforeEach(() => {
    jest.resetAllMocks();
    mockWithTransaction.mockImplementation(async (fn: any) => fn(mockClient as any));
});

function baseSheetRow(overrides: Record<string, unknown> = {}) {
    return {
        assignment_id: ASSIGNMENT,
        pairing_id: PAIRING,
        paper_scorer_id: null,
        p_team: P_TEAM,
        d_team: D_TEAM,
        courtroom_name: 'Room 1',
        tournament_id: TOURNAMENT,
        presider_scorer_assignment_id: null,
        show_scores: null,
        conflict_reported: false,
        locked: true,
        scorer_first_name: 'Jane',
        scorer_last_name: 'Judge',
        paper_scorer_name: null,
        presider_first_name: null,
        presider_last_name: null,
        presider_paper_name: null,
        ...overrides,
    };
}

type BuildOptions = {
    tournament?: any;
    teams?: any[];
    categories?: any[];
    fields?: any[];
    witnesses?: any[];
    callOrder?: any[];
    assignments?: any[];
    students?: any[];
    awards?: any[];
};

function queueBuildQueries(options: BuildOptions = {}) {
    const tournament = options.tournament === undefined ? {
        tournament_name: 'State Championship',
        case_name: 'State v. Doe',
        criminal_case: true,
        p_witnesses_called: 1,
        d_witnesses_called: 1,
        has_swing: false,
        format_id: 'fmt-1',
    } : options.tournament;
    const teams = options.teams ?? [
        { id: P_TEAM, code: 'P101', name: 'Prosecution' },
        { id: D_TEAM, code: 'D202', name: 'Defense' },
    ];
    const categories = options.categories ?? [];
    const fields = options.fields ?? [];
    const witnesses = options.witnesses ?? [];
    const callOrder = options.callOrder ?? [];
    const assignments = options.assignments ?? [];
    const students = options.students ?? [];
    const awards = options.awards ?? [];

    mockDbQuery.mockResolvedValueOnce({ rows: tournament ? [tournament] : [], rowCount: tournament ? 1 : 0 } as any);
    if (!tournament) return;

    mockDbQuery.mockResolvedValueOnce({ rows: teams, rowCount: teams.length } as any);
    mockDbQuery.mockResolvedValueOnce({ rows: categories, rowCount: categories.length } as any);
    mockDbQuery.mockResolvedValueOnce({ rows: fields, rowCount: fields.length } as any);
    mockDbQuery.mockResolvedValueOnce({ rows: witnesses, rowCount: witnesses.length } as any);
    mockDbQuery.mockResolvedValueOnce({ rows: callOrder, rowCount: callOrder.length } as any);
    mockDbQuery.mockResolvedValueOnce({ rows: assignments, rowCount: assignments.length } as any);
    if (assignments.length > 0) {
        mockDbQuery.mockResolvedValueOnce({ rows: students, rowCount: students.length } as any);
    }
    mockDbQuery.mockResolvedValueOnce({ rows: awards, rowCount: awards.length } as any);
}

function samplePayload(overrides: Record<string, unknown> = {}) {
    return {
        pairingID: PAIRING,
        scores: [
            { categoryId: 'cat1', assignmentKey: 'cat1__field-p', side: 'P', studentId: null, score: 8 },
            { categoryId: 'cat1', assignmentKey: 'cat1__field-d', side: 'D', studentId: null, score: 7 },
        ],
        nominations: [],
        tiebreaker: TIEBREAKER,
        ...overrides,
    } as any;
}

describe('fieldIdFromAssignmentKey', () => {
    it('extracts field IDs from normal and witness assignment keys', () => {
        expect(fieldIdFromAssignmentKey('cat__field')).toBe('field');
        expect(fieldIdFromAssignmentKey('cat__field__witness')).toBe('field');
    });

    it('returns null when no field segment exists', () => {
        expect(fieldIdFromAssignmentKey('catOnly')).toBeNull();
    });
});

describe('computeBallotTotals', () => {
    it('applies field multipliers independently to P and D totals', () => {
        const totals = computeBallotTotals([
            { side: 'P', assignmentKey: 'cat__f1', score: 5 },
            { side: 'P', assignmentKey: 'cat__f2__w1', score: 3 },
            { side: 'D', assignmentKey: 'cat__f3', score: 4 },
        ], new Map([
            ['f1', 2],
            ['f2', 0.5],
            ['f3', 3],
        ]));

        expect(totals).toEqual({ pPoints: 11.5, dPoints: 12 });
    });

    it('defaults to multiplier 1 for missing or malformed assignment keys', () => {
        const totals = computeBallotTotals([
            { side: 'P', assignmentKey: 'cat__unknown', score: 6 },
            { side: 'D', assignmentKey: 'legacy', score: 9 },
        ], new Map());

        expect(totals).toEqual({ pPoints: 6, dPoints: 9 });
    });
});

describe('getFieldMultipliers', () => {
    it('returns a numeric map from database rows', async () => {
        mockDbQuery.mockResolvedValueOnce({
            rows: [
                { id: 'f1', multiplier: '2' },
                { id: 'f2', multiplier: 0.5 },
            ],
            rowCount: 2,
        } as any);

        const result = await getFieldMultipliers(TOURNAMENT);
        expect(result.get('f1')).toBe(2);
        expect(result.get('f2')).toBe(0.5);
        expect(mockDbQuery).toHaveBeenCalledWith(expect.stringContaining('FROM scoring_fields'), [TOURNAMENT]);
    });

    it('returns an empty map when the query yields no result object', async () => {
        mockDbQuery.mockResolvedValueOnce(undefined as any);
        await expect(getFieldMultipliers(TOURNAMENT)).resolves.toEqual(new Map());
    });
});

describe('scoresheet construction', () => {
    it('throws when getPairingBallotFormat cannot find the pairing', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        await expect(getPairingBallotFormat(PAIRING)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('builds a blank ballot with a registered presider and non-witness category', async () => {
        mockDbQuery.mockResolvedValueOnce({
            rows: [{
                p_team: P_TEAM,
                d_team: D_TEAM,
                courtroom_name: 'Court 5',
                tournament_id: TOURNAMENT,
                locked: true,
            }],
            rowCount: 1,
        } as any);
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ registered_scorer_id: 'scorer-presider', paper_scorer_id: null }],
            rowCount: 1,
        } as any);
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ first_name: 'Alex', last_name: 'Presider' }],
            rowCount: 1,
        } as any);

        queueBuildQueries({
            categories: [
                { id: 'cat1', name: 'Openings', witness_category: false, position: 1 },
                { id: 'empty', name: 'Unused', witness_category: false, position: 2 },
            ],
            fields: [{
                id: 'field1', category_id: 'cat1', label: 'Opening', min_score: 1, max_score: 10,
                multiplier: '2', assignable: true, prosecution: true, defense: true,
                calling: false, crossing: false, visible_to_scorers: true, position: 1,
                award_category_id: null,
            }],
        });

        const sheet = await getPairingBallotFormat(PAIRING);
        expect(sheet.presiderName).toBe('Alex Presider');
        expect(sheet.scorer).toEqual({ firstName: '', lastName: '', scorerID: '', isPaper: true });
        expect(sheet.ballotOptions).toEqual({ fillableScores: true, showTiebreaker: false });
        expect(sheet.roundLocked).toBe(true);
        expect(sheet.scoringCategories.cat1.categoryAssignments[0]).toEqual(expect.objectContaining({
            assignmentKey: 'cat1__field1',
            side: 'BOTH',
            multiplier: 2,
        }));
        expect(sheet.categoryOrder).toEqual(['cat1']);
    });

    it('builds witness categories, call order, student assignments, and award eligibility', async () => {
        mockDbQuery.mockResolvedValueOnce({
            rows: [{
                p_team: P_TEAM,
                d_team: D_TEAM,
                courtroom_name: null,
                tournament_id: TOURNAMENT,
                locked: false,
            }],
            rowCount: 1,
        } as any);
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ registered_scorer_id: null, paper_scorer_id: 'paper-presider' }],
            rowCount: 1,
        } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ name: 'Paper Presider' }], rowCount: 1 } as any);

        queueBuildQueries({
            tournament: {
                tournament_name: 'Invitational', case_name: 'Case', criminal_case: false,
                p_witnesses_called: 1, d_witnesses_called: 1, has_swing: true, format_id: 'fmt-2',
            },
            categories: [{ id: 'wcat', name: 'Witnesses', witness_category: true, position: 1 }],
            fields: [
                {
                    id: 'direct', category_id: 'wcat', label: 'Direct', min_score: 1, max_score: 10,
                    multiplier: 1, assignable: true, prosecution: true, defense: true,
                    calling: true, crossing: false, visible_to_scorers: true, position: 1,
                    award_category_id: 'award1',
                },
                {
                    id: 'cross', category_id: 'wcat', label: 'Cross', min_score: 1, max_score: 10,
                    multiplier: 1, assignable: true, prosecution: true, defense: true,
                    calling: false, crossing: true, visible_to_scorers: true, position: 2,
                    award_category_id: null,
                },
            ],
            witnesses: [
                { id: 'wp', name: 'P Witness', side: 'P' },
                { id: 'wd', name: 'D Witness', side: 'D' },
                { id: 'ws', name: 'Swing Witness', side: 'S' },
            ],
            callOrder: [
                { team_id: P_TEAM, witness_id: 'wp', position: 1 },
                { team_id: D_TEAM, witness_id: 'wd', position: 1 },
            ],
            assignments: [
                { field_id: 'direct', witness_id: 'wp', student_id: 'stu-p', team_id: P_TEAM },
                { field_id: 'cross', witness_id: 'wp', student_id: 'stu-d', team_id: D_TEAM },
            ],
            students: [
                { student_id: 'stu-p', student_name: 'Pat P', pronouns: 'she/her', team_id: P_TEAM },
                { student_id: 'stu-d', student_name: 'Dev D', pronouns: null, team_id: D_TEAM },
            ],
            awards: [{ id: 'award1', name: 'Best Witness', min_nominees: 1, max_nominees: 2 }],
        });

        const sheet = await getPairingBallotFormat(PAIRING);
        expect(sheet.presiderName).toBe('Paper Presider');
        expect(sheet.courtroomNumber).toBe('');
        expect(sheet.witnesses).toEqual({
            wp: { characterName: 'P Witness' },
            wd: { characterName: 'D Witness' },
        });
        expect(sheet.students['stu-p']).toEqual({ name: 'Pat P', pronouns: 'she/her', schoolId: P_TEAM });
        expect(sheet.scoringCategories['wcat__wp'].categoryAssignments[0]).toEqual(expect.objectContaining({
            side: 'P', pStudentId: 'stu-p', dStudentId: null,
        }));
        expect(sheet.scoringCategories['wcat__wp'].categoryAssignments[1]).toEqual(expect.objectContaining({
            side: 'D', pStudentId: null, dStudentId: 'stu-d',
        }));
        expect(sheet.scoringCategories['wcat__wd'].categoryAssignments[0].side).toBe('D');
        expect(sheet.scoringCategories['wcat__wd'].categoryAssignments[1].side).toBe('P');
        expect(sheet.awardCategories.award1.eligibleStudentIds).toEqual(['stu-p']);
    });

    it('falls back to configured witness lists when no explicit call order exists', async () => {
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ p_team: P_TEAM, d_team: D_TEAM, courtroom_name: 'C', tournament_id: TOURNAMENT, locked: true }],
            rowCount: 1,
        } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

        queueBuildQueries({
            tournament: {
                tournament_name: 'T', case_name: 'C', criminal_case: false,
                p_witnesses_called: 1, d_witnesses_called: 1, has_swing: true, format_id: 'fmt',
            },
            categories: [{ id: 'wcat', name: 'Witness', witness_category: true, position: 1 }],
            fields: [{
                id: 'f', category_id: 'wcat', label: 'Performance', min_score: 1, max_score: 10,
                multiplier: 1, assignable: false, prosecution: true, defense: true,
                calling: false, crossing: false, visible_to_scorers: true, position: 1,
                award_category_id: null,
            }],
            witnesses: [
                { id: 'p1', name: 'P1', side: 'P' },
                { id: 'p2', name: 'P2', side: 'P' },
                { id: 'd1', name: 'D1', side: 'D' },
                { id: 'd2', name: 'D2', side: 'D' },
                { id: 's1', name: 'Swing', side: 'S' },
            ],
        });

        const sheet = await getPairingBallotFormat(PAIRING);
        expect(sheet.categoryOrder).toEqual(['wcat__p1', 'wcat__s1', 'wcat__d1']);
    });

    it('throws Tournament not found from the shared builder', async () => {
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ p_team: P_TEAM, d_team: D_TEAM, courtroom_name: null, tournament_id: TOURNAMENT, locked: true }],
            rowCount: 1,
        } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        queueBuildQueries({ tournament: null });

        await expect(getPairingBallotFormat(PAIRING)).rejects.toBeInstanceOf(NotFoundError);
    });
});

describe('getSheetFromBallot', () => {
    it('throws NotFoundError when the ballot does not exist', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        await expect(getSheetFromBallot(BALLOT)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws ConflictReportedError unless guards are skipped', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [baseSheetRow({ conflict_reported: true })], rowCount: 1 } as any);
        await expect(getSheetFromBallot(BALLOT)).rejects.toBeInstanceOf(ConflictReportedError);
    });

    it('builds a paper-scored presider ballot when guards are skipped', async () => {
        mockDbQuery.mockResolvedValueOnce({
            rows: [baseSheetRow({
                conflict_reported: true,
                paper_scorer_id: 'paper-1',
                paper_scorer_name: 'Paper Pat',
                presider_scorer_assignment_id: ASSIGNMENT,
                show_scores: false,
                presider_paper_name: 'Paper Pat',
            })],
            rowCount: 1,
        } as any);
        queueBuildQueries();

        const sheet = await getSheetFromBallot(BALLOT, { skipGuards: true });
        expect(sheet.scorer).toEqual({ firstName: 'Paper Pat', lastName: '', scorerID: ASSIGNMENT, isPaper: true });
        expect(sheet.presiderName).toBe('Paper Pat');
        expect(sheet.ballotOptions).toEqual({ fillableScores: false, showTiebreaker: true });
    });
});

describe('getSheetFromAssignment', () => {
    it('throws NotFoundError for a missing assignment', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        await expect(getSheetFromAssignment(ASSIGNMENT)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws ConflictReportedError before checking for an existing ballot', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [baseSheetRow({ conflict_reported: true })], rowCount: 1 } as any);
        await expect(getSheetFromAssignment(ASSIGNMENT)).rejects.toBeInstanceOf(ConflictReportedError);
        expect(mockDbQuery).toHaveBeenCalledTimes(1);
    });

    it('throws AlreadySubmittedError when the assignment already has a ballot', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [baseSheetRow()], rowCount: 1 } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ ballot_id: BALLOT }], rowCount: 1 } as any);
        await expect(getSheetFromAssignment(ASSIGNMENT)).rejects.toBeInstanceOf(AlreadySubmittedError);
    });

    it('builds the sheet and derives registered scorer/presider names', async () => {
        mockDbQuery.mockResolvedValueOnce({
            rows: [baseSheetRow({
                presider_scorer_assignment_id: ASSIGNMENT,
                show_scores: true,
                presider_first_name: 'Alex',
                presider_last_name: 'Presider',
            })],
            rowCount: 1,
        } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        queueBuildQueries();

        const sheet = await getSheetFromAssignment(ASSIGNMENT);
        expect(sheet.scorer.firstName).toBe('Jane');
        expect(sheet.scorer.lastName).toBe('Judge');
        expect(sheet.presiderName).toBe('Alex Presider');
        expect(sheet.ballotOptions).toEqual({ fillableScores: true, showTiebreaker: true });
    });

    it('skipGuards avoids both conflict and existing-ballot guards', async () => {
        mockDbQuery.mockResolvedValueOnce({
            rows: [baseSheetRow({ conflict_reported: true, presider_scorer_assignment_id: null })],
            rowCount: 1,
        } as any);
        queueBuildQueries();

        const sheet = await getSheetFromAssignment(ASSIGNMENT, { skipGuards: true });
        expect(sheet.ballotOptions).toEqual({ fillableScores: true, showTiebreaker: false });
    });
});

describe('submitBallot', () => {
    it('throws NotFoundError when the assignment cannot be resolved', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        await expect(submitBallot(ASSIGNMENT, samplePayload())).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws RoundNotLockedError before loading multipliers', async () => {
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ pairing_id: PAIRING, tournament_id: TOURNAMENT, p_team: P_TEAM, d_team: D_TEAM, is_presider: false, locked: false }],
            rowCount: 1,
        } as any);

        await expect(submitBallot(ASSIGNMENT, samplePayload())).rejects.toBeInstanceOf(RoundNotLockedError);
        expect(mockDbQuery).toHaveBeenCalledTimes(1);
        expect(mockWithTransaction).not.toHaveBeenCalled();
    });

    it('stores weighted totals and null tiebreaker for a non-presider ballot', async () => {
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ pairing_id: PAIRING, tournament_id: TOURNAMENT, p_team: P_TEAM, d_team: D_TEAM, is_presider: false, locked: true }],
            rowCount: 1,
        } as any);
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ id: 'field-p', multiplier: 2 }, { id: 'field-d', multiplier: 3 }],
            rowCount: 2,
        } as any);
        mockClient.query.mockResolvedValueOnce({ rows: [{ ballot_id: BALLOT }], rowCount: 1 } as any);

        const payload = samplePayload();
        await submitBallot(ASSIGNMENT, payload);

        expect(mockClient.query).toHaveBeenCalledTimes(1);
        const insertArgs = mockClient.query.mock.calls[0][1] as unknown[];
        expect(insertArgs[6]).toBe(16);
        expect(insertArgs[7]).toBe(21);
        expect(insertArgs[8]).toBeNull();
        expect(insertArgs[9]).toBe(false);
        expect(insertArgs[3]).toBe(JSON.stringify(payload));
    });

    it('stores the tiebreaker and nominations for a presider ballot', async () => {
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ pairing_id: PAIRING, tournament_id: TOURNAMENT, p_team: P_TEAM, d_team: D_TEAM, is_presider: true, locked: true }],
            rowCount: 1,
        } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        mockClient.query
            .mockResolvedValueOnce({ rows: [{ ballot_id: BALLOT }], rowCount: 1 } as any)
            .mockResolvedValue({ rows: [], rowCount: 1 } as any);

        const payload = samplePayload({
            nominations: [
                { awardCategoryId: 'award1', studentId: 'stu1', rank: 1 },
                { awardCategoryId: 'award1', studentId: 'stu2', rank: 2 },
            ],
        });
        await submitBallot(ASSIGNMENT, payload);

        const insertArgs = mockClient.query.mock.calls[0][1] as unknown[];
        expect(insertArgs[8]).toBe(TIEBREAKER);
        expect(insertArgs[9]).toBe(true);
        expect(mockClient.query).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('INSERT INTO nominations'),
            [BALLOT, 'award1', 'stu1', 1],
        );
        expect(mockClient.query).toHaveBeenNthCalledWith(
            3,
            expect.stringContaining('INSERT INTO nominations'),
            [BALLOT, 'award1', 'stu2', 2],
        );
    });

    it('throws DbError when INSERT RETURNING does not yield a ballot id', async () => {
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ pairing_id: PAIRING, tournament_id: TOURNAMENT, p_team: P_TEAM, d_team: D_TEAM, is_presider: false, locked: true }],
            rowCount: 1,
        } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

        await expect(submitBallot(ASSIGNMENT, samplePayload())).rejects.toBeInstanceOf(DbError);
    });

    it('propagates transaction query errors', async () => {
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ pairing_id: PAIRING, tournament_id: TOURNAMENT, p_team: P_TEAM, d_team: D_TEAM, is_presider: true, locked: true }],
            rowCount: 1,
        } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        const pgError = Object.assign(new Error('duplicate'), { code: '23505' });
        mockClient.query.mockRejectedValueOnce(pgError);

        await expect(submitBallot(ASSIGNMENT, samplePayload())).rejects.toBe(pgError);
    });
});

describe('getConflictReportContext', () => {
    it('returns null when the conditional update itself fails', async () => {
        mockDbQuery.mockResolvedValueOnce(undefined as any);
        await expect(getConflictReportContext(ASSIGNMENT)).resolves.toBeNull();
    });

    it('returns already_reported when no update occurs but the assignment exists', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [{ assignment_id: ASSIGNMENT }], rowCount: 1 } as any);
        await expect(getConflictReportContext(ASSIGNMENT)).resolves.toBe('already_reported');
    });

    it('returns null when no update occurs and the assignment does not exist', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        await expect(getConflictReportContext(ASSIGNMENT)).resolves.toBeNull();
    });

    it('returns null when the flag is set but context lookup finds no row', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        await expect(getConflictReportContext(ASSIGNMENT)).resolves.toBeNull();
    });

    it('returns registered scorer context', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        mockDbQuery.mockResolvedValueOnce({
            rows: [{
                scorer_first_name: 'Jane', scorer_last_name: 'Judge', paper_name: null,
                tournament_name: 'State', round_name: 'Round 1', courtroom_name: '101',
                owner_email: 'owner@example.com', owner_first_name: 'Alex',
            }],
            rowCount: 1,
        } as any);

        await expect(getConflictReportContext(ASSIGNMENT)).resolves.toEqual({
            scorerName: 'Jane Judge',
            tournamentName: 'State',
            roundName: 'Round 1',
            courtroomName: '101',
            ownerEmail: 'owner@example.com',
            ownerFirstName: 'Alex',
        });
    });

    it('prefers the paper scorer name', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        mockDbQuery.mockResolvedValueOnce({
            rows: [{
                scorer_first_name: '', scorer_last_name: '', paper_name: 'Paper Pat',
                tournament_name: 'State', round_name: null, courtroom_name: null,
                owner_email: 'owner@example.com', owner_first_name: 'Alex',
            }],
            rowCount: 1,
        } as any);

        const result = await getConflictReportContext(ASSIGNMENT);
        expect(result).toEqual(expect.objectContaining({ scorerName: 'Paper Pat', roundName: null, courtroomName: null }));
    });
});

describe('getBallot', () => {
    it('returns the ballot row when found', async () => {
        const row = { ballot_id: BALLOT, ballot_json: { scores: [] } };
        mockDbQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);
        await expect(getBallot(BALLOT)).resolves.toBe(row);
        expect(mockDbQuery).toHaveBeenCalledWith('SELECT * FROM ballots WHERE ballot_id = $1', [BALLOT]);
    });

    it('returns null when no ballot is found', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        await expect(getBallot(BALLOT)).resolves.toBeNull();
    });
});

describe('submitNominations', () => {
    const nominations = [
        { awardCategoryId: 'award1', studentId: 'stu1', rank: 1 },
        { awardCategoryId: 'award1', studentId: 'stu2', rank: 2 },
    ];

    it('throws NotFoundError when scores have not been submitted', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
        await expect(submitNominations(ASSIGNMENT, nominations)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('updates an object ballot payload and handles an empty nomination list', async () => {
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ ballot_id: BALLOT, ballot_json: { pairingID: PAIRING, scores: [], nominations: [{ old: true }] } }],
            rowCount: 1,
        } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

        await submitNominations(ASSIGNMENT, []);

        const updateArgs = mockDbQuery.mock.calls[1][1] as unknown[];
        expect(JSON.parse(updateArgs[0] as string).nominations).toEqual([]);
        expect(mockDbQuery).toHaveBeenCalledTimes(3);
        expect(mockDbQuery.mock.calls[2][0]).toMatch(/DELETE FROM nominations/i);
    });

    it('parses string ballot_json and replaces structured nominations', async () => {
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ ballot_id: BALLOT, ballot_json: JSON.stringify({ pairingID: PAIRING, scores: [] }) }],
            rowCount: 1,
        } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
        mockDbQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

        await submitNominations(ASSIGNMENT, nominations);

        expect(mockDbQuery).toHaveBeenCalledTimes(5);
        expect(mockDbQuery).toHaveBeenNthCalledWith(
            4,
            expect.stringContaining('INSERT INTO nominations'),
            [BALLOT, 'award1', 'stu1', 1],
        );
        expect(mockDbQuery).toHaveBeenNthCalledWith(
            5,
            expect.stringContaining('INSERT INTO nominations'),
            [BALLOT, 'award1', 'stu2', 2],
        );
    });

    it('throws DbError when updating ballot_json fails', async () => {
        mockDbQuery.mockResolvedValueOnce({
            rows: [{ ballot_id: BALLOT, ballot_json: { pairingID: PAIRING, scores: [] } }],
            rowCount: 1,
        } as any);
        mockDbQuery.mockResolvedValueOnce(undefined as any);

        await expect(submitNominations(ASSIGNMENT, nominations)).rejects.toBeInstanceOf(DbError);
        expect(mockDbQuery).toHaveBeenCalledTimes(2);
    });
});
