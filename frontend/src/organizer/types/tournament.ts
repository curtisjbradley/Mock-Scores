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

/** Client-side individual award category defined during tournament creation. */
export interface AwardCategory {
    /** Client-side temp id; referenced by ScoringField.awardCategoryId. */
    id: string
    name: string
    minNominees: number
    maxNominees: number
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
    return { id: uid(), label, min: 0, max: 10, multiplier: 1, assignable: true, awardCategoryId: null, visibleToScorers: true, prosecution: false, defense: false, calling: false, crossing: false }
}

export function makeCategory(name = ''): ScoringCategory {
    return { id: uid(), name, fields: [makeField()] }
}

let _acSeq = 0
const acUid = () => `ac${_acSeq++}`

export function makeAwardCategory(name = '', minNominees = 1, maxNominees = 3): AwardCategory {
    return { id: acUid(), name, minNominees, maxNominees }
}

export const defaultWitnessCategory = (): ScoringCategory => ({
    id: uid(), name: 'Witnesses', witnessCategory: true, fields: [],
})
