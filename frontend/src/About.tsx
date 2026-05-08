import Header from './components/Header'
import Footer from './components/Footer'
import './components/layout.css'

const About = () => (
    <>
        <Header />
        <main className="about-main">
            <div className="about-card">
                <h1>About Mock Scores</h1>
                <p>Mock Scores is scoring software for high school mock trial competitions in California, optimised for Teach Democracy / Constitutional Rights Foundation (CRF) tournaments.</p>
                <h2>How it works</h2>
                <p>Judges score each witness and attorney performance in real time. Scores are submitted at the end of each round and tallied automatically.</p>
                <h2>Contact</h2>
                <p>For support or feedback, contact your tournament organiser.</p>
            </div>
        </main>
        <Footer />
    </>
)

export default About
