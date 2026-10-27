interface EmptyStateProps {
    message: string
    /** Optional secondary line giving the user guidance on what to do next. */
    hint?: string
}

/** Inline empty-state message using the shared `coach-empty` style. */
export default function EmptyState({ message, hint }: EmptyStateProps) {
    return (
        <div className="coach-empty">
            <p className="coach-empty-message">{message}</p>
            {hint && <p className="coach-empty-hint">{hint}</p>}
        </div>
    )
}
