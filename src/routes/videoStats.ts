import express from 'express';
import { calculateEngagementRate } from '../utils/engagementRate';
import { getVideoStats } from '../services/youtubeService';
import { oauth2Client } from '../config/google';
import logger from '../utils/logger';

const router = express.Router();

router.get('/video-stats/:videoId', async (req, res) => {
  logger.info(`Request to fetch video stats for video ID: ${req.params.videoId}`);
  try {
    const { videoId } = req.params;
    const accessToken = req.headers.authorization?.split(' ')[1];

    if (!accessToken) {
      logger.warn('Access token is missing.');
      return res.status(401).json({ error: 'Access token is missing' });
    }

    oauth2Client.setCredentials({ access_token: accessToken });
    const video = await getVideoStats(videoId);
    logger.info(`Successfully fetched video stats for video ID: ${videoId}`);

    res.status(200).json({
      title: video.snippet?.title,
      description: video.snippet?.description,
      tags: video.snippet?.tags,
      views: video.statistics?.viewCount,
      likes: video.statistics?.likeCount,
      comments: video.statistics?.commentCount,
      engagementRate: calculateEngagementRate(video.statistics as any),
      stats: video.statistics,
    });
  } catch (error: any) {
    logger.error(`Error fetching video statistics for video ID: ${req.params.videoId}`, error.message);
    const status = error.code === 404 ? 404 : 500;
    res.status(status).json({
      error: error.message || 'Failed to fetch video statistics',
    });
  }
});

export default router;
