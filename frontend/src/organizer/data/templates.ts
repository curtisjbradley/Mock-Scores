export interface ScoringFieldDef {
    label: string
    min: number
    max: number
    multiplier: number
    assignable: boolean
    eligibleForAward: boolean
    prosecution: boolean
    defense: boolean
    calling: boolean
    crossing: boolean
}

export interface ScoringCategoryDef {
    name: string
    fields: ScoringFieldDef[]
    witnessCategory?: boolean
}

export interface Template {
    id: string
    label: string
    scoringCategories?: ScoringCategoryDef[]
}

const f = (
    label: string,
    opts: Partial<ScoringFieldDef> = {}
): ScoringFieldDef => ({
    label,
    min: 0, max: 10, multiplier: 1,
    assignable: true, eligibleForAward: true,
    prosecution: false, defense: false,
    calling: false, crossing: false,
    ...opts,
})




const defaultCategories: ScoringCategoryDef[] = [
    {
        name: 'Pretrial',
        fields: [
            f('Pretrial D', { defense: true, multiplier: 2 }),
            f('Pretrial P', { prosecution: true, multiplier: 2 }),
        ],
    },
    {
        name: 'Opening',
        fields: [
            f('Opening Statement', { prosecution: true,defense: true }),
        ],
    },
    {
        name: 'Witnesses',
        witnessCategory: true,
        fields: [
            f('Attorney Direct Examination', { calling: true }),
            f('Attorney Cross Examination', { crossing: true }),
            f('Witness Examination Performance', { calling: true }),
        ],
    },
    {
        name: 'Closing',
        fields: [
            f('Closing', { prosecution: true, defense:true, multiplier: 2 }),
        ],
    },
    {
        name: 'Clerk / Bailiff',
        fields: [
            f('Clerk', { max: 5, prosecution: true, eligibleForAward: false }),
            f('Bailiff', {max: 5, defense: true, eligibleForAward: false }),
        ],
    },
    {
        name: 'Team Score',
        fields: [
            f('Team / Participation', { prosecution: true, defense: true, assignable: false, eligibleForAward: false }),
        ],
    },
    {
        name: 'Point Deductions',
        fields: [
            f('Deductions', { multiplier: 1, min:-100, max: 0, prosecution: true, defense: true, assignable: false, eligibleForAward: false }),
        ],
    },
]

const sloCategories: ScoringCategoryDef[] = [
    {
        name: 'Pretrial',
        fields: [
            f('Pretrial D', { defense: true, multiplier: 2 }),
            f('Pretrial P', { prosecution: true, multiplier: 2 }),
        ],
    },
    {
        name: 'Opening',
        fields: [
            f('Opening Statement', { prosecution: true, defense: true }),
        ],
    },
    {
        name: 'Witnesses',
        witnessCategory: true,
        fields: [
            f('Attorney Direct Examination', { calling: true }),
            f('Attorney Cross Examination', { crossing: true }),
            f('Witness Examination Performance', { calling: true }),
        ],
    },
    {
        name: 'Closing',
        fields: [
            f('Closing', { prosecution: true, defense: true, multiplier: 2 }),
        ],
    },
    {
        name: 'Clerk / Bailiff',
        fields: [
            f('Clerk', { prosecution: true }),
            f('Bailiff', { defense: true }),
        ],
    },
    {
        name: 'Team Score',
        fields: [
            f('Team / Participation', { prosecution: true, defense: true, assignable: false, eligibleForAward: false }),
        ],
    },
]


export const templates: Template[] = [
    {
        id: 'teach-democracy',
        label: 'Teach Democracy Default',
        scoringCategories: defaultCategories,
    },
    {
        id: 'slo-county',
        label: 'SLO County',
        scoringCategories: sloCategories,
    },
    {
        id: 'manual',
        label: 'Manual',
    },
]

export const getTemplate = (id: string): Template =>
    templates.find(t => t.id === id) ?? templates.find(t => t.id === 'manual')!

