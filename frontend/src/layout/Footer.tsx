import './styles/footer.css'

const Footer = () => (
    <footer className="site-footer">
        <a
            href="https://github.com/curtisjbradley/Mock-Scores"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-github"
            aria-label="GitHub"
        >
            <svg width="20" height="20" aria-hidden="true">
                <use href="/icons.svg#github-icon" />
            </svg>
        </a>

        <a href="/help"
           target="_blank"
           className={"footer-link"}
           rel="noopener noreferrer">
            Help
        </a>
    </footer>
)

export default Footer
