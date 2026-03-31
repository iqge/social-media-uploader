// routes/instagramUpload.ts - Instagram Reels upload routes
import express, { Request, Response } from 'express';
import { upload } from '../config/multer';
import { metaAuthMiddleware } from '../middleware/metaAuth';
import {
  uploadReel,
  getMediaInsights,
  buildTempVideoUrl,
} from '../services/instagramService';
import fs from 'fs';
import path from 'path';
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

// Helper to copy file to temp-media directory for public serving
const copyToTempMedia = (file: Express.Multer.File): string => {
  const tempMediaDir = path.join(__dirname, '../../temp-media');
  if (!fs.existsSync(tempMediaDir)) {
    fs.mkdirSync(tempMediaDir, { recursive: true });
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const tempFilename = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
  const destPath = path.join(tempMediaDir, tempFilename);

  fs.copyFileSync(file.path, destPath);
  return tempFilename;
};

// Helper to cleanup temp-media file
const cleanupTempMedia = (filename: string) => {
  try {
    const filePath = path.join(__dirname, '../../temp-media', filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted temp-media file: ${filePath}`);
    }
  } catch (error) {
    console.error(`Failed to delete temp-media file:`, error);
  }
};

/**
 * POST /instagram/upload - Upload video(s) as Instagram Reels
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

    logger.info(`Starting Instagram upload of ${files.length} video(s)...`);

    const tempMediaFiles: string[] = [];

    try {
      for (const [index, file] of files.entries()) {
        let tempFilename = '';
        try {
          // Copy file to temp-media for public serving
          tempFilename = copyToTempMedia(file);
          tempMediaFiles.push(tempFilename);

          const videoUrl = buildTempVideoUrl(tempFilename);

          const caption = (req.body[`caption_${index}`] as string) || '';
          const shareToFeed = req.body[`shareToFeed_${index}`] !== 'false';

          logger.info(
            `Uploading Reel ${index + 1}/${files.length}: "${caption.substring(0, 50)}..."`
          );

          const result = await uploadReel(videoUrl, {
            caption,
            shareToFeed,
          });

          results.push({
            index,
            mediaId: result.mediaId,
            permalink: result.permalink,
            filename: file.originalname,
          });

          logger.info(
            `Reel ${index + 1} uploaded successfully. Media ID: ${result.mediaId}`
          );
        } catch (error: any) {
          logger.error(`Error uploading Reel ${index + 1}: ${error.message}`);
          errors.push({
            file: file.originalname,
            error: error.message,
          });
        } finally {
          // Cleanup temp-media file after Instagram has fetched it
          // Add a delay to ensure Instagram has had time to fetch the video
          if (tempFilename) {
            setTimeout(() => cleanupTempMedia(tempFilename), 60000); // 1 minute delay
          }
        }
      }

      res.status(200).json({
        message: 'Instagram upload process completed',
        platform: 'instagram',
        uploadedReels: results,
        failedUploads: errors,
        successCount: results.length,
        failureCount: errors.length,
        note: 'Instagram does not support scheduling. All videos are published immediately.',
      });
    } finally {
      // Cleanup original upload files
      cleanupTempFiles(files);
    }
  }
);

/**
 * GET /instagram/media-stats/:mediaId - Get Reel insights
 */
router.get(
  '/media-stats/:mediaId',
  metaAuthMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { mediaId } = req.params;
      logger.info(`Fetching Instagram media insights for: ${mediaId}`);

      const insights = await getMediaInsights(mediaId);

      res.status(200).json({
        mediaId,
        insights,
      });
    } catch (error: any) {
      logger.error(`Error fetching media insights: ${error.message}`);
      res.status(500).json({
        error: error.message || 'Failed to fetch media insights',
      });
    }
  }
);

export default router;
