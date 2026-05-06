import { Link } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import './components/layout.css'

const NotFound = () => (
    <>
        <Header />
        <main className="notfound-main">
            <div className="notfound-code">404</div>
            <h2>Page not found</h2>
            <p>The page you're looking for doesn't exist.</p>
            <Link to="/">← Go home</Link>
        </main>
        <Footer />
    </>
)

export default NotFound
