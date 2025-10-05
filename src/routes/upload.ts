// routes/upload.ts
import express, { Request, Response } from 'express';
import { upload } from '../config/multer';
import { refreshMiddleware } from '../middleware/auth';
import { uploadVideo, getScheduledVideos } from '../services/youtubeService';
import path from 'path';
import logger from '../utils/logger';

const router = express.Router();

router.get('/upload-form', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../public', 'index.html'));
});

// Route: Get existing schedule (used by frontend for conflict checking)
router.get(
  '/existing-schedule',
  refreshMiddleware,
  async (req: Request, res: Response) => {
    try {
      const scheduledVideos = await getScheduledVideos();
      logger.info('Successfully fetched existing schedule.');
      res.status(200).json({
        count: scheduledVideos.length,
        scheduledDates: scheduledVideos,
      });
    } catch (error: any) {
      logger.error('Error fetching schedule:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
);

router.post(
  '/upload',
  [refreshMiddleware, upload.array('videos')],
  async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    const results = [];
    const errors = [];
    const ageRestrictedVideos = [];

    if (!files?.length) {
      logger.warn('No files uploaded.');
      return res.status(400).json({ error: 'No files uploaded' });
    }

    logger.info(`Processing ${files.length} files for upload.`);

    // Upload videos with their pre-calculated times from frontend
    for (const [index, file] of files.entries()) {
      try {
        logger.info(
          `Processing file ${index + 1} of ${files.length}: ${file.originalname}`
        );
        const metadata = {
          title: req.body[`title_${index}`] as string,
          description: req.body[`description_${index}`] as string | undefined,
          tags: req.body[`tags_${index}`]
            ?.split(',')
            .map((t: string) => t.trim()),
          publishAt: req.body[`publishAt_${index}`] as string | undefined,
          is18Plus: req.body[`is18Plus_${index}`] === 'on',
          categoryId: '10',
        };

        const response = await uploadVideo(file, metadata);
        results.push(response);
        logger.info(`Successfully uploaded file: ${file.originalname}`);

        // Track 18+ videos for manual age restriction warning
        if (metadata.is18Plus && response.id) {
          ageRestrictedVideos.push({
            title: metadata.title,
            videoId: response.id,
            editUrl: `https://studio.youtube.com/video/${response.id}/edit`,
          });
        }
      } catch (error: any) {
        logger.error(
          `Error uploading file ${file.originalname}:`,
          error.message
        );
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

    logger.info('Upload process response:', responseData);
    res.status(200).json(responseData);
  }
);

export default router;
