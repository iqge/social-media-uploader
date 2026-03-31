// index.ts

import express from 'express';
import path from 'path';
import authRouter from './routes/auth';
import metaAuthRouter from './routes/metaAuth';
import uploadRouter from './routes/upload';
import instagramUploadRouter from './routes/instagramUpload';
import facebookUploadRouter from './routes/facebookUpload';
import videoStatsRouter from './routes/videoStats';
import { refreshMiddleware } from './middleware/auth';
import { loggingMiddleware } from './middleware/logging';

const app = express();
const port = process.env.PORT || 3001;

app.use(loggingMiddleware);
app.use(express.static(path.join(__dirname, 'public')));

// Serve temp-media files for Instagram Reels upload (requires public URL)
app.use('/temp-media', express.static(path.join(__dirname, '../temp-media')));

// Auth routes DON'T need the refresh middleware (they handle auth themselves)
app.use('/', authRouter);
app.use('/meta', metaAuthRouter);

// YouTube routes need Google refresh middleware
app.use(refreshMiddleware);
app.use('/', uploadRouter);
app.use('/', videoStatsRouter);

// Instagram & Facebook routes use their own metaAuth middleware (applied in route files)
app.use('/instagram', instagramUploadRouter);
app.use('/facebook', facebookUploadRouter);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
