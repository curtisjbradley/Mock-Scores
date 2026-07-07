import { Router, Request, Response } from 'express';
import {dbQuery} from "../db";

const router = Router();

interface SESBounce {
    created_at: string,
    data: {
        bounce?: {
            diagnosticCode: string[]
            message: string,
            subType: string,
            type: string,
        },
        created_at: string,
        email_id:string,
        from: string,
        message_id: string,
        subject: string,
        to: string[]
    },
    type: string
}

router.post("/ses-bounce", async (req: Request, res: Response) => {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)



    const sesEvent = JSON.parse(raw) as SESBounce;

    if (sesEvent.type === "email.bounced" && sesEvent?.data?.bounce) {
        for (const recipient of sesEvent.data.to) {
            console.log("Bounced email:", recipient);
            console.log("Bounce type:", sesEvent.data.bounce.type);
            console.log("Bounce subtype:", sesEvent.data.bounce.subType);

            if (sesEvent.data.bounce.type == 'Permanent') {
                dbQuery("Insert into bounced_emails (email,type,subtype) values ($1, $2, $3)", [recipient, sesEvent.data.bounce.type, sesEvent.data.bounce.subType]).then(() => {
                    console.log("Recorded Bounce")
                })
            }
        }
        return res.status(200).send("OK")
    }

    if (sesEvent.type === "email.complained") {
        for (const recipient of sesEvent.data.to) {
            console.log("Complaint email:", recipient);
            dbQuery("Insert into email_complaints (email) values ($1)", [recipient]).then(() => {console.log("Recorded Complaint")})
        }
        return res.status(200).send("OK")
    }

    return res.status(200).send("Ignored");

});

router.get("/", async (req: Request, res: Response) => {
    res.status(404).json({message: "Not Found"});
})

export default router;
