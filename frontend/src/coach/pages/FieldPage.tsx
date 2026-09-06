import { useCoachContext } from '../CoachContext'

/**
 * Field page. Reads the tournament's competing teams from the shared
 * `CoachLayout` context.
 */
export default function FieldPage() {
    const { field } = useCoachContext()

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
