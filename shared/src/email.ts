/** Lifecycle status of a tracked outbound email (see backend email_messages). */
export type EmailStatus = 'sent' | 'delivered' | 'bounced' | 'complained'

/** Per-target email delivery status, surfaced to organizer UIs. */
export interface IEmailStatus {
    /** Current lifecycle status, or null when no email has been sent for this target. */
    status: EmailStatus | null
    /** Recipient address the email was sent to, when known. */
    recipient?: string | null
    /** Bounce classification (e.g. 'Permanent' / 'Transient') when status is 'bounced'. */
    bounceType?: string | null
    /** ISO timestamp of the most recent lifecycle update, when known. */
    updatedAt?: string | null
}
