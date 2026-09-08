import type { EmailStatus } from '@mock-scores/shared'
import StatusChip from './StatusChip'

interface Props {
    /** Current email lifecycle status, or null/undefined when nothing was sent. */
    status: EmailStatus | null | undefined
    /** When true, render nothing if no email has been sent (default hides the "not sent" case). */
    hideWhenUnsent?: boolean
}

const LABELS: Record<EmailStatus, string> = {
    sent: 'Email sent',
    delivered: 'Delivered',
    bounced: 'Bounced',
    complained: 'Spam complaint',
}

// Bounces and complaints are failures (danger); delivered is success; sent is pending.
const VARIANTS: Record<EmailStatus, 'submitted' | 'pending' | 'danger'> = {
    sent: 'pending',
    delivered: 'submitted',
    bounced: 'danger',
    complained: 'danger',
}

/**
 * Shows the delivery status of a tracked email (scoring link, coach/organizer
 * invite) as a coloured chip. Bounced/complained render in the danger colour to
 * make failed deliveries visually obvious. Renders nothing when no email has
 * been sent (status null/undefined) unless told otherwise.
 */
export default function EmailStatusBadge({ status, hideWhenUnsent = true }: Props) {
    if (!status) {
        if (hideWhenUnsent) return null
        return <StatusChip label="Not sent" variant="pending" />
    }
    return <StatusChip label={LABELS[status]} variant={VARIANTS[status]} />
}
