import { useState } from 'react'
import '../styles/tournament-create.css'
import '../styles/scoring-fields.css'
import TournamentDetails from '../steps/TournamentDetails'
import TournamentCaseFormat from '../steps/TournamentCaseFormat'
import TournamentScoringFields from '../steps/TournamentScoringFields'
import TournamentStepper from '../components/TournamentStepper'
import Section from './Section'
import TeamsTab from './TeamsTab'
import OrganizersTab from './OrganizersTab'
import ScorersTab from './ScorersTab'
import CourtroomsTab from './CourtroomsTab'
import type { TournamentInfo, CaseFormatState, ScoringCategory } from '../types/tournament'

type SubTab = 'tournament' | 'teams' | 'organizers' | 'scorers' | 'courtrooms'

interface Props {
    tournamentId: string
    subTab: SubTab
    info: TournamentInfo
    caseFormat: CaseFormatState
    categories: ScoringCategory[]
    onChangeInfo: (info: TournamentInfo) => void
    onChangeCaseFormat: (cf: CaseFormatState) => void
    onChangeCategories: (cats: ScoringCategory[]) => void
    onSaveTournament: (info: TournamentInfo, caseFormat: CaseFormatState, categories: ScoringCategory[]) => Promise<void>
}

export default function SetupTab({
    tournamentId, subTab,
    info, caseFormat, categories,
    onChangeInfo, onChangeCaseFormat, onChangeCategories,
    onSaveTournament,
}: Props) {
    const [tStep, setTStep] = useState(1)
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [saveSuccess, setSaveSuccess] = useState(false)

    const handleSave = async () => {
        setSaving(true)
        setSaveError(null)
        setSaveSuccess(false)
        try {
            await onSaveTournament(info, caseFormat, categories)
            setSaveSuccess(true)
        } catch (e: unknown) {
            setSaveError(e instanceof Error ? e.message : 'Failed to save')
        } finally {
            setSaving(false)
        }
    }

    if (subTab === 'teams')      return <TeamsTab tournamentId={tournamentId} />
    if (subTab === 'organizers') return <OrganizersTab tournamentId={tournamentId} />
    if (subTab === 'scorers')    return <ScorersTab tournamentId={tournamentId} />
    if (subTab === 'courtrooms') return <CourtroomsTab tournamentId={tournamentId} />

    return (
        <Section title="Tournament settings">
            <TournamentStepper current={tStep} onGoTo={setTStep} />
            {saveError && <div className="tc-error-banner">{saveError}</div>}
            {saveSuccess && <div className="tc-error-banner dash-save-success">Saved successfully</div>}
            <div className="tc-card">
                {tStep === 1 && <TournamentDetails info={info} onChange={onChangeInfo} onNext={() => setTStep(2)} onBack={() => {}} />}
                {tStep === 2 && <TournamentCaseFormat caseFormat={caseFormat} onChange={onChangeCaseFormat} onNext={() => setTStep(3)} onBack={() => setTStep(1)} />}
                {tStep === 3 && <TournamentScoringFields categories={categories} onChange={onChangeCategories} caseFormat={caseFormat} onSubmit={handleSave} onBack={() => setTStep(2)} isEditing />}
            </div>
            {saving && <p className="dash-saving">Saving…</p>}
        </Section>
    )
}
