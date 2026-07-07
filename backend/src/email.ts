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

if (process.env.NODE_ENV !== 'test') {
    transporter.verify().then(() => console.log('SMTP ready')).catch(console.error)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
    if (!EMAIL_RE.test(to)) throw new Error(`Invalid email address: ${to}`)
    const info = await transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, html, text })
    console.log(`Email sent to ${to} — MessageId: ${info.messageId}`)
}

// ── Templates ──────────────────────────────────────────────────────────────────

export interface EmailTemplate { subject: string; html: string; text: string }

const BASE_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')

const layout = (title: string, body: string) => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body { margin: 0; padding: 0; background: #f4f6f9; font-family: sans-serif; color: #1a1a2e; }
  .wrap { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
  .header { background: #1f5eff; padding: 24px 32px; }
  .header h1 { margin: 0; color: #fff; font-size: 20px; }
  .body { padding: 32px; }
  .body p { margin: 0 0 16px; line-height: 1.6; }
  .btn { display: inline-block; margin: 8px 0 16px; padding: 12px 28px; background: #1f5eff; color: #fff !important; text-decoration: none; border-radius: 6px; font-weight: 600; }
  .footer { padding: 16px 32px; font-size: 12px; color: #888; border-top: 1px solid #eee; }
</style></head>
<body><div class="wrap">
  <div class="header"><h1>Mock Scores</h1></div>
  <div class="body">${body}</div>
  <div class="footer">You received this email because you have an account on Mock Scores. If you did not expect this, please ignore it.</div>
</div></body></html>`

export function welcomeEmail(firstName: string): EmailTemplate {
    const subject = 'Welcome to Mock Scores'
    const safeFirstName = escapeHtml(firstName)
    const html = layout(subject, `
        <p>Hi ${safeFirstName},</p>
        <p>Your Mock Scores account has been created. You can now log in and start managing tournaments.</p>
        <a class="btn" href="${BASE_URL}/login">Go to Mock Scores</a>
    `)
    return { subject, html, text: `Hi ${safeFirstName},\n\nYour Mock Scores account has been created.\n\nLog in at: ${BASE_URL}/login` }
}

export function passwordChangedEmail(firstName: string): EmailTemplate {
    const subject = 'Your password has been changed'
    const safeFirstName = escapeHtml(firstName)
    const html = layout(subject, `
        <p>Hi ${safeFirstName},</p>
        <p>Your Mock Scores password was recently changed. If you made this change, no action is needed.</p>
        <p>If you did not change your password, please contact us immediately.</p>
    `)
    return { subject, html, text: `Hi ${safeFirstName},\n\nYour Mock Scores password was recently changed. If you did not do this, please contact us immediately.` }
}

export function organizerAddedEmail(firstName: string, tournamentName: string): EmailTemplate {
    const safeFirstName = escapeHtml(firstName)
    const safeTournamentName = escapeHtml(tournamentName)
    const subject = `You've been added as an organizer for ${safeTournamentName}`
    const html = layout(subject, `
        <p>Hi ${safeFirstName},</p>
        <p>You have been added as an organizer for <strong>${safeTournamentName}</strong>.</p>
        <a class="btn" href="${BASE_URL}/organizer">Go to Dashboard</a>
    `)
    return { subject, html, text: `Hi ${safeFirstName},\n\nYou have been added as an organizer for ${safeTournamentName}.\n\nDashboard: ${BASE_URL}/organizer` }
}


export function coachAddedToTeam(coachName: string, teamName: string, tournamentName: string, teamID: string): EmailTemplate {

    const dashboardURL = `${BASE_URL}/coach/${teamID}`

    const subject = `Added as a coach for ${teamName}`
    const html = layout(subject, `
        <p>Hello ${coachName},</p>
        <p>You have been added as a coach for <strong>${teamName}</strong>. This team is successfully registered to compete at ${tournamentName}.</p>
        <p>You will receive further updates as the tournament progresses.</p>
        <p>In the meantime, feel free to get comfortable with the dashboard, upload your roster, and add more coaches.</p>
        <p>You can view your team dashboard here: <a href=${dashboardURL}>dashboard.</a></p>
    `)
    return { subject, html, text: `Hi,\n\n${teamName} has been registered for ${tournamentName}.\n\nYou will receive further updates as the tournament progresses. You can access the dashboard at ${dashboardURL}` }
}


export function teamAddedEmail(teamName: string, tournamentName: string, teamID:string): EmailTemplate {

    const dashboardURL = `${BASE_URL}/coach/${teamID}`
    const subject = `${teamName} registered for ${tournamentName}`
    const html = layout(subject, `
        <p><strong>${teamName}</strong> has been registered to compete at <strong>${tournamentName}</strong>.</p>
        <p>You will receive further updates as the tournament progresses.</p>
        <p>You can view your team dashboard here: <a href=${dashboardURL}>dashboard.</a></p>
    `)
    return { subject, html, text: `${teamName} has been registered for ${tournamentName}.\n\nYou will receive further updates as the tournament progresses. \n\nYou can view your team dashboard at ${dashboardURL}.` }
}


export function roundResultsPublicEmail(tournamentName: string, roundName: string, standingsUrl: string): EmailTemplate {
    const subject = `Round results published - ${tournamentName}`
    const html = layout(subject, `
        <p>The results for <strong>${roundName}</strong> at <strong>${tournamentName}</strong> have been published.</p>
        <a class="btn" href="${standingsUrl}">View Standings</a>
    `)
    return { subject, html, text: `Results for ${roundName} at ${tournamentName} have been published.\n\nView standings: ${standingsUrl}` }
}

export function conflictReportEmail(
    ownerFirstName: string,
    scorerName: string,
    tournamentName: string,
    roundName: string | null,
    courtroomName: string | null,
): EmailTemplate {
    const safeOwner = escapeHtml(ownerFirstName)
    const safeScorer = escapeHtml(scorerName)
    const safeTournament = escapeHtml(tournamentName)
    const location = [roundName, courtroomName].filter((s): s is string => s != null).map(escapeHtml).join(', ')
    const subject = `Conflict of interest reported — ${safeTournament}`
    const html = layout(subject, `
        <p>Hi ${safeOwner},</p>
        <p>A scorer has reported a conflict of interest at <strong>${safeTournament}</strong>${location ? ` (${location})` : ''}.</p>
        <p><strong>Scorer:</strong> ${safeScorer}</p>
        <p>Please log in to your organizer dashboard to reassign the scorer for this pairing.</p>
        <a class="btn" href="${BASE_URL}/organizer">Go to Dashboard</a>
    `)
    return {
        subject,
        html,
        text: `Hi ${ownerFirstName},\n\nScorer ${scorerName} has reported a conflict of interest at ${tournamentName}${location ? ` (${location})` : ''}.\n\nPlease log in to reassign the scorer: ${BASE_URL}/organizer`,
    }
}

export function scorerInviteEmail(tournamentName: string, scorecardUrl: string): EmailTemplate {
    const subject = `You've been assigned to score at ${tournamentName}`
    const html = layout(subject, `
        <p>You have been assigned as a scorer at <strong>${tournamentName}</strong>.</p>
        <p>Use the link below to access your scorecard:</p>
        <a class="btn" href="${scorecardUrl}">Open Scorecard</a>
        <p>If you have any questions, please contact the tournament organizer.</p>
    `)
    return { subject, html, text: `You have been assigned as a scorer at ${tournamentName}.\n\nOpen your scorecard: ${scorecardUrl}` }
}
