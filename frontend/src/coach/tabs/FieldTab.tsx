import type { ICompetitionTeam } from '@mock-scores/shared'

export default function FieldTab({ field }: { field: ICompetitionTeam[] }) {
    if (field.length === 0) return <p className="coach-empty">No teams yet.</p>
    return (
        <table className="dash-standings-table">
            <thead><tr><th>Code</th><th>Team</th></tr></thead>
            <tbody>{field.map(t => (
                <tr key={t.id}><td>{t.code}</td><td>{t.name}</td></tr>
            ))}</tbody>
        </table>
    )
}
