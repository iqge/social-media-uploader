// index.ts
import express from 'express';
import path from 'path';
import authRouter from './routes/auth';
import uploadRouter from './routes/upload';
import videoStatsRouter from './routes/videoStats';
import { refreshMiddleware } from './middleware/auth';

const app = express();
const port = process.env.PORT || 3001;

app.use(express.static(path.join(__dirname, 'public')));
app.use(refreshMiddleware);

// Routes
app.use('/', authRouter);
app.use('/', uploadRouter);
app.use('/', videoStatsRouter);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
