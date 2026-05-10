import './header.css'
import {Link} from "react-router-dom";



const Header = () => (
    <header className="site-header">
        <span className="site-logo"> <Link to={'/'} > MockScores </Link></span>
    </header>
)

export default Header
