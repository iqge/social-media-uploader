// routes/upload.ts
import express, { Request, Response } from 'express';
import { upload } from '../config/multer';
import { refreshMiddleware } from '../middleware/auth';
import { uploadVideo, getScheduledVideos } from '../services/youtubeService';
import path from 'path';

const router = express.Router();

router.get('/upload-form', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../public', 'index.html'));
});

// Route: Get existing schedule (used by frontend for conflict checking)
router.get('/existing-schedule', refreshMiddleware, async (req: Request, res: Response) => {
  try {
    const scheduledVideos = await getScheduledVideos();
    res.status(200).json({
      count: scheduledVideos.length,
      scheduledDates: scheduledVideos,
    });
  } catch (error: any) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post(
  '/upload',
  [refreshMiddleware, upload.array('videos')],
  async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    const results = [];
    const errors = [];

    if (!files?.length) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Upload videos with their pre-adjusted times from frontend
    for (const [index, file] of files.entries()) {
      try {
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
      } catch (error: any) {
        errors.push({
          file: file.originalname,
          error: error.message,
        });
      }
    }

    res.status(200).json({
      message: 'Upload process completed',
      uploadedVideos: results,
      failedUploads: errors,
    });
  }
);

export default router;
