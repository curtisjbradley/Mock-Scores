import { useEffect, useState } from 'react'
import { fetchStandingsTemplates } from '../hooks/useTournamentData'
import type { IStandingsTemplate } from '@mock-scores/shared'

interface Props {
    onSubmit: (standingsConfigId: string | null) => void
    onBack: () => void
}

export default function TournamentStandings({ onSubmit, onBack }: Props) {
    const [templates, setTemplates] = useState<IStandingsTemplate[]>([])
    const [selected, setSelected] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchStandingsTemplates()
            .then(t => { setTemplates(t); if (t.length) setSelected(t[0].config_id) })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    const handleSubmit = (e: { preventDefault(): void }) => {
        e.preventDefault()
        onSubmit(selected)
    }

    return (
        <form className="tc-form" onSubmit={handleSubmit}>
            {loading ? <p>Loading templates…</p> : (
                <div className="sf-modal-options">
                    {templates.map(t => (
                        <button
                            key={t.id}
                            type="button"
                            className={`sf-modal-option${selected === t.config_id ? ' sf-modal-option--selected' : ''}`}
                            onClick={() => setSelected(t.config_id)}
                        >
                            <strong>{t.label}</strong>
                            <span className="ts-option-description">{t.description}</span>
                        </button>
                    ))}
                    <button
                        type="button"
                        className={`sf-modal-option${selected === null ? ' sf-modal-option--selected' : ''}`}
                        onClick={() => setSelected(null)}
                    >
                        <strong>None / Manual</strong>
                        <span className="ts-option-description">Skip for now — configure tiebreakers after the tournament is created.</span>
                    </button>
                </div>
            )}
            <p className="ts-note">
                Standings configuration can be fully customized from the tournament dashboard after creation.
            </p>
            <div className="tc-actions">
                <button type="button" className="tc-cancel-btn" onClick={onBack}>← Back</button>
                <button type="submit" className="org-new-btn" disabled={loading}>Create tournament →</button>
            </div>
        </form>
    )
}
