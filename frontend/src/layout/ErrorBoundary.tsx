import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import '../error/styles/notfound.css'

interface ErrorBoundaryProps {
    children: ReactNode
}

interface ErrorBoundaryState {
    hasError: boolean
    isChunkError: boolean
}

/**
 * Catches render-time errors in the routed page tree so a failure does not
 * blank the whole app with no recovery UI.
 *
 * The most common failure here is a dynamic-import ("chunk load") error: a user
 * keeps a tab open across a deploy, navigates, and the lazily-loaded chunk no
 * longer exists on the server. The fix for that case is a hard reload, so we
 * detect it and offer a Reload action; everything else gets a generic message
 * plus a link home.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { hasError: false, isChunkError: false }

    static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
        const message = error instanceof Error ? error.message : String(error)
        const name = error instanceof Error ? error.name : ''
        const isChunkError =
            name === 'ChunkLoadError' ||
            /dynamically imported module|Importing a module script failed|Failed to fetch dynamically/i.test(message)
        return { hasError: true, isChunkError }
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error('Unhandled render error:', error, info.componentStack)
    }

    private handleReload = () => {
        window.location.reload()
    }

    render(): ReactNode {
        if (!this.state.hasError) return this.props.children

        if (this.state.isChunkError) {
            return (
                <main className="notfound-main">
                    <h2>Update available</h2>
                    <p>This page failed to load because the app was updated. Reloading will fix it.</p>
                    <button className="notfound-back-btn" onClick={this.handleReload}>Reload page</button>
                </main>
            )
        }

        return (
            <main className="notfound-main">
                <h2>Something went wrong</h2>
                <p>An unexpected error occurred while loading this page.</p>
                <button className="notfound-back-btn" onClick={this.handleReload}>Try again</button>
                <Link to="/">Go home</Link>
            </main>
        )
    }
}

export default ErrorBoundary
