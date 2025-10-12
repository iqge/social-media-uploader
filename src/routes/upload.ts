// routes/upload.ts
import express, { Request, Response } from 'express';
import { upload } from '../config/multer';
import { refreshMiddleware } from '../middleware/auth';
import {
  uploadVideo,
  getScheduledVideos,
  clearScheduleCache,
} from '../services/youtubeService';
import path from 'path';
import fs from 'fs';
import { oauth2Client } from '../config/google';

const router = express.Router();

// Helper function to delete temporary files
const cleanupTempFiles = (files: Express.Multer.File[]) => {
  files.forEach((file) => {
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
        console.log(`Deleted temp file: ${file.path}`);
      }
    } catch (error) {
      console.error(`Failed to delete temp file ${file.path}:`, error);
    }
  });
};

router.get('/upload-form', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../public', 'index.html'));
});

// Route: Get existing schedule (uses file cache by default)
router.get(
  '/existing-schedule',
  refreshMiddleware,
  async (req: Request, res: Response) => {
    try {
      // Check if force refresh is requested via query parameter
      const forceRefresh = req.query.refresh === 'true';

      const scheduledVideos = await getScheduledVideos(forceRefresh);

      res.status(200).json({
        count: scheduledVideos.length,
        scheduledDates: scheduledVideos,
        cached: !forceRefresh,
      });
    } catch (error: any) {
      console.error('Error fetching schedule:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Route: Clear schedule cache (useful for debugging or forced refresh)
router.post(
  '/clear-cache',
  refreshMiddleware,
  async (req: Request, res: Response) => {
    try {
      clearScheduleCache();
      res.status(200).json({ message: 'Cache cleared successfully' });
    } catch (error: any) {
      console.error('Error clearing cache:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

router.post(
  '/upload',
  [refreshMiddleware, upload.array('videos')],
  async (req: Request, res: Response) => {
    console.log('Upload handler - credentials:', {
      hasAccessToken: !!oauth2Client.credentials?.access_token,
      hasRefreshToken: !!oauth2Client.credentials?.refresh_token,
      expiryDate: oauth2Client.credentials?.expiry_date,
    });

    const files = req.files as Express.Multer.File[];
    const results = [];
    const errors = [];
    const ageRestrictedVideos = [];

    if (!files?.length) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log(`Starting upload of ${files.length} video(s)...`);

    try {
      // Upload videos with their pre-calculated times from frontend
      for (const [index, file] of files.entries()) {
        try {
          const metadata = {
            title: req.body[`title_${index}`] as string,
            description: req.body[`description_${index}`] as string | undefined,
            tags: req.body[`tags_${index}`]
              ?.split(',')
              .map((t: string) => t.trim())
              .filter((t: string) => t.length > 0),
            publishAt: req.body[`publishAt_${index}`] as string | undefined,
            is18Plus: req.body[`is18Plus_${index}`] === 'on',
            categoryId: '10',
          };

          console.log(`Uploading video ${index + 1}: ${metadata.title}`);

          const response = await uploadVideo(file, metadata);
          results.push(response);

          console.log(
            `Video ${index + 1} uploaded successfully. ID: ${response.id}`
          );

          // Track 18+ videos for manual age restriction warning
          if (metadata.is18Plus && response.id) {
            ageRestrictedVideos.push({
              title: metadata.title,
              videoId: response.id,
              editUrl: `https://studio.youtube.com/video/${response.id}/edit`,
            });
          }
        } catch (error: any) {
          console.error(`Error uploading video ${index + 1}:`, error.message);
          errors.push({
            file: file.originalname,
            error: error.message,
          });
        }
      }

      const responseData: any = {
        message: 'Upload process completed',
        uploadedVideos: results,
        failedUploads: errors,
        successCount: results.length,
        failureCount: errors.length,
      };

      // Add warning for 18+ videos
      if (ageRestrictedVideos.length > 0) {
        responseData.warning = {
          count: ageRestrictedVideos.length,
          message:
            'Videos marked as 18+ require manual age restriction in YouTube Studio',
          instructions: [
            'Open each video link in YouTube Studio',
            'Go to "Age restriction" section',
            'Select "Yes, restrict my video to viewers over 18"',
            'Save changes',
          ],
          videos: ageRestrictedVideos,
        };
      }

      console.log(
        `Upload complete. Success: ${results.length}, Failed: ${errors.length}`
      );

      res.status(200).json(responseData);
    } finally {
      // Always cleanup temp files, even if upload fails
      console.log('Cleaning up temporary files...');
      cleanupTempFiles(files);
    }
  }
);

export default router;
