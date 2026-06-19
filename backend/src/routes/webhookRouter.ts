import { Router, Request, Response } from 'express';
import {dbQuery} from "../db";

const router = Router();

interface SNSBase {
    Type: string
    SubscribeURL?: string
    Message: string
}

interface SESRecipient {
    emailAddress: string
}

interface SESBounce {
    bounceType: string
    bounceSubType: string
    bouncedRecipients: SESRecipient[]
    timestamp: string
}

interface SESComplaint {
    complainedRecipients: SESRecipient[]
    timestamp: string
}

interface SESEvent {
    notificationType: 'Bounce' | 'Complaint' | 'Delivery'
    bounce?: SESBounce
    complaint?: SESComplaint
}

router.post("/ses-bounce", async (req: Request, res: Response) => {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    const snsMessage = JSON.parse(raw) as SNSBase;


    if (snsMessage.Type === "Notification") {
        const sesEvent = JSON.parse(snsMessage.Message) as SESEvent;

        if (sesEvent.notificationType === "Bounce" && sesEvent.bounce) {
            const { bounce } = sesEvent;
            for (const recipient of bounce.bouncedRecipients) {
                console.log("Bounced email:", recipient.emailAddress);
                console.log("Bounce type:", bounce.bounceType);
                console.log("Bounce subtype:", bounce.bounceSubType);
                dbQuery("Insert into bounced_emails (email,type,subtype) values ($1, $2, $3)", [recipient.emailAddress, bounce.bounceType, bounce.bounceSubType]).then(() => {console.log("Recorded Bounce")})
            }
        }

        if (sesEvent.notificationType === "Complaint" && sesEvent.complaint) {
            for (const recipient of sesEvent.complaint.complainedRecipients) {
                console.log("Complaint email:", recipient.emailAddress);
                dbQuery("Insert into email_complaints (email) values ($1)", [recipient.emailAddress]).then(() => {console.log("Recorded Complaint")})
            }
        }

        return res.status(200).send("OK");
    }

    res.status(200).send("Ignored");
});

router.get("/", async (req: Request, res: Response) => {
    res.status(404).json({message: "Not Found"});
})

export default router;
