jest.mock('../../src/types/handlers', () => ({
    authedHandler: (handler: any) => (req: any, res: any, next: any) => {
        req.session = {
            userId: 'user-1',
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
        };
        return Promise.resolve(handler(req, res, next)).catch(next);
    },
}));

jest.mock('../../src/email', () => ({
    sendEmail: jest.fn(),
    escapeHtml: jest.fn((value: string) => `escaped:${value}`),
}));

import express from 'express';
import request from 'supertest';
import router from '../../src/routes/requestHelpRoutes';
import { escapeHtml, sendEmail } from '../../src/email';

const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;
const mockEscapeHtml = escapeHtml as jest.MockedFunction<typeof escapeHtml>;

const app = express();
app.use(express.json());
app.use('/help', router);

beforeEach(() => {
    jest.resetAllMocks();
    mockSendEmail.mockResolvedValue(null);
    mockEscapeHtml.mockImplementation((value: string) => `escaped:${value}`);
});

describe('POST /help', () => {
    it('returns 400 when description is missing', async () => {
        const res = await request(app)
            .post('/help')
            .send({ requestType: 'bug' });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: 'No description provided.' });
        expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('returns 400 when request type is missing', async () => {
        const res = await request(app)
            .post('/help')
            .send({ description: 'Something is wrong.' });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: 'No report type provided.' });
        expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('emails the maintainer and returns 201', async () => {
        const res = await request(app)
            .post('/help')
            .send({ requestType: 'bug', description: 'The ballot page is broken.' });

        expect(res.status).toBe(201);
        expect(res.body).toEqual({ message: 'Request type bug created' });
        expect(mockSendEmail).toHaveBeenCalledTimes(1);

        const [recipient, subject, html, text] = mockSendEmail.mock.calls[0];
        expect(recipient).toBe(process.env.MAINTAINER_EMAIL ?? 'curtisbradley822@gmail.com');
        expect(subject).toBe('Issue Request Created');
        expect(html).toContain('Test User - test@example.com');
        expect(html).toContain('<strong>Issue Type: </strong> bug');
        expect(html).toContain('<strong>Description: </strong> The ballot page is broken.');
        expect(mockEscapeHtml).toHaveBeenCalledWith(html);
        expect(text).toBe(`escaped:${html}`);
    });

    it('returns 500 when sending the email fails', async () => {
        mockSendEmail.mockRejectedValueOnce(new Error('mail unavailable'));

        const res = await request(app)
            .post('/help')
            .send({ requestType: 'question', description: 'Please help.' });

        expect(res.status).toBe(500);
        expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });
});
