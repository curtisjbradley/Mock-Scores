import request from 'supertest'
// webhookRouter reads PLUNK_WEBHOOK_SECRET at module load; setup.ts sets it before this import.
import testApp from '../../src/appService'
import { dbQuery } from '../../src/db'

// email.ts sends via Plunk fetch; stub fetch so importing the app doesn't fire real sends.
global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as unknown as Response)

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>

const SECRET = process.env.PLUNK_WEBHOOK_SECRET as string

beforeEach(() => {
    jest.clearAllMocks()
    mockDbQuery.mockResolvedValue({ rows: [], rowCount: 1 } as never)
})

// Plunk delivers the default payload envelope: { contact, workflow, execution, event }.
// The `event` object carries emailId/messageId plus a lifecycle-specific timestamp
// (deliveredAt / bouncedAt / complainedAt) that discriminates the event type.
const post = (event: object) =>
    request(testApp)
        .post('/webhooks/plunk')
        .set('Content-Type', 'text/plain')
        .set('secret', SECRET)
        .send(JSON.stringify({ event }))

describe('POST /webhooks/plunk', () => {
    it('rejects requests without the shared secret', async () => {
        const res = await request(testApp)
            .post('/webhooks/plunk')
            .set('Content-Type', 'text/plain')
            .send(JSON.stringify({ event: { emailId: 'e-1', deliveredAt: '2025-01-15T10:30:05.000Z' } }))
        expect(res.status).toBe(401)
        expect(mockDbQuery).not.toHaveBeenCalled()
    })

    it('marks the email delivered on a delivery event', async () => {
        const res = await post({ emailId: 'e-1', messageId: 'm-1', deliveredAt: '2025-01-15T10:30:05.000Z' })
        expect(res.status).toBe(200)
        expect(res.text).toBe('OK')
        const [sql, params] = mockDbQuery.mock.calls[0]
        expect(sql).toContain("status = 'delivered'")
        expect(params).toEqual(['e-1', 'm-1'])
    })

    it('marks the email bounced with bounce type on a bounce event', async () => {
        const res = await post({ emailId: 'e-2', messageId: 'm-2', bounceType: 'Permanent', bouncedAt: '2025-01-15T10:31:00.000Z' })
        expect(res.status).toBe(200)
        const [sql, params] = mockDbQuery.mock.calls[0]
        expect(sql).toContain("status = 'bounced'")
        expect(params).toEqual(['e-2', 'Permanent', 'm-2'])
    })

    it('marks the email complained on a complaint event', async () => {
        const res = await post({ emailId: 'e-3', messageId: 'm-3', complainedAt: '2025-01-15T10:35:00.000Z' })
        expect(res.status).toBe(200)
        const [sql, params] = mockDbQuery.mock.calls[0]
        expect(sql).toContain("status = 'complained'")
        expect(params).toEqual(['e-3', 'm-3'])
    })

    it('ignores events with no emailId', async () => {
        const res = await post({ deliveredAt: '2025-01-15T10:30:05.000Z' })
        expect(res.status).toBe(200)
        expect(res.text).toBe('Ignored')
        expect(mockDbQuery).not.toHaveBeenCalled()
    })

    it('ignores events with no tracked lifecycle field (e.g. sent/open/click)', async () => {
        const res = await post({ emailId: 'e-4', openedAt: '2025-01-15T11:00:00.000Z', opens: 1 })
        expect(res.status).toBe(200)
        expect(res.text).toBe('Ignored')
        expect(mockDbQuery).not.toHaveBeenCalled()
    })

    it('ignores malformed JSON', async () => {
        const res = await request(testApp)
            .post('/webhooks/plunk')
            .set('Content-Type', 'text/plain')
            .set('secret', SECRET)
            .send('not json')
        expect(res.status).toBe(200)
        expect(res.text).toBe('Ignored')
        expect(mockDbQuery).not.toHaveBeenCalled()
    })
})
