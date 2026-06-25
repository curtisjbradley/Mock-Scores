interface Props {
    label: string
    variant: 'submitted' | 'pending' | 'danger'
}

/** Reusable status badge using the `ss-chip` CSS classes. */
export default function StatusChip({ label, variant }: Props) {
    return <span className={`ss-chip ss-chip--${variant}`}>{label}</span>
}
