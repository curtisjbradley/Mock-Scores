// Manual mock for email module - prevents real emails from being sent during tests
import type { EmailTemplate } from '../../src/email';

const stubTemplate = (): EmailTemplate => ({ subject: '', html: '', text: '' });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email: string): boolean { return EMAIL_RE.test(email); }

export const sendEmail = jest.fn().mockResolvedValue(undefined);
export const welcomeEmail = jest.fn(stubTemplate);
export const passwordChangedEmail = jest.fn(stubTemplate);
export const passwordResetEmail = jest.fn(stubTemplate);
export const organizerAddedEmail = jest.fn(stubTemplate);
export const coachAddedToTeam = jest.fn(stubTemplate);
export const teamAddedEmail = jest.fn(stubTemplate);
export const roundResultsPublicEmail = jest.fn(stubTemplate);
export const scorerInviteEmail = jest.fn(stubTemplate);
export const emailVerificationEmail = jest.fn(stubTemplate);
export const conflictReportEmail = jest.fn(stubTemplate);
