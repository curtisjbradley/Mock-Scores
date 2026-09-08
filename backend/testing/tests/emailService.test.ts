// email.ts sends via Plunk's HTTP API using the global fetch and records tracked
// sends via dbQuery. Mock both so we can assert send behaviour without network/DB.
jest.mock('../../src/db', () => ({
    dbQuery: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
}))

import { sendEmail } from '../../src/email'

const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

const okResponse = (emailId: string | null) => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: { emails: [{ email: emailId }] } }),
})

beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockResolvedValue(okResponse('plunk-email-id'))
})

describe('sendEmail', () => {
    it('throws for an invalid email address', async () => {
        await expect(sendEmail('not-an-email', 'Subject', '<p>Hi</p>', 'Hi')).rejects.toThrow('Invalid email address')
    })

    it('throws for email missing @', async () => {
        await expect(sendEmail('bademail.com', 'Subject', '<p>Hi</p>', 'Hi')).rejects.toThrow('Invalid email address')
    })

    it('POSTs to Plunk with the correct fields for a valid address', async () => {
        await sendEmail('user@example.com', 'Hello', '<p>Hello</p>', 'Hello')
        expect(mockFetch).toHaveBeenCalledTimes(1)
        const [, init] = mockFetch.mock.calls[0]
        expect(init.method).toBe('POST')
        const body = JSON.parse(init.body as string)
        expect(body).toEqual(expect.objectContaining({
            to: 'user@example.com',
            subject: 'Hello',
            body: '<p>Hello</p>',
            text: 'Hello',
        }))
    })

    it('returns the Plunk emailId on success', async () => {
        const id = await sendEmail('user@example.com', 'Subject', '<p>Hi</p>', 'Hi')
        expect(id).toBe('plunk-email-id')
    })

    it('returns null (does not throw) when the Plunk request fails', async () => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
        await expect(sendEmail('user@example.com', 'Subject', '<p>Hi</p>', 'Hi')).resolves.toBeNull()
    })

    it('returns null (does not throw) when fetch rejects', async () => {
        mockFetch.mockRejectedValueOnce(new Error('network down'))
        await expect(sendEmail('user@example.com', 'Subject', '<p>Hi</p>', 'Hi')).resolves.toBeNull()
    })
})
