import { Pool } from 'pg';

const db = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PWD,
    ssl: (process.env.DB_SSL ?? (process.env.NODE_ENV === 'production' ? 'true' : 'false')) === 'true'
        ? { rejectUnauthorized: false }
        : false,
});

db.connect()
    .then(client => {
        console.log(`DB connected: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
        client.release();
    })
    .catch(err => {
        console.error(`DB connection failed: ${err.message}`);
        process.exit(1);
    });

export default db;

import type { PoolClient, QueryResultRow } from 'pg';

/** Runs a parameterized query and returns the result, or null on error. */
export async function dbQuery<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
) {
    try {
        return await db.query<T>(sql, params);
    } catch (err) {
        console.error('DB query error:', (err as Error).message, { sql });
        return null;
    }
}

/**
 * Runs `work` inside a single database transaction on one dedicated pooled
 * client. Commits if `work` resolves, rolls back if it throws.
 *
 * Unlike {@link dbQuery}, this does NOT swallow errors: any error thrown by
 * `work` (including raw `pg` errors such as unique-constraint violations,
 * `code === '23505'`) is re-thrown after rollback so callers can inspect it.
 * The client is always released back to the pool.
 */
export async function withTransaction<T>(
    work: (client: PoolClient) => Promise<T>,
): Promise<T> {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackErr) {
            console.error('DB rollback error:', (rollbackErr as Error).message);
        }
        throw err;
    } finally {
        client.release();
    }
}
