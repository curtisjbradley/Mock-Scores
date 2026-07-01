import { apiFetch } from '../../auth/auth'
import { defaultWitnessCategory } from '../types/tournament'
import type { TournamentInfo, CaseFormatState, ScoringCategory } from '../types/tournament'
import type { TournamentPayload, ITournamentDetails, IWitnesses, IScoringCategory, IStandingsTemplate } from '@mock-scores/shared'
// ── Format ────────────────────────────────────────────────────────────────────

/** Fetches the case format for a tournament from the API. */
export async function fetchFormat(tournamentId: string): Promise<CaseFormatState> {
    const r = await apiFetch(`/api/organizer/tournament/${tournamentId}/format`)
    if (!r.ok) throw new Error('Failed to load format.')
    const data: ITournamentDetails & { has_swing: boolean } = await r.json()
    return {
        caseName: data.case_name,
        criminalCase: data.criminal_case,
        pWitnessesCalled: data.p_witnesses_called ?? '',
        dWitnessesCalled: data.d_witnesses_called ?? '',
        hasSwing: data.has_swing,
        pWitnessNames: [],
        dWitnessNames: [],
        swingWitnessNames: [''],
    }
}

/** Persists the case format for a tournament. Throws on a non-OK response. */
export async function saveFormat(tournamentId: string, cf: CaseFormatState): Promise<void> {
    const payload: TournamentPayload['caseFormat'] = {
        caseName: cf.caseName, criminalCase: cf.criminalCase,
        pWitnessesCalled: cf.pWitnessesCalled === '' ? null : cf.pWitnessesCalled as number,
        dWitnessesCalled: cf.dWitnessesCalled === '' ? null : cf.dWitnessesCalled as number,
        hasSwing: cf.hasSwing,
        pWitnessNames: [], dWitnessNames: [], swingWitnessNames: [],
    }
    const r = await apiFetch(`/api/organizer/tournament/${tournamentId}/format`, { method: 'PATCH', body: JSON.stringify(payload) })
    if (!r.ok) throw new Error(r.statusText)
}

// ── Witnesses ─────────────────────────────────────────────────────────────────

/** Fetches prosecution/defense/swing witness definitions for a tournament. */
export async function fetchWitnesses(tournamentId: string): Promise<IWitnesses> {
    const r = await apiFetch(`/api/organizer/tournament/${tournamentId}/witnesses`)
    if (!r.ok) throw new Error('Failed to load witnesses.')
    return r.json()
}

/** Persists witness names and counts for a tournament. Throws on non-OK. */
export async function saveWitnesses(tournamentId: string, witnesses: IWitnesses): Promise<void> {
    const r = await apiFetch(`/api/organizer/tournament/${tournamentId}/witnesses`, { method: 'PATCH', body: JSON.stringify(witnesses) })
    if (!r.ok) throw new Error(r.statusText)
}

// ── Scoring categories ────────────────────────────────────────────────────────

/** Fetches scoring categories (fields, witness assignments) for a tournament. */
export async function fetchScoringCategories(tournamentId: string): Promise<ScoringCategory[]> {
    const r = await apiFetch(`/api/organizer/tournament/${tournamentId}/scoring-categories`)
    if (!r.ok) throw new Error('Failed to load scoring categories.')
    const data: IScoringCategory[] = await r.json()
    return data.length ? data.map(c => ({ ...c })) : [defaultWitnessCategory()]
}

/** Persists the scoring category/field configuration for a tournament. */
export async function saveScoringCategories(tournamentId: string, cats: ScoringCategory[]): Promise<void> {
    const payload: TournamentPayload['scoringCategories'] = cats.map((cat, catPos) => ({
        name: cat.name, witnessCategory: !!cat.witnessCategory, position: catPos,
        fields: cat.fields.map((f, fPos) => ({
            label: f.label, min: f.min, max: f.max, multiplier: f.multiplier,
            assignable: f.assignable, eligibleForAward: f.eligibleForAward,
            visibleToScorers: f.visibleToScorers, prosecution: f.prosecution,
            defense: f.defense, calling: f.calling, crossing: f.crossing, position: fPos,
        })),
    }))
    const r = await apiFetch(`/api/organizer/tournament/${tournamentId}/scoring-categories`, { method: 'PATCH', body: JSON.stringify(payload) })
    if (!r.ok) throw new Error(r.statusText)
}

// ── Standings config ──────────────────────────────────────────────────────────

/** Fetches built-in standings configuration templates. */
export async function fetchStandingsTemplates(): Promise<IStandingsTemplate[]> {
    const r = await apiFetch('/api/organizer/tournament/standings-templates')
    if (!r.ok) throw new Error('Failed to load standings templates.')
    return r.json()
}

/** Fetches the Blockly standings configuration (statsXml + standingsXml) for a tournament. */
export async function fetchStandingsConfig(tournamentId: string): Promise<{ id: string; statsXml: string; standingsXml: string } | null> {
    const r = await apiFetch(`/api/organizer/tournament/${tournamentId}/standings-config`)
    if (!r.ok) throw new Error('Failed to load standings config.')
    return r.json()
}

/** Persists the Blockly standings XML configuration for a tournament. */
export async function saveStandingsConfig(tournamentId: string, config: { statsXml: string; standingsXml: string }): Promise<void> {
    const r = await apiFetch(`/api/organizer/tournament/${tournamentId}/standings-config`, { method: 'PATCH', body: JSON.stringify(config) })
    if (!r.ok) throw new Error(r.statusText)
}

// ── Tournament info (name/location/dates) ─────────────────────────────────────

/** Persists the tournament name, location, and date fields. */
export async function saveTournamentInfo(tournamentId: string, info: TournamentInfo): Promise<void> {
    const payload: TournamentPayload['tournament'] = {
        name: info.name, location: info.location,
        startDate: info.startTbd ? null : info.startDate,
        endDate: info.endTbd ? null : info.endDate,
        startTbd: info.startTbd, endTbd: info.endTbd,
    }
    const r = await apiFetch(`/api/organizer/tournament/${tournamentId}`, { method: 'PATCH', body: JSON.stringify({ tournament: payload }) })
    if (!r.ok) throw new Error(r.statusText)
}
