import express from 'express';
import { calculateEngagementRate } from '../utils/engagementRate';
import { getVideoStats } from '../services/youtubeService';
import { oauth2Client } from '../config/google';

const router = express.Router();

router.get('/video-stats/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const accessToken = req.headers.authorization?.split(' ')[1];

    if (!accessToken) {
      return res.status(401).json({ error: 'Access token is missing' });
    }

    oauth2Client.setCredentials({ access_token: accessToken });
    const video = await getVideoStats(videoId);

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
    console.error('Error fetching video statistics:', error);
    const status = error.code === 404 ? 404 : 500;
    res.status(status).json({
      error: error.message || 'Failed to fetch video statistics',
    });
  }
});

export default router;
