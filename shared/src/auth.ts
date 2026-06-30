export const GOOGLE_CLIENT_ID = '781820057207-eiis3um6r9301ka4iejjv9huju62r5ip.apps.googleusercontent.com';

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

/**
 * Validates a password against minimum requirements.
 * Throws a ValidationError if the password is invalid, returns null if valid.
 */
export function validatePassword(password: string): void {
    if (password.length < 8) throw new ValidationError('Password must be at least 8 characters.');
    if (!/[A-Z]/.test(password)) throw new ValidationError('Password must contain at least one uppercase letter.');
    if (!/[0-9]/.test(password)) throw new ValidationError('Password must contain at least one number.');
}
