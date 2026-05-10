import express, { Request, Response } from "express";
import path from "path";
import dotenv from 'dotenv';
import authRouter from './routes/auth';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const STATIC_DIR = path.resolve(__dirname, "../../frontend/dist");
const PUBLIC_DIR = path.resolve(__dirname, "../../frontend/public");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/api/auth', authRouter);

app.use(express.static(PUBLIC_DIR));
app.use(express.static(STATIC_DIR));

app.get(/(.*)/, (_req: Request, res: Response) => {
    res.sendFile(path.join(STATIC_DIR, "index.html"));
});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});