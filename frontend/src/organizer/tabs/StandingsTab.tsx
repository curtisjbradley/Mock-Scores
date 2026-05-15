// TODO: standings should be computed server-side from submitted scoresheets; fetch from GET /api/tournaments/:id/standings
import type { ITeam } from '../data/dummyData'

export default function StandingsTab({ teams }: { teams: ITeam[] }) {
    const sorted = [...teams].sort((a, b) =>
        b.wins !== a.wins ? b.wins - a.wins
            : (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst)
    )
    return (
        <div className="dash-section">
            <div className="dash-table-scroll">
            <table className="dash-standings-table">
                <thead>
                    <tr><th>#</th><th>Team</th><th>Team</th><th>W</th><th>L</th><th>PF</th><th>PA</th><th>Diff</th></tr>
                </thead>
                <tbody>
                    {sorted.map((team, i) => {
                        const diff = team.pointsFor - team.pointsAgainst
                        return (
                            <tr key={team.id}>
                                <td>{i + 1}</td>
                                <td className="dash-team-code">{team.code}</td>
                                <td>{team.school}</td>
                                <td>{team.wins}</td><td>{team.losses}</td>
                                <td>{team.pointsFor}</td><td>{team.pointsAgainst}</td>
                                <td className={diff >= 0 ? 'dash-diff--pos' : 'dash-diff--neg'}>
                                    {diff > 0 ? '+' : ''}{diff}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
            </div>
        </div>
    )
}
