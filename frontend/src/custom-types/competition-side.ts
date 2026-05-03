export const CompetitionSide = {
    PROSECUTION : 0,
    DEFENSE :1,
    BOTH : 2
} as const

export type TCompetitionSide = typeof CompetitionSide[keyof typeof CompetitionSide];

