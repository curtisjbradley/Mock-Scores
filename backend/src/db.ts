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
