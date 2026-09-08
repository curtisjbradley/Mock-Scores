import { Router, Request, Response } from 'express';
import { dbQuery } from "../db";


const PLUNK_SECRET = process.env.PLUNK_WEBHOOK_SECRET ?? "";

const router = Router();

/**
 * Plunk email lifecycle webhook payload (custom body configured on the Plunk
 * workflow). Every email event echoes back `email_id` — the Plunk email record
 * id returned from POST /v1/send — which we use to correlate the event with the
 * `email_messages` row recorded at send time. `message_id` is the underlying
 * provider (SES) id, stored for reference only.
 */
interface PlunkEmailEvent {
    type: string;
    created_at?: string;
    data?: {
        email_id?: string;
        message_id?: string;
        from?: string;
        subject?: string;
        to?: string[];
        bounce?: {
            diagnosticCode?: string[];
            message?: string;
            subType?: string;
            type?: string; // 'Permanent' | 'Transient'
        };
    };
}

/**
 * Receives Plunk email lifecycle events and advances the matching
 * `email_messages` row's status. Correlation is by `email_id` (Plunk emailId).
 *
 * Idempotent: each update is a plain column write keyed by email_id, so
 * duplicate deliveries of the same event are harmless. Always returns 200 fast
 * (Plunk times out at 10s and does not retry), even for events we don't track
 * or ids we don't recognize.
 */
router.post("/plunk", async (req: Request, res: Response) => {

    if (req.headers['secret'] !== PLUNK_SECRET) {
        return res.status(401).json({message: "Missing Plunk Secret"})
    }

    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    let event: PlunkEmailEvent;
    try {
        event = JSON.parse(raw) as PlunkEmailEvent;
    } catch {
        return res.status(200).send("Ignored");
    }

    const emailId = event.data?.email_id;
    const messageId = event.data?.message_id ?? null;
    if (!emailId) return res.status(200).send("Ignored");

    switch (event.type) {
        case "email.delivered":
            await dbQuery(
                `UPDATE email_messages
                 SET status = 'delivered', delivered_at = now(), message_id = COALESCE($2, message_id), updated_at = now()
                 WHERE email_id = $1 AND status <> 'bounced' AND status <> 'complained'`,
                [emailId, messageId],
            );
            return res.status(200).send("OK");

        case "email.bounced":
            await dbQuery(
                `UPDATE email_messages
                 SET status = 'bounced', bounced_at = now(), bounce_type = $2,
                     message_id = COALESCE($3, message_id), updated_at = now()
                 WHERE email_id = $1`,
                [emailId, event.data?.bounce?.type ?? null, messageId],
            );
            return res.status(200).send("OK");

        case "email.complained":
            await dbQuery(
                `UPDATE email_messages
                 SET status = 'complained', complained_at = now(),
                     message_id = COALESCE($2, message_id), updated_at = now()
                 WHERE email_id = $1`,
                [emailId, messageId],
            );
            return res.status(200).send("OK");

        default:
            return res.status(200).send("Ignored");
    }
});

router.get("/", async (_req: Request, res: Response) => {
    res.status(404).json({ message: "Not Found" });
});

export default router;
