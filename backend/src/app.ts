import express from "express";
import path from "path";

const app = express();
const port = 3000;

const STATIC_DIR = path.resolve(__dirname, "../../frontend/dist");
const PUBLIC_DIR = path.resolve(__dirname, "../../frontend/public");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(PUBLIC_DIR));
app.use(express.static(STATIC_DIR));

app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(STATIC_DIR, "index.html"));
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});