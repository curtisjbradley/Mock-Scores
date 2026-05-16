import { Component } from 'react'
import '../styles/tournament-create.css'
import Section from './Section'
import TeamsTab from './TeamsTab'
import OrganizersTab from './OrganizersTab'
import ScorersTab from './ScorersTab'
import CourtroomsTab from './CourtroomsTab'
import { fetchFormat, saveFormat, saveTournamentInfo } from '../hooks/useTournamentData'
import type { TournamentInfo, CaseFormatState } from '../types/tournament'
import { emptyCaseFormat } from '../types/tournament'
import type { ITournament } from '@mock-scores/shared'
import { apiFetch } from '../../auth/auth'

type SubTab = 'tournament' | 'teams' | 'organizers' | 'scorers' | 'courtrooms'
interface Props { tournamentId: string; subTab: SubTab; visitedSubTabs: Set<SubTab> }

const emptyInfo: TournamentInfo = { name: '', location: '', startDate: '', endDate: '', startTbd: false, endTbd: false }

interface State {
    info: TournamentInfo
    caseFormat: CaseFormatState
    loading: boolean
    error: string | null
    saving: boolean
    saveError: string | null
    saveSuccess: boolean
    submitted: boolean
}

export default class SetupTab extends Component<Props, State> {
    state: State = { info: emptyInfo, caseFormat: emptyCaseFormat, loading: true, error: null, saving: false, saveError: null, saveSuccess: false, submitted: false }

    componentDidMount() {
        Promise.all([
            apiFetch(`/api/organizer/tournament/${this.props.tournamentId}`).then(r => r.ok ? r.json() as Promise<ITournament> : Promise.reject()),
            fetchFormat(this.props.tournamentId),
        ]).then(([t, cf]) => {
            this.setState({
                info: {
                    name: t.name, location: t.location,
                    startDate: t.start_date ? String(t.start_date).slice(0, 10) : '',
                    endDate: t.end_date ? String(t.end_date).slice(0, 10) : '',
                    startTbd: !t.start_date, endTbd: !t.end_date,
                },
                caseFormat: cf,
                loading: false,
            })
        }).catch(() => this.setState({ loading: false, error: 'Failed to load tournament data.' }))
    }

    getErrors(info: TournamentInfo, cf: CaseFormatState) {
        return {
            name:      !info.name.trim() ? 'Required' : '',
            location:  !info.location.trim() ? 'Required' : '',
            startDate: !info.startTbd && !info.startDate ? 'Required' : '',
            endDate:   !info.endTbd && !info.endDate ? 'Required'
                     : !info.endTbd && !info.startTbd && info.endDate < info.startDate ? 'Must be after start' : '',
            caseName:  !cf.caseName.trim() ? 'Required' : '',
        }
    }

    handleSave = async (e: { preventDefault(): void }) => {
        e.preventDefault()
        this.setState({ submitted: true })
        const { info, caseFormat } = this.state
        if (Object.values(this.getErrors(info, caseFormat)).some(Boolean)) return
        this.setState({ saving: true, saveError: null, saveSuccess: false })
        try {
            await Promise.all([
                saveTournamentInfo(this.props.tournamentId, info),
                saveFormat(this.props.tournamentId, caseFormat),
            ])
            this.setState({ saveSuccess: true })
        } catch (err: unknown) {
            this.setState({ saveError: err instanceof Error ? err.message : 'Failed to save' })
        } finally {
            this.setState({ saving: false })
        }
    }

    render() {
        const { tournamentId, subTab, visitedSubTabs } = this.props
        const { info, caseFormat, loading, error, saveError, saveSuccess, saving, submitted } = this.state
        const errors = this.getErrors(info, caseFormat)
        const setInfo = (i: TournamentInfo) => this.setState({ info: i })
        const setCf = (cf: CaseFormatState) => this.setState({ caseFormat: cf })

        return (
            <>
                {visitedSubTabs.has('teams')       && <div hidden={subTab !== 'teams'}><TeamsTab tournamentId={tournamentId} /></div>}
                {visitedSubTabs.has('organizers')  && <div hidden={subTab !== 'organizers'}><OrganizersTab tournamentId={tournamentId} /></div>}
                {visitedSubTabs.has('scorers')     && <div hidden={subTab !== 'scorers'}><ScorersTab tournamentId={tournamentId} /></div>}
                {visitedSubTabs.has('courtrooms')  && <div hidden={subTab !== 'courtrooms'}><CourtroomsTab tournamentId={tournamentId} /></div>}
                <div hidden={subTab !== 'tournament'}>
                {loading ? <p className="dash-saving">Loading…</p> : (
                <Section title="Tournament settings">
                {(error || saveError) && <div className="tc-error-banner">{error ?? saveError}</div>}
                {saveSuccess && <div className="tc-error-banner dash-save-success">Saved successfully</div>}
                <form className="tc-form" onSubmit={this.handleSave} noValidate>
                    <div className="tc-field">
                        <label className="tc-label" htmlFor="name">Tournament name</label>
                        <input id="name" type="text"
                            className={`tc-input${submitted && errors.name ? ' tc-input--invalid' : ''}`}
                            value={info.name} placeholder="e.g. San Luis Obispo County"
                            onChange={e => setInfo({ ...info, name: e.target.value })} />
                        {submitted && errors.name && <span className="tc-field-error">{errors.name}</span>}
                    </div>

                    <div className="tc-field">
                        <label className="tc-label" htmlFor="location">Location</label>
                        <input id="location" type="text"
                            className={`tc-input${submitted && errors.location ? ' tc-input--invalid' : ''}`}
                            value={info.location} placeholder="e.g. SLO Superior Court"
                            onChange={e => setInfo({ ...info, location: e.target.value })} />
                        {submitted && errors.location && <span className="tc-field-error">{errors.location}</span>}
                    </div>

                    <div className="tc-section">
                        <span className="tc-section-label">Dates</span>
                        <div className="tc-row">
                            {(['startDate', 'endDate'] as const).map(key => {
                                const tbdKey = key === 'startDate' ? 'startTbd' : 'endTbd'
                                return (
                                    <div key={key} className="tc-field">
                                        <label className="tc-label">{key === 'startDate' ? 'Start' : 'End'}</label>
                                        {!info[tbdKey] && (
                                            <input type="date"
                                                className={`tc-input${submitted && errors[key] ? ' tc-input--invalid' : ''}`}
                                                value={info[key]} onChange={e => setInfo({ ...info, [key]: e.target.value })} />
                                        )}
                                        <label className="tc-checkbox-label">
                                            <input type="checkbox" checked={info[tbdKey]}
                                                onChange={() => setInfo({ ...info, [tbdKey]: !info[tbdKey] })} />
                                            TBD
                                        </label>
                                        {submitted && errors[key] && <span className="tc-field-error">{errors[key]}</span>}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="tc-field">
                        <label className="tc-label" htmlFor="caseName">Case name</label>
                        <input id="caseName" type="text"
                            className={`tc-input${submitted && errors.caseName ? ' tc-input--invalid' : ''}`}
                            value={caseFormat.caseName} placeholder="e.g. People v. Fromholz"
                            onChange={e => setCf({ ...caseFormat, caseName: e.target.value })} />
                        {submitted && errors.caseName && <span className="tc-field-error">{errors.caseName}</span>}
                    </div>

                    <label className="tc-checkbox-label">
                        <input type="checkbox" checked={caseFormat.criminalCase}
                            onChange={() => setCf({ ...caseFormat, criminalCase: !caseFormat.criminalCase })} />
                        Criminal case
                    </label>

                    <div className="tc-actions">
                        <button type="submit" className="org-new-btn" disabled={saving}>
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </form>
                </Section>
                )}
                </div>
            </>
        )
    }
}
