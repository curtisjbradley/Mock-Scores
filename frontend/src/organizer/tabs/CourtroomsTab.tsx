import CourtroomsPage from '../pages/CourtroomsPage'

export default function CourtroomsTab() {
    return (
        <div className="dash-section">
            <div className="dash-invites-header"><h2>Courtrooms</h2></div>
            <p className="dash-judge-name">Manage available courtrooms in use during competition.</p>
            <CourtroomsPage />
        </div>
    )
}
