export interface TournamentInfo {
    name: string
    location: string
    startDate: string
    endDate: string
    startTbd: boolean
    endTbd: boolean
}

export interface CaseFormatState {
    caseName: string
    criminalCase: boolean
    pWitnessNames: string[]
    pWitnessesCalled: number | ''
    dWitnessNames: string[]
    dWitnessesCalled: number | ''
    hasSwing: boolean
    swingWitnessNames: string[]
}

export interface ScoringField {
    id: string
    label: string
    min: number
    max: number
    multiplier: number
    assignable: boolean
    eligibleForAward: boolean
    awardCategoryId: string | null
    visibleToScorers: boolean
    prosecution: boolean
    defense: boolean
    calling: boolean
    crossing: boolean
}

export interface ScoringCategory {
    id: string
    name: string
    fields: ScoringField[]
    witnessCategory?: boolean
}

export const emptyInfo: TournamentInfo = {
    name: '', location: '', startDate: '', endDate: '',
    startTbd: false, endTbd: false,
}

export const emptyCaseFormat: CaseFormatState = {
    caseName: '',
    criminalCase: true,
    pWitnessNames: [],
    pWitnessesCalled: '',
    dWitnessNames: [],
    dWitnessesCalled: '',
    hasSwing: false,
    swingWitnessNames: [''],
}

let _seq = 0
const uid = () => `sf${_seq++}`

export function makeField(label = ''): ScoringField {
    return { id: uid(), label, min: 0, max: 10, multiplier: 1, assignable: true, eligibleForAward: false, awardCategoryId: null, visibleToScorers: true, prosecution: false, defense: false, calling: false, crossing: false }
}

export function makeCategory(name = ''): ScoringCategory {
    return { id: uid(), name, fields: [makeField()] }
}

export const defaultWitnessCategory = (): ScoringCategory => ({
    id: uid(), name: 'Witnesses', witnessCategory: true, fields: [],
})
