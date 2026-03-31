// routes/facebookUpload.ts - Facebook Page video upload routes
import express, { Request, Response } from 'express';
import { upload } from '../config/multer';
import { metaAuthMiddleware } from '../middleware/metaAuth';
import {
  uploadPageVideo,
  getVideoInsights,
  getScheduledPosts,
  clearFbScheduleCache,
} from '../services/facebookService';
import fs from 'fs';
import logger from '../utils/logger';

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

/**
 * POST /facebook/upload - Upload video(s) to Facebook Page
 * Supports native scheduling via scheduled_publish_time
 */
router.post(
  '/upload',
  [metaAuthMiddleware, upload.array('videos')],
  async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    const results: any[] = [];
    const errors: any[] = [];

    if (!files?.length) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    logger.info(`Starting Facebook upload of ${files.length} video(s)...`);

    try {
      for (const [index, file] of files.entries()) {
        try {
          const metadata = {
            title: (req.body[`title_${index}`] as string) || '',
            description: req.body[`description_${index}`] as string | undefined,
            scheduledPublishTime: req.body[`publishAt_${index}`] as
              | string
              | undefined,
          };

          logger.info(
            `Uploading Facebook video ${index + 1}/${files.length}: "${metadata.title}"`
          );

          const result = await uploadPageVideo(file, metadata);

          results.push({
            index,
            videoId: result.videoId,
            scheduled: result.scheduled,
            title: metadata.title,
            filename: file.originalname,
          });

          logger.info(
            `Facebook video ${index + 1} uploaded successfully. Video ID: ${result.videoId}`
          );
        } catch (error: any) {
          logger.error(
            `Error uploading Facebook video ${index + 1}: ${error.message}`
          );
          errors.push({
            file: file.originalname,
            error: error.message,
          });
        }
      }

      res.status(200).json({
        message: 'Facebook upload process completed',
        platform: 'facebook',
        uploadedVideos: results,
        failedUploads: errors,
        successCount: results.length,
        failureCount: errors.length,
      });
    } finally {
      // Always cleanup temp files
      cleanupTempFiles(files);
    }
  }
);

/**
 * GET /facebook/existing-schedule - Fetch scheduled Facebook Page posts
 */
router.get(
  '/existing-schedule',
  metaAuthMiddleware,
  async (req: Request, res: Response) => {
    try {
      const forceRefresh = req.query.refresh === 'true';

      if (forceRefresh) {
        clearFbScheduleCache();
      }

      const scheduledDates = await getScheduledPosts();

      res.status(200).json({
        count: scheduledDates.length,
        scheduledDates,
        cached: !forceRefresh,
      });
    } catch (error: any) {
      logger.error(`Error fetching Facebook schedule: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /facebook/video-stats/:videoId - Get Facebook video insights
 */
router.get(
  '/video-stats/:videoId',
  metaAuthMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { videoId } = req.params;
      logger.info(`Fetching Facebook video stats for: ${videoId}`);

      const stats = await getVideoInsights(videoId);

      res.status(200).json({
        videoId,
        ...stats,
      });
    } catch (error: any) {
      logger.error(`Error fetching Facebook video stats: ${error.message}`);
      res.status(500).json({
        error: error.message || 'Failed to fetch video statistics',
      });
    }
  }
);

export default router;
