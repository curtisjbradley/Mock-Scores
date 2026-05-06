import express = require("express");

const app = express()
const port = 443
const STATIC_DIR = '../frontend/dist'


app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(STATIC_DIR));

app.get('/', (req , res ) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})