/** Inline empty-state message using the shared `coach-empty` style. */
export default function EmptyState({ message }: { message: string }) {
    return <p className="coach-empty">{message}</p>
}
