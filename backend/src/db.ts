import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import {
    SecretsManagerClient,
    GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

function requireEnv(name: string): string {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
}

const DB_HOST = requireEnv('DB_HOST');
const DB_PORT = Number(requireEnv('DB_PORT'));
const DB_NAME = requireEnv('DB_NAME');
const DB_USER = requireEnv('DB_USER');
const DB_SSL = requireEnv('DB_SSL') === 'true';

const USE_AWS_SECRET = requireEnv('USE_AWS_SECRET') === 'true';

if (Number.isNaN(DB_PORT)) {
    throw new Error('DB_PORT must be a valid number');
}

let password: string | (() => Promise<string>);

if (USE_AWS_SECRET) {
    const AWS_REGION = requireEnv('AWS_REGION');
    const DB_SECRET_ID = requireEnv('DB_SECRET_ID');

    const secretsManager = new SecretsManagerClient({
        region: AWS_REGION,
    });

    password = async () => {
        const response = await secretsManager.send(
            new GetSecretValueCommand({
                SecretId: DB_SECRET_ID,
            }),
        );

        if (!response.SecretString) {
            throw new Error(
                `Secret ${DB_SECRET_ID} does not contain SecretString`,
            );
        }

        const secret = JSON.parse(response.SecretString) as {
            password?: string;
        };

        if (!secret.password) {
            throw new Error(
                `Secret ${DB_SECRET_ID} does not contain a password`,
            );
        }

        return secret.password;
    };
} else {
    password = requireEnv('DB_PWD');
}

const db = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password,
    ssl: DB_SSL
        ? { rejectUnauthorized: false }
        : false,

    maxLifetimeSeconds: 300,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
});

db.on('error', err => {
    console.error('Unexpected DB pool error:', err.message);
});

db.connect()
    .then(client => {
        console.log(`DB connected: ${DB_NAME}@${DB_HOST}`);
        client.release();
    })
    .catch(err => {
        console.error(`DB connection failed: ${err.message}`);
        process.exit(1);
    });

export async function dbQuery<
    T extends QueryResultRow = QueryResultRow
>(
    sql: string,
    params?: unknown[],
) {
    try {
        return db.query<T>(sql, params);
    } catch (err) {
        console.error('DB query error:', (err as Error).message, { sql });
        return null;
    }
}

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
            console.error(
                'DB rollback error:',
                (rollbackErr as Error).message,
            );
        }

        throw err;
    } finally {
        client.release();
    }
}
