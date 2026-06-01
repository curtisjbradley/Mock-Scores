import { createTransport } from 'nodemailer'

const transporter = createTransport({
    host: process.env.SES_SMTP_HOST,
    port: Number(process.env.SES_SMTP_PORT || 465),
    secure: true,
    auth: {
        user: process.env.SES_SMTP_USER,
        pass: process.env.SES_SMTP_PASS,
    },
})

transporter.verify().then(() => console.log('SMTP ready')).catch(console.error)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
    if (!EMAIL_RE.test(to)) throw new Error(`Invalid email address: ${to}`)
    const info = await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to,
        subject,
        html,
        text,
    })
    console.log(`Email sent to ${to} — MessageId: ${info.messageId}`)
}
