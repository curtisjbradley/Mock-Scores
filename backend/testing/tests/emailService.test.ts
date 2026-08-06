const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
const mockVerify = jest.fn().mockResolvedValue(true)

jest.mock('nodemailer', () => ({
    createTransport: jest.fn(() => ({
        verify: mockVerify,
        sendMail: mockSendMail,
    })),
}))

import { sendEmail } from '../../src/email'

beforeEach(() => jest.clearAllMocks())

describe('sendEmail', () => {
    it('throws for an invalid email address', async () => {
        await expect(sendEmail('not-an-email', 'Subject', '<p>Hi</p>', 'Hi')).rejects.toThrow('Invalid email address')
    })

    it('throws for email missing @', async () => {
        await expect(sendEmail('bademail.com', 'Subject', '<p>Hi</p>', 'Hi')).rejects.toThrow('Invalid email address')
    })

    it('calls sendMail with correct fields for a valid address', async () => {
        mockSendMail.mockResolvedValueOnce({ messageId: 'test-message-id' })
        await sendEmail('user@example.com', 'Hello', '<p>Hello</p>', 'Hello')
        expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'user@example.com',
            subject: 'Hello',
            html: '<p>Hello</p>',
            text: 'Hello',
        }))
    })

    it('logs the messageId on success', async () => {
        mockSendMail.mockResolvedValueOnce({ messageId: 'test-message-id' })
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
        await sendEmail('user@example.com', 'Subject', '<p>Hi</p>', 'Hi')
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test-message-id'))
        consoleSpy.mockRestore()
    })

    it('propagates sendMail errors', async () => {
        mockSendMail.mockRejectedValueOnce(new Error('SMTP failure'))
        await expect(sendEmail('user@example.com', 'Subject', '<p>Hi</p>', 'Hi')).resolves.toBeUndefined()
    })
})
