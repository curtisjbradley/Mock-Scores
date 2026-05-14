export interface ITournament {
    id: string
    name: string
    dates: string[]
    location: string
    rounds: number
    teams: number
    status: 'upcoming' | 'active' | 'completed'
}

export interface ISchool {
    id: string
    name: string
    contactEmail: string
}

export type InviteStatus = 'pending' | 'accepted'

export interface IInvite {
    id: string
    tournamentId: string
    schoolId: string
    status: InviteStatus
    contactEmail?: string
}

export interface ITeam {
    id: string
    tournamentId: string
    code: string
    school: string
    wins: number
    losses: number
    pointsFor: number
    pointsAgainst: number
}

export interface ICourtroom {
    id: string
    tournamentId: string
    name: string
    details?: string
}

export type ScoresheetStatus = 'pending' | 'submitted' | 'missing'

export interface IScoresheet {
    judgeId: string
    judgeName: string
    status: ScoresheetStatus
    assignedScorerId?: string
    assignedScorerName?: string
    isPresider?: boolean
    presiderScores?: boolean
    prosecutionScore?: number
    defenseScore?: number
}

export interface IPairing {
    id: string
    tournamentId: string
    round: number
    date: string
    time?: string
    courtroom: string
    prosecutionTeamId: string
    defenseTeamId: string
    scoresheets: IScoresheet[]
    presiderId?: string
    isPublished?: boolean
    resultsPublished?: boolean
}

export interface IScorer {
    id: string
    name: string
    email?: string
}

export interface IJudge {
    id: string
    name: string
}

// ── Tournaments ──────────────────────────────────────────────────────────────

export const dummyTournaments: ITournament[] = [
    {
        id: 't1',
        name: 'Northern Regional 2026',
        dates: ['2026-03-15', '2026-03-22'],
        location: 'Sacramento, CA',
        rounds: 3,
        teams: 16,
        status: 'completed',
    },
    {
        id: 't2',
        name: 'Bay Area Invitational 2026',
        dates: ['2026-04-20', '2026-04-27', '2026-05-04'],
        location: 'San Francisco, CA',
        rounds: 4,
        teams: 24,
        status: 'active',
    },
    {
        id: 't3',
        name: 'State Championship 2026',
        dates: ['2026-05-10', '2026-05-17', '2026-05-24'],
        location: 'Los Angeles, CA',
        rounds: 5,
        teams: 32,
        status: 'upcoming',
    },
]

// ── Teams (for t2 — active tournament) ──────────────────────────────────────

export const dummyTeams: ITeam[] = [
    { id: 'tm1',  tournamentId: 't2', code: '101', school: 'Lincoln High',       wins: 3, losses: 1, pointsFor: 412, pointsAgainst: 378 },
    { id: 'tm2',  tournamentId: 't2', code: '102', school: 'Washington Academy', wins: 3, losses: 1, pointsFor: 405, pointsAgainst: 390 },
    { id: 'tm3',  tournamentId: 't2', code: '103', school: 'Jefferson Prep',     wins: 2, losses: 2, pointsFor: 388, pointsAgainst: 395 },
    { id: 'tm4',  tournamentId: 't2', code: '104', school: 'Roosevelt High',     wins: 2, losses: 2, pointsFor: 375, pointsAgainst: 382 },
    { id: 'tm5',  tournamentId: 't2', code: '105', school: 'Kennedy Charter',    wins: 1, losses: 3, pointsFor: 360, pointsAgainst: 410 },
    { id: 'tm6',  tournamentId: 't2', code: '106', school: 'Madison Collegiate', wins: 1, losses: 3, pointsFor: 355, pointsAgainst: 420 },
]

// ── Judges ───────────────────────────────────────────────────────────────────

export const dummyJudges: IJudge[] = [
    { id: 'j1', name: 'Hon. Patricia Nguyen' },
    { id: 'j2', name: 'Hon. Marcus Webb' },
    { id: 'j3', name: 'Hon. Sandra Kim' },
    { id: 'j4', name: 'Atty. David Osei' },
    { id: 'j5', name: 'Atty. Rachel Torres' },
    { id: 'j6', name: 'Atty. James Patel' },
]

export const dummyScorers: IScorer[] = [
    { id: 'sc1', name: 'Maria Santos', email: 'maria@example.com' },
    { id: 'sc2', name: 'Thomas Wu', email: 'thomas@example.com' },
    { id: 'sc3', name: 'Jennifer Blake', email: 'jennifer@example.com' },
    { id: 'sc4', name: 'Robert Kim', email: 'robert@example.com' },
]

export const dummyCourtrooms: ICourtroom[] = [
    { id: 'cr1', tournamentId: 't2', name: '1A', details: '1st Floor' },
    { id: 'cr2', tournamentId: 't2', name: '1B', details: '1st Floor' },
    { id: 'cr3', tournamentId: 't2', name: '1C', details: '1st Floor' },
    { id: 'cr4', tournamentId: 't2', name: '2A', details: '2nd Floor' },
    { id: 'cr5', tournamentId: 't2', name: '2B', details: '2nd Floor' },
    { id: 'cr6', tournamentId: 't2', name: '2C', details: '2nd Floor' },
    { id: 'cr7', tournamentId: 't2', name: '3A', details: '3rd Floor' },
    { id: 'cr8', tournamentId: 't2', name: '3B', details: '3rd Floor' },
    { id: 'cr9', tournamentId: 't2', name: '3C', details: '3rd Floor' },
]

// ── Pairings (for t2) ────────────────────────────────────────────────────────

export const dummyPairings: IPairing[] = [
    // Round 1 — 2026-04-20 (all submitted)
    {
        id: 'p1', tournamentId: 't2', round: 1, date: '2026-04-20', time: '09:00', courtroom: '1A',
        prosecutionTeamId: 'tm1', defenseTeamId: 'tm2',
        scoresheets: [
            { judgeId: 'j1', judgeName: 'Hon. Patricia Nguyen', status: 'submitted', prosecutionScore: 187, defenseScore: 174 },
            { judgeId: 'j2', judgeName: 'Hon. Marcus Webb',     status: 'submitted', prosecutionScore: 180, defenseScore: 180 },
            { judgeId: 'j3', judgeName: 'Hon. Sandra Kim',      status: 'submitted', prosecutionScore: 172, defenseScore: 185 },
        ],
    },
    {
        id: 'p2', tournamentId: 't2', round: 1, date: '2026-04-20', time: '09:00', courtroom: '1B',
        prosecutionTeamId: 'tm3', defenseTeamId: 'tm4',
        scoresheets: [
            { judgeId: 'j4', judgeName: 'Atty. David Osei',    status: 'submitted' },
            { judgeId: 'j5', judgeName: 'Atty. Rachel Torres', status: 'submitted' },
            { judgeId: 'j6', judgeName: 'Atty. James Patel',   status: 'submitted' },
        ],
    },
    {
        id: 'p3', tournamentId: 't2', round: 1, date: '2026-04-20', time: '09:00', courtroom: '1C',
        prosecutionTeamId: 'tm5', defenseTeamId: 'tm6',
        scoresheets: [
            { judgeId: 'j1', judgeName: 'Hon. Patricia Nguyen', status: 'submitted', prosecutionScore: 187, defenseScore: 174 },
            { judgeId: 'j4', judgeName: 'Atty. David Osei',     status: 'submitted' },
            { judgeId: 'j5', judgeName: 'Atty. Rachel Torres',  status: 'submitted' },
        ],
    },
    // Round 2 — 2026-04-27 (mixed)
    {
        id: 'p4', tournamentId: 't2', round: 2, date: '2026-04-27', time: '13:00', courtroom: '2A',
        prosecutionTeamId: 'tm1', defenseTeamId: 'tm3',
        scoresheets: [
            { judgeId: 'j2', judgeName: 'Hon. Marcus Webb',    status: 'submitted' },
            { judgeId: 'j3', judgeName: 'Hon. Sandra Kim',     status: 'submitted' },
            { judgeId: 'j6', judgeName: 'Atty. James Patel',   status: 'missing'   },
        ],
    },
    {
        id: 'p5', tournamentId: 't2', round: 2, date: '2026-04-27', time: '13:00', courtroom: '2B',
        prosecutionTeamId: 'tm2', defenseTeamId: 'tm5',
        scoresheets: [
            { judgeId: 'j1', judgeName: 'Hon. Patricia Nguyen', status: 'submitted', prosecutionScore: 187, defenseScore: 174 },
            { judgeId: 'j4', judgeName: 'Atty. David Osei',     status: 'pending'   },
            { judgeId: 'j5', judgeName: 'Atty. Rachel Torres',  status: 'pending'   },
        ],
    },
    {
        id: 'p6', tournamentId: 't2', round: 2, date: '2026-04-27', time: '13:00', courtroom: '2C',
        prosecutionTeamId: 'tm4', defenseTeamId: 'tm6',
        scoresheets: [
            { judgeId: 'j2', judgeName: 'Hon. Marcus Webb',  status: 'submitted' },
            { judgeId: 'j3', judgeName: 'Hon. Sandra Kim',   status: 'submitted' },
            { judgeId: 'j6', judgeName: 'Atty. James Patel', status: 'submitted' },
        ],
    },
    // Round 3 — 2026-05-04 (all pending)
    {
        id: 'p7', tournamentId: 't2', round: 3, date: '2026-05-04', time: '10:30', courtroom: '3A',
        prosecutionTeamId: 'tm2', defenseTeamId: 'tm1',
        scoresheets: [
            { judgeId: 'j3', judgeName: 'Hon. Sandra Kim',     status: 'pending' },
            { judgeId: 'j4', judgeName: 'Atty. David Osei',    status: 'pending' },
            { judgeId: 'j5', judgeName: 'Atty. Rachel Torres', status: 'pending' },
        ],
    },
    {
        id: 'p8', tournamentId: 't2', round: 3, date: '2026-05-04', time: '10:30', courtroom: '3B',
        prosecutionTeamId: 'tm4', defenseTeamId: 'tm3',
        scoresheets: [
            { judgeId: 'j1', judgeName: 'Hon. Patricia Nguyen', status: 'pending' },
            { judgeId: 'j2', judgeName: 'Hon. Marcus Webb',     status: 'pending' },
            { judgeId: 'j6', judgeName: 'Atty. James Patel',    status: 'pending' },
        ],
    },
    {
        id: 'p9', tournamentId: 't2', round: 3, date: '2026-05-04', time: '10:30', courtroom: '3C',
        prosecutionTeamId: 'tm6', defenseTeamId: 'tm5',
        scoresheets: [
            { judgeId: 'j1', judgeName: 'Hon. Patricia Nguyen', status: 'pending' },
            { judgeId: 'j3', judgeName: 'Hon. Sandra Kim',      status: 'pending' },
            { judgeId: 'j5', judgeName: 'Atty. Rachel Torres',  status: 'pending' },
        ],
    },
]

// ── Schools ──────────────────────────────────────────────────────────────────

export const dummySchools: ISchool[] = [
    { id: 's1', name: 'Lincoln High',       contactEmail: 'coach@lincoln.edu' },
    { id: 's2', name: 'Washington Academy', contactEmail: 'coach@washington.edu' },
    { id: 's3', name: 'Jefferson Prep',     contactEmail: 'coach@jefferson.edu' },
    { id: 's4', name: 'Roosevelt High',     contactEmail: 'coach@roosevelt.edu' },
    { id: 's5', name: 'Kennedy Charter',    contactEmail: 'coach@kennedy.edu' },
    { id: 's6', name: 'Madison Collegiate', contactEmail: 'coach@madison.edu' },
    { id: 's7', name: 'Hamilton Academy',   contactEmail: 'coach@hamilton.edu' },
    { id: 's8', name: 'Adams Preparatory',  contactEmail: 'coach@adams.edu' },
]

// ── Invites ──────────────────────────────────────────────────────────────────
// Each invite = one school invited to one tournament.
// The coach's school (s1 = Lincoln High) is invited to t2 and t3.

export const dummyInvites: IInvite[] = [
    // t2 — Bay Area Invitational (active)
    { id: 'i1',  tournamentId: 't2', schoolId: 's1', status: 'accepted' },
    { id: 'i2',  tournamentId: 't2', schoolId: 's2', status: 'accepted' },
    { id: 'i3',  tournamentId: 't2', schoolId: 's3', status: 'accepted' },
    { id: 'i4',  tournamentId: 't2', schoolId: 's4', status: 'accepted' },
    { id: 'i5',  tournamentId: 't2', schoolId: 's5', status: 'accepted' },
    { id: 'i6',  tournamentId: 't2', schoolId: 's6', status: 'accepted' },
    { id: 'i7',  tournamentId: 't2', schoolId: 's7', status: 'pending'  },
    { id: 'i8',  tournamentId: 't2', schoolId: 's8', status: 'pending' },
    // t3 — State Championship (upcoming)
    { id: 'i9',  tournamentId: 't3', schoolId: 's1', status: 'accepted' },
    { id: 'i10', tournamentId: 't3', schoolId: 's2', status: 'pending'  },
    { id: 'i11', tournamentId: 't3', schoolId: 's3', status: 'pending'  },
    { id: 'i12', tournamentId: 't3', schoolId: 's7', status: 'pending'  },
    { id: 'i13', tournamentId: 't3', schoolId: 's8', status: 'pending'  },
]

// The currently logged-in coach's school (placeholder until auth is real)
export const CURRENT_SCHOOL_ID = 's1'

// ── Organizers ───────────────────────────────────────────────────────────────

export interface IOrganizer {
    id: string
    tournamentId: string
    name: string
    email: string
    role: 'owner' | 'co-organizer'
}

export const dummyOrganizers: IOrganizer[] = [
    { id: 'o1', tournamentId: 't2', name: 'Alex Rivera',   email: 'alex@crf.org',   role: 'owner' },
    { id: 'o2', tournamentId: 't2', name: 'Jamie Chen',    email: 'jamie@crf.org',  role: 'co-organizer' },
    { id: 'o3', tournamentId: 't2', name: 'Morgan Davis',  email: 'morgan@crf.org', role: 'co-organizer' },
    { id: 'o4', tournamentId: 't3', name: 'Alex Rivera',   email: 'alex@crf.org',   role: 'owner' },
]
