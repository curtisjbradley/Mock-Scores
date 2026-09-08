// The Plunk webhook route captures PLUNK_WEBHOOK_SECRET at module load. Set it here
// (before any test file imports appService) so webhook tests can authenticate.
process.env.PLUNK_WEBHOOK_SECRET = process.env.PLUNK_WEBHOOK_SECRET ?? 'test-webhook-secret';

jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(console, 'log').mockImplementation(() => {});
