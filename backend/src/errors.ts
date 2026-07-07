/** Thrown when a DB query returns null (connection or query failure). */
export class DbError extends Error {
    constructor(context?: string) {
        super(context ? `Database error: ${context}` : 'Database error');
    }
}

/** Thrown when an insert would create a duplicate (team name, delegate, conflict, etc.). */
export class AlreadyExistsError extends Error {
    constructor(context?: string) {
        super(context ?? 'Resource already exists');
    }
}

/** Thrown when a record to update or delete cannot be found. */
export class NotFoundError extends Error {
    constructor(context?: string) {
        super(context ?? 'Resource not found');
    }
}

export class ImproperDataError extends Error {
    constructor(context?: string) {
        super(context ?? 'Improper data structure.');
    }
}

/** Thrown when trying to edit an organizer who has already joined (cannot modify live account). */
export class OrganizerAlreadyJoinedError extends Error {}

/** Thrown when a scorer tries to access a scoresheet for an assignment that already has a submitted ballot. */
export class AlreadySubmittedError extends Error {
    constructor() { super('Ballot already submitted'); }
}

/** Thrown when a scorer tries to access a scoresheet after reporting a conflict of interest. */
export class ConflictReportedError extends Error {
    constructor() { super('Conflict of interest reported'); }
}

// Legacy aliases kept for any existing catch blocks that reference the old names.
export const DuplicateDelegateError = AlreadyExistsError;
export const DuplicateTeamNameError = AlreadyExistsError;
