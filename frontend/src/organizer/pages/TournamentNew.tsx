import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/organizer.css'
import '../styles/tournament-create.css'
import '../styles/scoring-fields.css'
import type { TournamentPayload } from '@mock-scores/shared'
import { emptyInfo, emptyCaseFormat, defaultWitnessCategory } from '../types/tournament'
import type { TournamentInfo, CaseFormatState, ScoringCategory } from '../types/tournament'
import TournamentStepper from '../components/TournamentStepper'
import TournamentDetails from '../steps/TournamentDetails'
import TournamentCaseFormat from '../steps/TournamentCaseFormat'
import TournamentScoringFields from '../steps/TournamentScoringFields'
import {getToken} from "../../auth/auth.ts";
import LoadingPage from "../../layout/LoadingPage.tsx";

function buildPayload(info: TournamentInfo, caseFormat: CaseFormatState, categories: ScoringCategory[]): TournamentPayload {
    return {
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
                eligibleForAward: f.eligibleForAward,
                visibleToScorers: f.visibleToScorers,
                prosecution: f.prosecution,
                defense: f.defense,
                calling: f.calling,
                crossing: f.crossing,
                position: fPos,
            })),
        })),
    }
}

export default function TournamentNew() {
    const navigate = useNavigate()
    const [step, setStep] = useState(1)
    const [info, setInfo] = useState<TournamentInfo>(emptyInfo)
    const [caseFormat, setCaseFormat] = useState<CaseFormatState>(emptyCaseFormat)
    const [categories, setCategories] = useState<ScoringCategory[]>([defaultWitnessCategory()])
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const titles = ['New tournament', 'Case format', 'Scoring fields']

    const handleSubmit  = () => {
        const payload = buildPayload(info, caseFormat, categories)

        setSubmitting(true)
        fetch('/api/tournament', { method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization' : `Bearer ${getToken()}` },
            body: JSON.stringify(payload) })
            .then(res => {
                if(!res.ok) {
                    setSubmitting(false)
                   return setError(res.statusText)
                }
                return res.json()
            }).then(res => {
                setSubmitting(false)
                if(res === null){
                    return
                }
                navigate(`/organizer/${res.id}`)
        })
    }

    return (
        <main className="org-main">
            <div className="org-container">
                <button className="org-back-btn" onClick={() => step > 1 ? setStep(s => s - 1) : navigate('/organizer')}>
                    ← {step > 1 ? 'Back' : 'All tournaments'}
                </button>
                <TournamentStepper current={step} onGoTo={setStep} />
                <div className="tc-card">
                    <h1 className="tc-card-title">{titles[step - 1]}</h1>
                    {error && <div className="tc-error-banner">{error}</div>}
                    {submitting && <LoadingPage loadingText={"Submitting..."} />}
                    {!submitting && <>
                        {step === 1 && <TournamentDetails info={info} onChange={setInfo} onNext={() => setStep(2)} onBack={() => navigate('/organizer')} />}
                        {step === 2 && <TournamentCaseFormat caseFormat={caseFormat} onChange={setCaseFormat} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
                        {step === 3 && <TournamentScoringFields categories={categories} onChange={setCategories} caseFormat={caseFormat} onSubmit={handleSubmit} onBack={() => setStep(2)} />}
                    </>}
                </div>
            </div>
        </main>
    )
}
