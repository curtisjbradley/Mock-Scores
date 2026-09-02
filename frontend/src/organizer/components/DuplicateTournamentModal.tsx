import { useState } from 'react'
import '../../judges/styles/modal.css'
import type { IDuplicateOptions } from '@mock-scores/shared'

export function DuplicateTournamentModal({ tournamentName, onClose, onDuplicate }: {
    tournamentName: string
    onClose: () => void
    onDuplicate: (options: IDuplicateOptions) => void
}) {
    const [options, setOptions] = useState<IDuplicateOptions>({
        scorers: true,
        courtrooms: true,
        scoringCategories: true,
        awards: true,
        witnesses: true,
        format: true,
        tiebreaker: true,
    })

    const toggle = (key: keyof IDuplicateOptions) =>
        setOptions(prev => ({ ...prev, [key]: !prev[key] }))

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onDuplicate(options)
        onClose()
    }

    const items: { key: keyof IDuplicateOptions; label: string }[] = [
        { key: 'format', label: 'Case format' },
        { key: 'witnesses', label: 'Witnesses' },
        { key: 'scoringCategories', label: 'Scoring categories' },
        { key: 'awards', label: 'Award categories' },
        { key: 'scorers', label: 'Scorers' },
        { key: 'courtrooms', label: 'Courtrooms' },
        { key: 'tiebreaker', label: 'Tiebreakers + Standings' },
    ]

    return (
        <div className="modal-backdrop" role="presentation" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="dup-modal-title">
                <h2 id="dup-modal-title">Duplicate "{tournamentName}"</h2>
                <p>Select what to copy into the new tournament:</p>
                <form onSubmit={handleSubmit} className="modal-form">
                    {items.map(({ key, label }) => (
                        <label key={key} className="modal-checkbox-row">
                            <input
                                type="checkbox"
                                checked={options[key]}
                                onChange={() => toggle(key)}
                            />
                            {label}
                        </label>
                    ))}
                    <div className="confirm-actions">
                        <button type="button" onClick={onClose}>Cancel</button>
                        <button type="submit">Duplicate</button>
                    </div>
                </form>
            </div>
        </div>
    )
}
