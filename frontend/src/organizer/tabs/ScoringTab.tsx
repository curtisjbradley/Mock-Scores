import { useCallback, useEffect, useState } from 'react'
import { fetchScoringCategories, saveScoringCategories, fetchFormat } from '../hooks/useTournamentData'
import type { ScoringCategory, CaseFormatState } from '../types/tournament'
import { emptyCaseFormat } from '../types/tournament'
import TournamentScoringFields from '../steps/TournamentScoringFields'
import Section from './Section'
import '../styles/scoring-fields.css'
import { apiFetch } from '../../auth/auth'
import type { IIndividualAwardCategory } from '@mock-scores/shared'

export default function ScoringTab({ tournamentId }: { tournamentId: string }) {
    const [categories, setCategories] = useState<ScoringCategory[]>([])
    const [caseFormat, setCaseFormat] = useState<CaseFormatState>(emptyCaseFormat)
    const [awardCategories, setAwardCategories] = useState<IIndividualAwardCategory[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)

    const loadAwardCategories = useCallback(() => {
        apiFetch(`/organizer/tournament/${tournamentId}/award-categories`)
            .then(r => r.json())
            .then(setAwardCategories)
            .catch(() => {})
    }, [tournamentId])

    useEffect(() => {
        Promise.all([
            fetchScoringCategories(tournamentId),
            fetchFormat(tournamentId),
            apiFetch(`/organizer/tournament/${tournamentId}/award-categories`).then(r => r.json()),
        ]).then(([cats, fmt, awards]) => {
            setCategories(cats)
            setCaseFormat(fmt)
            setAwardCategories(awards)
            setLoading(false)
        }).catch(() => { setLoading(false); setError('Failed to load scoring data.') })
    }, [tournamentId])

    // Refetch award categories whenever this tab becomes visible (un-hidden)
    useEffect(() => {
        const observer = new MutationObserver(() => {
            const el = document.getElementById('scoring-tab-root')
            if (el && !el.closest('[hidden]')) {
                loadAwardCategories()
            }
        })
        const parent = document.getElementById('scoring-tab-root')?.parentElement
        if (parent) {
            observer.observe(parent, { attributes: true, attributeFilter: ['hidden'] })
        }
        return () => observer.disconnect()
    }, [loadAwardCategories])

    const handleSave = async () => {
        setSaving(true)
        setSaveError(null)
        try { await saveScoringCategories(tournamentId, categories) }
        catch (e: unknown) { setSaveError(e instanceof Error ? e.message : 'Failed to save') }
        finally { setSaving(false) }
    }

    if (loading) return <p className="dash-saving">Loading…</p>

    return (
        <div id="scoring-tab-root">
            <Section title="Scoring fields">
                {(error || saveError) && <div className="tc-error-banner">{error ?? saveError}</div>}
                <TournamentScoringFields
                    categories={categories}
                    onChange={setCategories}
                    caseFormat={caseFormat}
                    onSubmit={handleSave}
                    isEditing
                    awardCategories={awardCategories}
                />
                {saving && <p className="dash-saving">Saving…</p>}
            </Section>
        </div>
    )
}
