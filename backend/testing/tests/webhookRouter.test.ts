import request from 'supertest'
import testApp from '../../src/appService'
import { dbQuery } from '../../src/db'

jest.mock('nodemailer', () => ({
    createTransport: jest.fn(() => ({
        verify: jest.fn().mockResolvedValue(true),
        sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-id' }),
    })),
}))

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>
global.fetch = jest.fn().mockResolvedValue({} as Response)

beforeEach(() => {
    jest.clearAllMocks()
    mockDbQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any)
})

const post = (body: object) =>
    request(testApp).post('/webhooks/ses-bounce').set('Content-Type', 'text/plain').send(JSON.stringify(body))

// ─── SubscriptionConfirmation ─────────────────────────────────────────────────
describe('POST /webhooks/ses-bounce — SubscriptionConfirmation', () => {
    it('fetches the SubscribeURL and returns 200', async () => {
        const res = await post({ Type: 'SubscriptionConfirmation', SubscribeURL: 'https://sns.aws/confirm' })
        expect(res.status).toBe(200)
        expect(res.text).toBe('Subscription confirmed')
        expect(fetch).toHaveBeenCalledWith('https://sns.aws/confirm')
    })
})

// ─── Notification — Bounce ────────────────────────────────────────────────────
describe('POST /webhooks/ses-bounce — Bounce notification', () => {
    it('returns 200 and logs bounced recipients', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
        const message = JSON.stringify({
            notificationType: 'Bounce',
            bounce: {
                bounceType: 'Permanent',
                bounceSubType: 'General',
                bouncedRecipients: [{ emailAddress: 'bad@example.com' }],
                timestamp: new Date().toISOString(),
            },
        })
        const res = await post({ Type: 'Notification', Message: message })
        expect(res.status).toBe(200)
        expect(res.text).toBe('OK')
        expect(consoleSpy).toHaveBeenCalledWith('Bounced email:', 'bad@example.com')
        consoleSpy.mockRestore()
    })
})

// ─── Notification — Complaint ─────────────────────────────────────────────────
describe('POST /webhooks/ses-bounce — Complaint notification', () => {
    it('returns 200 and logs complained recipients', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
        const message = JSON.stringify({
            notificationType: 'Complaint',
            complaint: {
                complainedRecipients: [{ emailAddress: 'spam@example.com' }],
                timestamp: new Date().toISOString(),
            },
        })
        const res = await post({ Type: 'Notification', Message: message })
        expect(res.status).toBe(200)
        expect(consoleSpy).toHaveBeenCalledWith('Complaint email:', 'spam@example.com')
        consoleSpy.mockRestore()
    })
})

// ─── Unknown type ─────────────────────────────────────────────────────────────
describe('POST /webhooks/ses-bounce — unknown type', () => {
    it('returns 200 with Ignored', async () => {
        const res = await post({ Type: 'UnknownType' })
        expect(res.status).toBe(200)
        expect(res.text).toBe('Ignored')
    })
})
