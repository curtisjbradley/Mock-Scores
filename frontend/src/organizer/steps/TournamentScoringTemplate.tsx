import { useState } from 'react'
import type { IScoringTemplate } from '@mock-scores/shared'

interface Props {
    /** Templates fetched from the API. */
    templates: IScoringTemplate[]
    loading?: boolean
    /** Currently selected template id, or 'manual'. */
    selected: string
    onChange: (templateId: string) => void
    /** Continue to the next step. `manual` distinguishes the branch to take. */
    onNext: (manual: boolean) => void
    onBack: () => void
}

/**
 * Step 3 of tournament creation: choose a scoring template.
 *
 * Selecting a built-in preset applies its award categories and scoring
 * categories, then skips ahead to tiebreakers. Selecting "Manual" routes the
 * organizer through the award-category and scoring-category definition steps.
 */
export default function TournamentScoringTemplate({ templates, loading, selected, onChange, onNext, onBack }: Props) {
    const [choice, setChoice] = useState(selected)

    const handleSubmit = (e: { preventDefault(): void }) => {
        e.preventDefault()
        onChange(choice)
        onNext(choice === 'manual')
    }

    return (
        <form className="tc-form" onSubmit={handleSubmit}>
            <p className="ts-note">
                Choose a scoring template to start from. Presets include their scoring
                categories and award categories. Choose <strong>Manual</strong> to define
                your own award and scoring categories step by step.
            </p>
            {loading ? <p>Loading templates…</p> : (
                <div className="sf-modal-options">
                    {templates.map(t => (
                        <button
                            key={t.id}
                            type="button"
                            className={`sf-modal-option${choice === t.id ? ' sf-modal-option--selected' : ''}`}
                            onClick={() => setChoice(t.id)}
                        >
                            <strong>{t.label}</strong>
                            {t.description && <span className="ts-option-description">{t.description}</span>}
                        </button>
                    ))}
                    <button
                        type="button"
                        className={`sf-modal-option${choice === 'manual' ? ' sf-modal-option--selected' : ''}`}
                        onClick={() => setChoice('manual')}
                    >
                        <strong>Manual</strong>
                        <span className="ts-option-description">
                            Define award categories and scoring categories yourself.
                        </span>
                    </button>
                </div>
            )}
            <div className="tc-actions">
                <button type="button" className="btn-cancel" onClick={onBack}>← Back</button>
                <button type="submit" className="btn-confirm" disabled={loading}>Next →</button>
            </div>
        </form>
    )
}
