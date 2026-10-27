import './styles/footer.css'
import { Link } from 'react-router-dom'

const Footer = () => (
    <footer className="site-footer">
        <div className="footer-links">
            <a href="https://mockscores.org/privacy"
               target="_blank"
               className={"footer-link"}
               rel="noopener noreferrer">
                Privacy
            </a>

            <a href="https://mockscores.org/terms"
               target="_blank"
               className={"footer-link"}
               rel="noopener noreferrer">
                Terms
            </a>

            <a
                href="https://github.com/curtisjbradley/Mock-Scores"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-github"
                aria-label="GitHub"
            >
                <span id={'github-text'}>GitHub</span>
                <svg id={"github-icon"} width="20" height="20" aria-hidden="true">
                    <use href="/icons.svg#github-icon" />
                </svg>
            </a>
            <a href="https://mockscores.org/docs/"
               target="_blank"
               className={"footer-link"}
               rel="noopener noreferrer">
                Guides
            </a>

            <Link to="/contact" className="footer-link">
                Contact
            </Link>
        </div>

    </footer>
)

export default Footer
