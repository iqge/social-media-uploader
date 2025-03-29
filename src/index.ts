import express, { Request, Response } from 'express';
import multer from 'multer';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

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

async function refreshAccessToken() {
  if (!process.env.REFRESH_TOKEN) {
    throw new Error('No refresh token available');
  }

  oauth2Client.setCredentials({
    refresh_token: process.env.REFRESH_TOKEN,
  });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
    console.log(credentials.access_token);
    return credentials.access_token;
  } catch (error: Error | any) {
    if (error.response && error.response.data.error === 'invalid_grant') {
      console.error(
        'Refresh token is invalid or expired. Re-authenticate the user.'
      );
      throw new Error('Refresh token expired. Re-authenticate the user.');
    } else {
      console.error('Error refreshing access token:', error);
      throw error;
    }
  }
}

const refreshMiddleware = async (req: Request, res: Response, next: any) => {
  const credentials = oauth2Client.credentials;
  // Check if the token is expired or about to expire (e.g., within 5 minutes)
  if (
    !credentials.expiry_date ||
    credentials.expiry_date <= Date.now() + 5 * 60 * 1000
  ) {
    try {
      const newAccessToken = await refreshAccessToken();
      oauth2Client.setCredentials({ access_token: newAccessToken });
    } catch (error: Error | any) {
      if (
        error.message === 'Refresh token expired. Re-authenticate the user.'
      ) {
        return res.redirect('/reauth'); // Redirect to re-authenticate
      } else {
        return res
          .status(401)
          .json({ error: 'Failed to refresh access token' });
      }
    }
  }
  next();
};

app.get('/auth', (req: Request, res: Response) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ],
  });
  res.redirect(authUrl);
});

app.get('/oauth2callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  if (typeof code === 'string') {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    console.log(tokens);
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
  [refreshMiddleware, upload.array('videos')],
  async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results: any[] = [];
    const errors: any[] = [];

    await Promise.all(
      files.map(async (file, index) => {
        try {
          const title = req.body[`title_${index}`];
          const description = req.body[`description_${index}`];
          const tags = req.body[`tags_${index}`]
            ?.split(',')
            .map((tag: string) => tag.trim());
          const publishAt = req.body[`publishAt_${index}`];

          const fileExtension = path.extname(file.originalname).toLowerCase();
          if (!validVideoExtensions.includes(fileExtension)) {
            throw new Error(
              `Invalid video file extension: ${file.originalname}`
            );
          }

          const requestBody: any = {
            snippet: {
              title,
              description,
              tags,
              categoryId: '10', // Default category to Music
            },
            status: {
              privacyStatus: 'private',
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

          results.push(response.data);
        } catch (error: Error | any) {
          console.error(`Error uploading file ${file.originalname}:`, error);
          errors.push({ file: file.originalname, error: error.message });
        }
      })
    );

    res.status(200).json({
      message: 'Upload process completed',
      uploadedVideos: results,
      failedUploads: errors,
    });
  }
);

app.get('/video-stats/:videoId', async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const accessToken = req.headers.authorization?.split(' ')[1];
    if (!accessToken) {
      return res.status(401).json({ error: 'Access token is missing' });
    }

    // Set the access token in the OAuth2 client
    oauth2Client.setCredentials({ access_token: accessToken });

    // Create a new YouTube client with the authenticated OAuth2 client
    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client,
    });

    // Fetch video statistics
    const response = await youtube.videos.list({
      part: ['snippet', 'statistics'],
      id: [videoId],
    });

    if (response.data.items && response.data.items.length > 0) {
      const video = response.data.items[0];
      res.status(200).json({
        title: video.snippet?.title,
        description: video.snippet?.description,
        tags: video.snippet?.tags,
        views: video.statistics?.viewCount,
        likes: video.statistics?.likeCount,
        comments: video.statistics?.commentCount,
        engagementRate: calculateEngagementRate(video.statistics),
        stats: video.statistics,
      });
    } else {
      res.status(404).json({ error: 'Video not found' });
    }
  } catch (error) {
    console.error('Error fetching video statistics:', error);
    res.status(500).json({ error: 'Failed to fetch video statistics' });
  }
});

function calculateEngagementRate(statistics: any) {
  const { likeCount, commentCount, viewCount } = statistics;
  if (!viewCount || viewCount === '0') return 0;
  const likes = parseInt(likeCount, 10) || 0;
  const comments = parseInt(commentCount, 10) || 0;
  const views = parseInt(viewCount, 10);
  return ((likes + comments) / views) * 100;
}

app.use(express.static(path.join(__dirname, 'public')));

// Middleware to refresh the access token if expired
app.use(refreshMiddleware);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
