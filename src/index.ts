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
  upload.array('videos'),
  async (req: Request, res: Response) => {
    try {
      const { access_token } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      oauth2Client.setCredentials({ access_token });

      const uploadPromises = files.map(async (file, index) => {
        const title = req.body[`title_${index}`];
        const description = req.body[`description_${index}`];
        const tags = req.body[`tags_${index}`]
          ?.split(',')
          .map((tag: string) => tag.trim());
        const publishAt = req.body[`publishAt_${index}`];

        const fileExtension = path.extname(file.originalname).toLowerCase();
        if (!validVideoExtensions.includes(fileExtension)) {
          throw new Error('Invalid video file extension');
        }

        const requestBody: any = {
          snippet: {
            title,
            description,
            tags,
            categoryId: '10', // Default category to Music
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
            body: fs.createReadStream(file.path),
          },
        });

        return response.data;
      });

      const results = await Promise.all(uploadPromises);

      res.status(200).json({
        message: 'Videos uploaded successfully',
        videos: results,
      });
    } catch (error) {
      console.error('Error uploading videos:', error);
      res.status(500).json({ error: 'Failed to upload videos' });
    }
  }
);

app.use(express.static(path.join(__dirname, 'public')));

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
