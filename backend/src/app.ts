import app from './appService';

import RateLimit from 'express-rate-limit'

const port = process.env.PORT || 3000;

const limiter = RateLimit({
    windowMs:  1000, // 1s
    max: 20, // max 20 requests per windowMs
});

app.use(limiter);


app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});


