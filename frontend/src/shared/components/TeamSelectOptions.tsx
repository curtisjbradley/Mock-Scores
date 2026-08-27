import type { ITeam } from '@mock-scores/shared'

interface TeamSelectOptionsProps {
    /** Tournament teams to render as options */
    teams: ITeam[]
    /** Placeholder text for the empty option */
    placeholder?: string
}

/**
 * Renders the `<option>` elements for a team selection `<select>`.
 * Extracted to eliminate duplication across `PairingCard` and `RoundView`.
 *
 * @example
 * <select value={value} onChange={e => onChange(e.target.value)}>
 *   <TeamSelectOptions teams={teams} />
 * </select>
 */
export default function TeamSelectOptions({ teams, placeholder = 'Select team…' }: TeamSelectOptionsProps) {
    return (
        <>
            <option value="">{placeholder}</option>
            {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
            ))}
        </>
    )
}
