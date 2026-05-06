import { useNavigate } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import './components/layout.css'

const heroImg = '/hero.JPG'

const roles = [
    { label: 'Organizer', path: '/organizer' },
    { label: 'Coach', path: '/coach' },
    { label: 'Scorer', path: '/scorer' },
]

const Home = () => {
    const navigate = useNavigate()

    return (
        <>
            <Header />
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
            <Footer />
        </>
    )
}

export default Home
