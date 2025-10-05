// index.ts

import express from 'express';
import path from 'path';
import authRouter from './routes/auth';
import uploadRouter from './routes/upload';
import videoStatsRouter from './routes/videoStats';
import { refreshMiddleware } from './middleware/auth';
import { loggingMiddleware } from './middleware/logging';

const app = express();
const port = process.env.PORT || 3001;

app.use(loggingMiddleware);
app.use(express.static(path.join(__dirname, 'public')));

// Auth routes DON'T need the refresh middleware (they handle auth themselves)
app.use('/', authRouter);

// Other routes DO need the refresh middleware
app.use(refreshMiddleware);
app.use('/', uploadRouter);
app.use('/', videoStatsRouter);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
