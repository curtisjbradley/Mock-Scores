import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/organizer.css'
import '../styles/tournament-create.css'
import '../styles/scoring-fields.css'
import type { TournamentPayload, ITournament, IScoringTemplate } from '@mock-scores/shared'
import { emptyInfo, emptyCaseFormat, defaultWitnessCategory } from '../types/tournament'
import type { TournamentInfo, CaseFormatState, ScoringCategory, AwardCategory } from '../types/tournament'
import { fetchScoringTemplates } from '../hooks/useTournamentData'
import TournamentStepper, { type StepperStep } from '../components/TournamentStepper'
import TournamentDetails from '../steps/TournamentDetails'
import TournamentCaseFormat from '../steps/TournamentCaseFormat'
import TournamentScoringTemplate from '../steps/TournamentScoringTemplate'
import TournamentAwards from '../steps/TournamentAwards'
import TournamentScoringFields from '../steps/TournamentScoringFields'
import TournamentStandings from '../steps/TournamentStandings'
import { apiFetch } from '../../auth/auth'
import LoadingPage from '../../layout/LoadingPage.tsx'

type StepKey = 'details' | 'witnesses' | 'template' | 'awards' | 'scoring' | 'tiebreakers'

function buildPayload(
    info: TournamentInfo,
    caseFormat: CaseFormatState,
    manual: boolean,
    categories: ScoringCategory[],
    awardCategories: AwardCategory[],
    scoringTemplateId: string | null,
    standingsConfigId: string | null,
): TournamentPayload {
    const base = {
        tournament: {
            name: info.name,
            location: info.location,
            startDate: info.startTbd ? null : info.startDate,
            endDate: info.endTbd ? null : info.endDate,
            startTbd: info.startTbd,
            endTbd: info.endTbd,
        },
        caseFormat: {
            caseName: caseFormat.caseName,
            criminalCase: caseFormat.criminalCase,
            pWitnessesCalled: caseFormat.pWitnessesCalled === '' ? null : caseFormat.pWitnessesCalled,
            dWitnessesCalled: caseFormat.dWitnessesCalled === '' ? null : caseFormat.dWitnessesCalled,
            hasSwing: caseFormat.hasSwing,
            pWitnessNames: caseFormat.pWitnessNames,
            dWitnessNames: caseFormat.dWitnessNames,
            swingWitnessNames: caseFormat.hasSwing ? caseFormat.swingWitnessNames : [],
        },
        standingsConfigId,
    }

    // Preset branch: send only the template id; the backend copies its contents.
    if (!manual) {
        return { ...base, scoringTemplateId }
    }

    // Manual branch: send the categories + award categories defined in the wizard.
    return {
        ...base,
        scoringTemplateId: null,
        scoringCategories: categories.map((cat, catPos) => ({
            name: cat.name,
            witnessCategory: !!cat.witnessCategory,
            position: catPos,
            fields: cat.fields.map((f, fPos) => ({
                label: f.label,
                min: f.min,
                max: f.max,
                multiplier: f.multiplier,
                assignable: f.assignable,
                // Client tempId; the backend maps it to the created award UUID.
                awardCategoryId: f.awardCategoryId ?? null,
                visibleToScorers: f.visibleToScorers,
                prosecution: f.prosecution,
                defense: f.defense,
                calling: f.calling,
                crossing: f.crossing,
                position: fPos,
            })),
        })),
        awardCategories: awardCategories.map(ac => ({
            tempId: ac.id,
            name: ac.name,
            minNominees: ac.minNominees,
            maxNominees: ac.maxNominees,
        })),
    }
}

export default function TournamentNew() {
    const navigate = useNavigate()
    const [stepIndex, setStepIndex] = useState(0)
    const [info, setInfo] = useState<TournamentInfo>(emptyInfo)
    const [caseFormat, setCaseFormat] = useState<CaseFormatState>(emptyCaseFormat)
    const [templateId, setTemplateId] = useState('manual')
    const [awardCategories, setAwardCategories] = useState<AwardCategory[]>([])
    const [categories, setCategories] = useState<ScoringCategory[]>([defaultWitnessCategory()])
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [templates, setTemplates] = useState<IScoringTemplate[]>([])
    const [templatesLoading, setTemplatesLoading] = useState(true)

    useEffect(() => {
        fetchScoringTemplates()
            .then(setTemplates)
            .catch(() => setTemplates([]))
            .finally(() => setTemplatesLoading(false))
    }, [])

    const manual = templateId === 'manual'

    // The step sequence branches: a preset skips the award + scoring steps.
    const steps: { key: StepKey; label: string }[] = useMemo(() => {
        const base: { key: StepKey; label: string }[] = [
            { key: 'details', label: 'Details' },
            { key: 'witnesses', label: 'Witnesses' },
            { key: 'template', label: 'Scoring template' },
        ]
        if (manual) {
            base.push({ key: 'awards', label: 'Award categories' })
            base.push({ key: 'scoring', label: 'Scoring categories' })
        }
        base.push({ key: 'tiebreakers', label: 'Tiebreakers' })
        return base
    }, [manual])

    const stepperSteps: StepperStep[] = steps.map(s => ({ key: s.key, label: s.label }))
    const current = steps[Math.min(stepIndex, steps.length - 1)]?.key ?? 'details'

    const goToKey = (key: StepKey) => setStepIndex(steps.findIndex(s => s.key === key))
    const back = () => setStepIndex(i => Math.max(0, i - 1))

    /**
     * Advances from the template step. For a preset, we don't hydrate anything
     * client-side — only the template id is sent at submit time and the backend
     * copies its contents. Manual routes through the award + scoring steps.
     */
    const handleTemplateNext = (isManual: boolean) => {
        if (isManual) {
            goToKey('awards')
            return
        }
        // Preset branch skips awards + scoring, straight to tiebreakers.
        setStepIndex(steps.findIndex(s => s.key === 'tiebreakers'))
    }

    const handleSubmit = (standingsConfigId: string | null) => {
        const payload = buildPayload(
            info,
            caseFormat,
            manual,
            categories,
            awardCategories,
            manual ? null : templateId,
            standingsConfigId,
        )
        setSubmitting(true)
        apiFetch('/organizer/tournament', { method: 'POST', body: JSON.stringify(payload) })
            .then(res => {
                if (!res.ok) {
                    setSubmitting(false)
                    return setError(res.statusText)
                }
                return res.json()
            })
            .then((res: ITournament | null) => {
                setSubmitting(false)
                if (res === null) return
                navigate(`/organizer/${res.id}`)
            })
    }

    const titleByKey: Record<StepKey, string> = {
        details: 'New tournament',
        witnesses: 'Case format & witnesses',
        template: 'Scoring template',
        awards: 'Award categories',
        scoring: 'Scoring categories',
        tiebreakers: 'Tiebreakers & standings',
    }

    return (
        <main className="org-main">
            <div className="org-container">
                <button className="org-back-btn" onClick={() => stepIndex > 0 ? back() : navigate('/organizer')}>
                    ← {stepIndex > 0 ? 'Back' : 'All tournaments'}
                </button>
                <TournamentStepper steps={stepperSteps} currentIndex={stepIndex} onGoTo={setStepIndex} />
                <div className="tc-card">
                    <h1 className="tc-card-title">{titleByKey[current]}</h1>
                    {error && <div className="tc-error-banner">{error}</div>}
                    {submitting && <LoadingPage loadingText={'Submitting...'} />}
                    {!submitting && <>
                        {current === 'details' && (
                            <TournamentDetails info={info} onChange={setInfo} onNext={() => goToKey('witnesses')} onBack={() => navigate('/organizer')} />
                        )}
                        {current === 'witnesses' && (
                            <TournamentCaseFormat caseFormat={caseFormat} onChange={setCaseFormat} onNext={() => goToKey('template')} onBack={back} />
                        )}
                        {current === 'template' && (
                            <TournamentScoringTemplate templates={templates} loading={templatesLoading} selected={templateId} onChange={setTemplateId} onNext={handleTemplateNext} onBack={back} />
                        )}
                        {current === 'awards' && (
                            <TournamentAwards awardCategories={awardCategories} onChange={setAwardCategories} onNext={() => goToKey('scoring')} onBack={back} />
                        )}
                        {current === 'scoring' && (
                            <TournamentScoringFields
                                categories={categories}
                                onChange={setCategories}
                                caseFormat={caseFormat}
                                awardCategories={awardCategories}
                                onSubmit={() => goToKey('tiebreakers')}
                                onBack={back}
                                submitLabel="Next →"
                            />
                        )}
                        {current === 'tiebreakers' && (
                            <TournamentStandings onSubmit={handleSubmit} onBack={back} />
                        )}
                    </>}
                </div>
            </div>
        </main>
    )
}
