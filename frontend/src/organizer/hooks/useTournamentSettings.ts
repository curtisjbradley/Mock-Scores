import { useEffect, useState } from 'react'
import { fetchFormat, saveTournamentInfo, saveFormat } from './useTournamentData'
import type { TournamentInfo, CaseFormatState } from '../types/tournament'
import { emptyCaseFormat } from '../types/tournament'
import type { ITournament, IOrganizer } from '@mock-scores/shared'
import { apiFetch, getSession } from '../../auth/auth'

export interface TournamentSettingsState {
    info: TournamentInfo
    caseFormat: CaseFormatState
    loading: boolean
    loadError: string | null
    saving: boolean
    saveError: string | null
    saveSuccess: boolean
    submitted: boolean
    isOwner: boolean
    setInfo: (info: TournamentInfo) => void
    setCaseFormat: (cf: CaseFormatState) => void
    setSubmitted: (v: boolean) => void
    setSaveError: (e: string | null) => void
    handleSave: (e: React.FormEvent) => Promise<void>
}

const emptyInfo: TournamentInfo = {
    name: '', location: '', startDate: '', endDate: '',
    startTbd: false, endTbd: false,
}

/**
 * Loads and manages tournament settings state for `TournamentSettingsTab`.
 *
 * Extracted to bring the tab component below the React hook-count and
 * cognitive complexity thresholds (previously 10 useState calls inline).
 *
 * @param tournamentId - Tournament UUID from the route
 * @param getErrors - Validation function; save is blocked when any error is truthy
 */
export function useTournamentSettings(
    tournamentId: string,
    getErrors: (info: TournamentInfo, cf: CaseFormatState) => Record<string, string>,
): TournamentSettingsState {
    const [info, setInfo] = useState<TournamentInfo>(emptyInfo)
    const [caseFormat, setCaseFormat] = useState<CaseFormatState>(emptyCaseFormat)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [isOwner, setIsOwner] = useState(false)

    useEffect(() => {
        Promise.all([
            apiFetch(`/api/organizer/tournament/${tournamentId}`).then(r => r.ok ? r.json() as Promise<ITournament> : Promise.reject()),
            fetchFormat(tournamentId),
            apiFetch(`/api/organizer/tournament/${tournamentId}/organizers`).then(r => r.ok ? r.json() as Promise<IOrganizer[]> : Promise.resolve([])),
            getSession(),
        ]).then(([t, cf, organizers, session]) => {
            setIsOwner(!!session && organizers.some(o => o.email === session.email && o.role === 'owner'))
            setInfo({
                name: t.name, location: t.location,
                startDate: t.start_date ? String(t.start_date).slice(0, 10) : '',
                endDate: t.end_date ? String(t.end_date).slice(0, 10) : '',
                startTbd: !t.start_date, endTbd: !t.end_date,
            })
            setCaseFormat(cf)
            setLoading(false)
        }).catch(() => { setLoading(false); setLoadError('Failed to load tournament data.') })
    }, [tournamentId])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitted(true)
        if (Object.values(getErrors(info, caseFormat)).some(Boolean)) return
        setSaving(true); setSaveError(null); setSaveSuccess(false)
        try {
            await Promise.all([saveTournamentInfo(tournamentId, info), saveFormat(tournamentId, caseFormat)])
            setSaveSuccess(true)
        } catch (err: unknown) {
            setSaveError(err instanceof Error ? err.message : 'Failed to save')
        } finally {
            setSaving(false)
        }
    }

    return {
        info, caseFormat, loading, loadError: loadError,
        saving, saveError, saveSuccess, submitted, isOwner,
        setInfo, setCaseFormat, setSubmitted, setSaveError,
        handleSave,
    }
}
