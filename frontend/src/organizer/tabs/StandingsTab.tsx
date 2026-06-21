// TODO: fetch from GET /api/organizer/tournament/:id/standings
import { useState, useEffect } from 'react'
import { apiFetch } from '../../auth/auth'

interface ITeam { id: string; code: string; team: string; wins: number; losses: number; pointsFor: number; pointsAgainst: number }

export default function StandingsTab({ tournamentId }: { tournamentId: string }) {
    const [teams] = useState<ITeam[]>([])

    useEffect(() => {
        // TODO: GET /api/organizer/tournament/:id/standings
        void apiFetch
        void tournamentId
    }, [tournamentId])

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
                                    <td>{team.team}</td>
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
