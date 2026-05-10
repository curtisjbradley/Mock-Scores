import { useNavigate } from 'react-router-dom'
import './home/home.css'

const heroImg = '/hero.JPG'

const roles = [
    { label: 'Organizer', path: '/organizer' },
    { label: 'Coach', path: '/coach' },
    { label: 'Scorer', path: '/scorer' },
]

const Home = () => {
    const navigate = useNavigate()

    return (
        <div className="home-main">
                <img
                    src={heroImg}
                    alt=""
                    className="home-hero-img"
                    fetchPriority="high"
                    aria-hidden="true"
                />
                <main className="main-content">
                    <h1>Welcome</h1>
                    <p>Who are you?</p>
                    <div className="role-buttons">
                        {roles.map(({ label, path }) => (
                            <button
                                key={label}
                                className="role-btn"
                                onClick={() => navigate(path)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </main>
            </div>
    )
}

export default Home
