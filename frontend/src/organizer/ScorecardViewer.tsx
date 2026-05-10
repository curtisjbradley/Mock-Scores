import { useParams, useNavigate } from 'react-router-dom'
import './organizer.css'

const ScorecardViewer = () => {
    const { id, pairingId, judgeId } = useParams<{ id: string; pairingId: string; judgeId: string }>()
    const navigate = useNavigate()

    return (
            <main className="org-main">
                <div className="org-container">
                    <button className="org-back-btn" onClick={() => navigate(-1)}>← Back to tournament</button>
                    <div className="coach-section">
                        <h2>Scorecard Viewer</h2>
                        <p className="coach-empty">Tournament: {id}</p>
                        <p className="coach-empty">Pairing: {pairingId}</p>
                        <p className="coach-empty">Judge: {judgeId}</p>
                        <p className="coach-empty" style={{ marginTop: '1rem', fontStyle: 'italic' }}>
                            Scorecard details will be displayed here when backend integration is complete.
                        </p>
                    </div>
                </div>
            </main>

    )
}

export default ScorecardViewer
