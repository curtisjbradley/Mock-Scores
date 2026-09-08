import request from 'supertest'
import testApp from '../../src/appService'
import { dbQuery } from '../../src/db'

// email.ts sends via Plunk fetch; stub fetch so importing the app doesn't fire real sends.
global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as unknown as Response)

const mockDbQuery = dbQuery as jest.MockedFunction<typeof dbQuery>

beforeEach(() => {
    jest.clearAllMocks()
    mockDbQuery.mockResolvedValue({ rows: [], rowCount: 1 } as never)
})

const post = (body: object) =>
    request(testApp).post('/webhooks/plunk').set('Content-Type', 'text/plain').send(JSON.stringify(body))

describe('POST /webhooks/plunk', () => {
    it('marks the email delivered on email.delivered', async () => {
        const res = await post({ type: 'email.delivered', data: { email_id: 'e-1', message_id: 'm-1' } })
        expect(res.status).toBe(200)
        expect(res.text).toBe('OK')
        const [sql, params] = mockDbQuery.mock.calls[0]
        expect(sql).toContain("status = 'delivered'")
        expect(params).toEqual(['e-1', 'm-1'])
    })

    it('marks the email bounced with bounce type on email.bounced', async () => {
        const res = await post({
            type: 'email.bounced',
            data: { email_id: 'e-2', message_id: 'm-2', bounce: { type: 'Permanent', subType: 'General' } },
        })
        expect(res.status).toBe(200)
        const [sql, params] = mockDbQuery.mock.calls[0]
        expect(sql).toContain("status = 'bounced'")
        expect(params).toEqual(['e-2', 'Permanent', 'm-2'])
    })

    it('marks the email complained on email.complained', async () => {
        const res = await post({ type: 'email.complained', data: { email_id: 'e-3', message_id: 'm-3' } })
        expect(res.status).toBe(200)
        const [sql, params] = mockDbQuery.mock.calls[0]
        expect(sql).toContain("status = 'complained'")
        expect(params).toEqual(['e-3', 'm-3'])
    })

    it('ignores events with no email_id', async () => {
        const res = await post({ type: 'email.delivered', data: {} })
        expect(res.status).toBe(200)
        expect(res.text).toBe('Ignored')
        expect(mockDbQuery).not.toHaveBeenCalled()
    })

    it('ignores unknown event types', async () => {
        const res = await post({ type: 'email.opened', data: { email_id: 'e-4' } })
        expect(res.status).toBe(200)
        expect(res.text).toBe('Ignored')
        expect(mockDbQuery).not.toHaveBeenCalled()
    })

    it('ignores malformed JSON', async () => {
        const res = await request(testApp).post('/webhooks/plunk').set('Content-Type', 'text/plain').send('not json')
        expect(res.status).toBe(200)
        expect(res.text).toBe('Ignored')
        expect(mockDbQuery).not.toHaveBeenCalled()
    })
})
