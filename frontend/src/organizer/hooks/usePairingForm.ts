import { useState } from 'react'
import type { IPairing } from '@mock-scores/shared'

interface PairingFormState {
    /** Whether the add-matchup form is currently visible */
    showAddForm: boolean
    /** Selected prosecution team ID */
    addPros: string
    /** Selected defense team ID */
    addDef: string
    /** Selected courtroom ID */
    addCourtroom: string
    /** True after the first submit attempt; gates error message visibility */
    addSubmitted: boolean
}

interface PairingFormErrors {
    prosError: string
    defError: string
    courtroomError: string
}

/**
 * Pure validation function — derives per-field error messages from the
 * current form state. Separated from the hook so it is independently
 * testable and to keep the hook body under the cyclomatic threshold.
 *
 * @param state  - Current form field values and submission flag
 * @param pairings - Existing pairings; used to detect duplicate team assignments
 */
function computePairingErrors(
    state: Pick<PairingFormState, 'addSubmitted' | 'addPros' | 'addDef' | 'addCourtroom'>,
    pairings: IPairing[],
): PairingFormErrors {
    const { addSubmitted, addPros, addDef, addCourtroom } = state

    if (!addSubmitted) return { prosError: '', defError: '', courtroomError: '' }

    const prosAlreadyPros = !!addPros && pairings.some(p => p.p_team === addPros)
    const defAlreadyDef   = !!addDef   && pairings.some(p => p.d_team === addDef)

    const prosError =
        !addPros           ? 'Select prosecution team' :
        prosAlreadyPros    ? 'Team already prosecuting this round' : ''

    const defError =
        !addDef            ? 'Select defense team' :
        addDef === addPros  ? 'Must differ from prosecution' :
        defAlreadyDef      ? 'Team already defending this round' : ''

    const courtroomError = !addCourtroom ? 'Select a courtroom' : ''

    return { prosError, defError, courtroomError }
}

/**
 * Manages the "Add matchup" form state inside RoundView.
 *
 * Encapsulates all field state, validation errors, and reset logic so that
 * RoundView only needs to call `handleAddMatchup` with the derived values
 * from this hook.
 *
 * @param pairings - Current pairings list; used to detect duplicate teams
 */
export function usePairingForm(pairings: IPairing[]) {
    const [state, setState] = useState<PairingFormState>({
        showAddForm: false,
        addPros: '',
        addDef: '',
        addCourtroom: '',
        addSubmitted: false,
    })

    const { showAddForm, addPros, addDef, addCourtroom, addSubmitted } = state
    const errors = computePairingErrors(state, pairings)

    return {
        showAddForm, addPros, addDef, addCourtroom, addSubmitted, errors,
        toggleForm:      () => setState(s => ({ ...s, showAddForm: !s.showAddForm, addSubmitted: false })),
        setAddPros:      (v: string) => setState(s => ({ ...s, addPros: v })),
        setAddDef:       (v: string) => setState(s => ({ ...s, addDef: v })),
        setAddCourtroom: (v: string) => setState(s => ({ ...s, addCourtroom: v })),
        reset:  () => setState({ showAddForm: false, addPros: '', addDef: '', addCourtroom: '', addSubmitted: false }),
        submit: () => setState(s => ({ ...s, addSubmitted: true })),
    }
}
