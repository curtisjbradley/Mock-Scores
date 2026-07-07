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

// ─── Bounce (Permanent) ───────────────────────────────────────────────────────
describe('POST /webhooks/ses-bounce — email.bounced (Permanent)', () => {
    it('returns 200 and inserts a bounced_emails row', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
        const event = {
            type: 'email.bounced',
            created_at: new Date().toISOString(),
            data: {
                created_at: new Date().toISOString(),
                email_id: 'email-001',
                from: 'noreply@example.com',
                message_id: 'msg-001',
                subject: 'Test',
                to: ['bad@example.com'],
                bounce: {
                    diagnosticCode: ['smtp; 550 user unknown'],
                    message: 'user unknown',
                    subType: 'General',
                    type: 'Permanent',
                },
            },
        }
        const res = await post(event)
        expect(res.status).toBe(200)
        expect(res.text).toBe('OK')
        expect(consoleSpy).toHaveBeenCalledWith('Bounced email:', 'bad@example.com')
        expect(consoleSpy).toHaveBeenCalledWith('Bounce type:', 'Permanent')
        expect(consoleSpy).toHaveBeenCalledWith('Bounce subtype:', 'General')
        expect(mockDbQuery).toHaveBeenCalledWith(
            'Insert into bounced_emails (email,type,subtype) values ($1, $2, $3)',
            ['bad@example.com', 'Permanent', 'General'],
        )
        consoleSpy.mockRestore()
    })
})

// ─── Bounce (non-Permanent) ───────────────────────────────────────────────────
describe('POST /webhooks/ses-bounce — email.bounced (Transient)', () => {
    it('returns 200 but does NOT insert into bounced_emails', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
        const event = {
            type: 'email.bounced',
            created_at: new Date().toISOString(),
            data: {
                created_at: new Date().toISOString(),
                email_id: 'email-002',
                from: 'noreply@example.com',
                message_id: 'msg-002',
                subject: 'Test',
                to: ['soft@example.com'],
                bounce: {
                    diagnosticCode: [],
                    message: 'mailbox full',
                    subType: 'MailboxFull',
                    type: 'Transient',
                },
            },
        }
        const res = await post(event)
        expect(res.status).toBe(200)
        expect(res.text).toBe('OK')
        expect(mockDbQuery).not.toHaveBeenCalled()
        consoleSpy.mockRestore()
    })
})

// ─── Complaint ────────────────────────────────────────────────────────────────
describe('POST /webhooks/ses-bounce — email.complained', () => {
    it('returns 200 and inserts an email_complaints row', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
        const event = {
            type: 'email.complained',
            created_at: new Date().toISOString(),
            data: {
                created_at: new Date().toISOString(),
                email_id: 'email-003',
                from: 'noreply@example.com',
                message_id: 'msg-003',
                subject: 'Test',
                to: ['spam@example.com'],
            },
        }
        const res = await post(event)
        expect(res.status).toBe(200)
        expect(res.text).toBe('OK')
        expect(consoleSpy).toHaveBeenCalledWith('Complaint email:', 'spam@example.com')
        expect(mockDbQuery).toHaveBeenCalledWith(
            'Insert into email_complaints (email) values ($1)',
            ['spam@example.com'],
        )
        consoleSpy.mockRestore()
    })
})

// ─── Multiple recipients ──────────────────────────────────────────────────────
describe('POST /webhooks/ses-bounce — multiple recipients', () => {
    it('inserts a row for each bounced recipient', async () => {
        jest.spyOn(console, 'log').mockImplementation()
        const event = {
            type: 'email.bounced',
            created_at: new Date().toISOString(),
            data: {
                created_at: new Date().toISOString(),
                email_id: 'email-004',
                from: 'noreply@example.com',
                message_id: 'msg-004',
                subject: 'Test',
                to: ['a@example.com', 'b@example.com'],
                bounce: {
                    diagnosticCode: [],
                    message: 'unknown',
                    subType: 'General',
                    type: 'Permanent',
                },
            },
        }
        const res = await post(event)
        expect(res.status).toBe(200)
        expect(mockDbQuery).toHaveBeenCalledTimes(2)
        expect(mockDbQuery).toHaveBeenCalledWith(
            'Insert into bounced_emails (email,type,subtype) values ($1, $2, $3)',
            ['a@example.com', 'Permanent', 'General'],
        )
        expect(mockDbQuery).toHaveBeenCalledWith(
            'Insert into bounced_emails (email,type,subtype) values ($1, $2, $3)',
            ['b@example.com', 'Permanent', 'General'],
        )
    })
})

// ─── Unknown type ─────────────────────────────────────────────────────────────
describe('POST /webhooks/ses-bounce — unknown event type', () => {
    it('returns 200 with Ignored', async () => {
        const res = await post({ type: 'email.opened', data: {} })
        expect(res.status).toBe(200)
        expect(res.text).toBe('Ignored')
        expect(mockDbQuery).not.toHaveBeenCalled()
    })
})
