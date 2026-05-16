import { Component } from 'react'
import { fetchScoringCategories, saveScoringCategories, fetchFormat } from '../hooks/useTournamentData'
import type { ScoringCategory, CaseFormatState } from '../types/tournament'
import { emptyCaseFormat } from '../types/tournament'
import TournamentScoringFields from '../steps/TournamentScoringFields'
import Section from './Section'
import '../styles/scoring-fields.css'

interface State {
    categories: ScoringCategory[]
    caseFormat: CaseFormatState
    loading: boolean
    error: string | null
    saving: boolean
    saveError: string | null
}

export default class ScoringTab extends Component<{ tournamentId: string }, State> {
    state: State = { categories: [], caseFormat: emptyCaseFormat, loading: true, error: null, saving: false, saveError: null }

    componentDidMount() {
        Promise.all([
            fetchScoringCategories(this.props.tournamentId),
            fetchFormat(this.props.tournamentId),
        ]).then(([categories, caseFormat]) => {
            this.setState({ categories, caseFormat, loading: false })
        }).catch(() => this.setState({ loading: false, error: 'Failed to load scoring data.' }))
    }

    handleSave = async () => {
        this.setState({ saving: true, saveError: null })
        try { await saveScoringCategories(this.props.tournamentId, this.state.categories) }
        catch (e: unknown) { this.setState({ saveError: e instanceof Error ? e.message : 'Failed to save' }) }
        finally { this.setState({ saving: false }) }
    }

    render() {
        const { loading, error, saveError, saving, categories, caseFormat } = this.state
        if (loading) return <p className="dash-saving">Loading…</p>
        return (
            <Section title="Scoring fields">
                {(error || saveError) && <div className="tc-error-banner">{error ?? saveError}</div>}
                <TournamentScoringFields
                    categories={categories}
                    onChange={(cats: ScoringCategory[]) => this.setState({ categories: cats })}
                    caseFormat={caseFormat}
                    onSubmit={this.handleSave}
                    onBack={() => {}}
                    isEditing
                />
                {saving && <p className="dash-saving">Saving…</p>}
            </Section>
        )
    }
}
