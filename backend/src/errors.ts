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

/** Thrown when trying to edit an organizer who has already joined (cannot modify live account). */
export class OrganizerAlreadyJoinedError extends Error {}

// Legacy aliases kept for any existing catch blocks that reference the old names.
export const DuplicateDelegateError = AlreadyExistsError;
export const DuplicateTeamNameError = AlreadyExistsError;
