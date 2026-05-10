import './loading.css'

type LoadingPageProps = {
    loadingText?: string
}
const LoadingPage = ({loadingText = 'Loading...'} : LoadingPageProps ) => (
    <main className="loading-main">
        <div className="loading-spinner" aria-label="Loading" />
        <p>{loadingText}</p>
    </main>
)

export default LoadingPage
