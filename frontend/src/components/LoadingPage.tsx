import Header from './Header'
import Footer from './Footer'
import './layout.css'

const LoadingPage = () => (
    <>
        <Header />
        <main className="loading-main">
            <div className="loading-spinner" aria-label="Loading" />
            <p>Loading score sheet…</p>
        </main>
        <Footer />
    </>
)

export default LoadingPage
