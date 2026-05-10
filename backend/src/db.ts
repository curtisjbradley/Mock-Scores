import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const db = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PWD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

export default db;
