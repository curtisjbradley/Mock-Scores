import express from "express";
import {IHelpParams} from "@mock-scores/shared";
import {authedHandler} from "../types/handlers";
import {escapeHtml, sendEmail} from "../email";

const router = express.Router();

const feedbackMaintainer = process.env.MAINTAINER_EMAIL ?? "curtisbradley822@gmail.com";

router.post("/", authedHandler(async (req, res) => {
    const {requestType, description} = req.body as IHelpParams;

    if (!description) {
        return res.status(400).json({message: "No description provided."})
    }
    if (!requestType) {
        return res.status(400).json({message: "No report type provided."})
    }
    const sender = req.session;

    const emailBody = `<div>
    <h1>Issue Request Received</h1>
    <p>From: ${sender.firstName} ${sender.lastName} - ${sender.email}</p>
    <p><strong>Issue Type: </strong> ${requestType}</p>
    <p><strong>Description: </strong> ${description}</p>
    </div>`

    try {
        await sendEmail(feedbackMaintainer, "Issue Request Created", emailBody, escapeHtml(emailBody))
        return res.status(201).json({message: `Request type ${requestType} created`})
    } catch (err) {
       return res.status(500).json(err)
    }
}));





export default router;