import { Link } from 'react-router-dom'
import './notfound.css'

const NotFound = () => (
    <main className="notfound-main">
        <div className="notfound-code">404</div>
        <h2>Page not found</h2>
        <p>The page you're looking for doesn't exist.</p>
        <Link to="/">← Go home</Link>
    </main>
)

export default NotFound
