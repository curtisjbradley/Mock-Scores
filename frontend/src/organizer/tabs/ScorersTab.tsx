import ScorersPage from '../pages/ScorersPage'

export default function ScorersTab() {
    return (
        <div className="dash-section">
            <div className="dash-invites-header"><h2>Scorers</h2></div>
            <p className="dash-judge-name">Manage your list of available scorers.</p>
            <ScorersPage />
        </div>
    )
}
