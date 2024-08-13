import express, { Request, Response } from 'express';
import multer from 'multer';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const port = 3000;

// Set up multer for file upload
const upload = multer({ dest: 'uploads/' });

// Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

const youtube = google.youtube({
  version: 'v3',
  auth: oauth2Client,
});

const validVideoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv'];

app.get('/auth', (req: Request, res: Response) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/youtube.upload'],
  });
  res.redirect(authUrl);
});

app.get('/oauth2callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  if (typeof code === 'string') {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    res.redirect(`/upload-form?access_token=${tokens.access_token}`);
  } else {
    res.status(400).send('Invalid code');
  }
});

app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/upload-form', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post(
  '/upload',
  upload.single('video'),
  async (req: Request, res: Response) => {
    try {
      const { title, description, access_token, publishAt } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { path: filePath, originalname, mimetype } = file;

      const fileExtension = path.extname(originalname).toLowerCase();
      if (!validVideoExtensions.includes(fileExtension)) {
        return res.status(400).json({ error: 'Invalid video file extension' });
      }

      oauth2Client.setCredentials({ access_token });

      const requestBody: any = {
        snippet: {
          title,
          description,
        },
        status: {
          privacyStatus: 'private', // Set to private initially if scheduling
        },
      };

      if (publishAt) {
        requestBody.status.publishAt = new Date(publishAt).toISOString();
      }

      const response = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody,
        media: {
          body: fs.createReadStream(filePath),
        },
      });

      if (response.data) {
        res.status(200).json({
          message: 'Video uploaded successfully',
          videoId: response.data.id,
        });
      } else {
        console.error('Error uploading video:', res);
        res.status(500).json({ error: 'Failed to upload video' });
      }
    } catch (error) {
      console.error('Error uploading video:', error);
      res.status(500).json({ error: 'Failed to upload video' });
    }
  }
);

app.use(express.static(path.join(__dirname, 'public')));

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
