import { Router, Request, Response } from 'express';
import { dbQuery } from "../db";


const PLUNK_SECRET = process.env.PLUNK_WEBHOOK_SECRET ?? "";

const router = Router();

/**
 * Plunk email lifecycle webhook payload.
 *
 * Plunk delivers events through its workflow system using the default payload
 * envelope: `{ contact, workflow, execution, event }`. The `event` object holds
 * the email-event data. Every email event echoes back `emailId` — the Plunk
 * email record id returned from POST /v1/send — which we use to correlate the
 * event with the `email_messages` row recorded at send time. `messageId` is the
 * underlying provider (SES) id, stored for reference only.
 *
 * The default payload does NOT include an explicit event-type discriminator, so
 * we infer the lifecycle stage from which timestamp field is present:
 *   - `deliveredAt`  → delivered
 *   - `bouncedAt`    → bounced   (with `bounceType`: 'Permanent' | 'Transient')
 *   - `complainedAt` → complained
 * Events that carry none of these (sent, open, click, received, …) are ignored.
 *
 * See https://docs.useplunk.com/guides/webhooks.
 */
interface PlunkEmailEvent {
    subject?: string;
    from?: string;
    fromName?: string;
    messageId?: string;
    emailId?: string;
    templateId?: string | null;
    campaignId?: string | null;
    sourceType?: string;
    // Lifecycle-specific fields (presence discriminates the event type):
    deliveredAt?: string;
    bouncedAt?: string;
    bounceType?: string; // 'Permanent' | 'Transient'
    transientBounce?: boolean;
    complainedAt?: string;
}

interface PlunkWebhookBody {
    event?: PlunkEmailEvent;
}

/**
 * Receives Plunk email lifecycle events and advances the matching
 * `email_messages` row's status. Correlation is by `emailId` (Plunk emailId).
 *
 * Authenticity is verified with a shared secret sent as the `secret` header
 * (configured on the Plunk workflow's Webhook step). Requests without the
 * correct secret are rejected with 401.
 *
 * Idempotent: each update is a plain column write keyed by emailId, so
 * duplicate deliveries of the same event are harmless. Always returns 200 fast
 * (Plunk times out at 10s and does not retry), even for events we don't track
 * or ids we don't recognize.
 */
router.post("/plunk", async (req: Request, res: Response) => {

    if (req.headers['secret'] !== PLUNK_SECRET) {
        return res.status(401).json({ message: "Missing Plunk Secret" });
    }

    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    let body: PlunkWebhookBody;
    try {
        body = JSON.parse(raw) as PlunkWebhookBody;
    } catch {
        return res.status(200).send("Ignored");
    }

    // Plunk wraps event data under `event`; tolerate a flat payload too.
    const event: PlunkEmailEvent = body?.event ?? (body as PlunkEmailEvent);
    const emailId = event?.emailId;
    const messageId = event?.messageId ?? null;
    if (!emailId) return res.status(200).send("Ignored");

    // Infer the lifecycle stage from which timestamp field is present.
    if (event.deliveredAt !== undefined) {
        await dbQuery(
            `UPDATE email_messages
             SET status = 'delivered', delivered_at = now(), message_id = COALESCE($2, message_id), updated_at = now()
             WHERE email_id = $1 AND status <> 'bounced' AND status <> 'complained'`,
            [emailId, messageId],
        );
        return res.status(200).send("OK");
    }

    if (event.bouncedAt !== undefined || event.bounceType !== undefined) {
        await dbQuery(
            `UPDATE email_messages
             SET status = 'bounced', bounced_at = now(), bounce_type = $2,
                 message_id = COALESCE($3, message_id), updated_at = now()
             WHERE email_id = $1`,
            [emailId, event.bounceType ?? null, messageId],
        );
        return res.status(200).send("OK");
    }

    if (event.complainedAt !== undefined) {
        await dbQuery(
            `UPDATE email_messages
             SET status = 'complained', complained_at = now(),
                 message_id = COALESCE($2, message_id), updated_at = now()
             WHERE email_id = $1`,
            [emailId, messageId],
        );
        return res.status(200).send("OK");
    }

    return res.status(200).send("Ignored");
});

router.get("/", async (_req: Request, res: Response) => {
    res.status(404).json({ message: "Not Found" });
});

export default router;
