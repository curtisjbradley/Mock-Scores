// Tournament creation payload (POST /api/tournament)
export interface TournamentPayload {
    tournament: {
        name: string
        location: string
        startDate: string | null
        endDate: string | null
        startTbd: boolean
        endTbd: boolean
    }
    caseFormat: {
        caseName: string
        criminalCase: boolean
        pWitnessesCalled: number | null
        dWitnessesCalled: number | null
        hasSwing: boolean
        pWitnessNames: string[]
        dWitnessNames: string[]
        swingWitnessNames: string[]
    }
    scoringCategories: {
        name: string
        witnessCategory: boolean
        position: number
        fields: {
            label: string
            min: number
            max: number
            multiplier: number
            assignable: boolean
            eligibleForAward: boolean
            visibleToScorers: boolean
            prosecution: boolean
            defense: boolean
            calling: boolean
            crossing: boolean
            position: number
        }[]
    }[]
}

// Scorecard submission payload (POST /api/scoresheets/:trialId)
export interface ScorecardPayload {
    trialID: string
    scorerID: string
    scores: ScoreSection[]
    nominations: {
        studentId: string
        rank: number
    }[]
    tiebreaker?: string
}

export interface ScoreSection {
    categoryId: string
    assignmentKey: string
    side: 'P' | 'D'
    studentId: string | null
    score: number
}