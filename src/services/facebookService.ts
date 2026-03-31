// services/facebookService.ts - Facebook Page video upload logic
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { metaTokenStore, getGraphApiUrl } from '../config/meta';
import { validVideoExtensions } from '../config/multer';
import logger from '../utils/logger';

type VideoMetadata = {
  title: string;
  description?: string;
  scheduledPublishTime?: string; // ISO date string or Unix timestamp
};

type ScheduleCache = {
  data: Date[];
  timestamp: number;
};

const CACHE_FILE_PATH = path.join(
  __dirname,
  '../../cache/fb-schedule-cache.json'
);
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

/**
 * Upload a video to a Facebook Page.
 * Uses direct upload for files (multipart/form-data).
 * Supports native scheduling via scheduled_publish_time.
 */
export async function uploadPageVideo(
  file: Express.Multer.File,
  metadata: VideoMetadata
): Promise<{ videoId: string; scheduled: boolean }> {
  const pageId = metaTokenStore.pageId;
  const pageToken = metaTokenStore.pageAccessToken;

  if (!pageId) {
    throw new Error(
      'Facebook Page ID not configured. Please authenticate with Meta first.'
    );
  }

  if (!pageToken) {
    throw new Error('No Meta page access token available. Please authenticate first.');
  }

  // Validate file extension
  const fileExtension = path.extname(file.originalname).toLowerCase();
  if (!validVideoExtensions.includes(fileExtension)) {
    throw new Error(`Invalid video file extension: ${file.originalname}`);
  }

  logger.info(
    `Starting Facebook video upload to Page ${pageId}: "${metadata.title}"`
  );

  const url = getGraphApiUrl(`/${pageId}/videos`);

  // Build multipart form data
  const formData = new FormData();
  formData.append('source', fs.createReadStream(file.path), {
    filename: file.originalname,
    contentType: `video/${fileExtension.slice(1)}`,
  });
  formData.append('title', metadata.title);
  formData.append('description', metadata.description || '');
  formData.append('access_token', pageToken);

  // Handle scheduling
  let isScheduled = false;
  if (metadata.scheduledPublishTime) {
    const scheduledTime = new Date(metadata.scheduledPublishTime);
    const unixTimestamp = Math.floor(scheduledTime.getTime() / 1000);

    // Facebook requires scheduled time to be at least 10 minutes in the future
    // and no more than 6 months
    const now = Math.floor(Date.now() / 1000);
    const tenMinutes = 10 * 60;
    const sixMonths = 180 * 24 * 60 * 60;

    if (unixTimestamp < now + tenMinutes) {
      logger.warn(
        'Scheduled time is less than 10 minutes in the future. Publishing immediately.'
      );
    } else if (unixTimestamp > now + sixMonths) {
      throw new Error(
        'Scheduled time cannot be more than 6 months in the future.'
      );
    } else {
      formData.append('published', 'false');
      formData.append('scheduled_publish_time', String(unixTimestamp));
      isScheduled = true;
      logger.info(
        `Video scheduled for: ${scheduledTime.toISOString()} (Unix: ${unixTimestamp})`
      );
    }
  }

  const response = await axios.post(url, formData, {
    headers: {
      ...formData.getHeaders(),
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  if (!response.data.id) {
    throw new Error(
      `Failed to upload video: ${JSON.stringify(response.data)}`
    );
  }

  const videoId = response.data.id;
  logger.info(
    `Facebook video uploaded successfully! Video ID: ${videoId}${isScheduled ? ' (scheduled)' : ''}`
  );

  // Clear schedule cache after upload
  clearFbScheduleCache();

  return { videoId, scheduled: isScheduled };
}

/**
 * Get insights for a Facebook video
 */
export async function getVideoInsights(
  videoId: string
): Promise<Record<string, any>> {
  const pageToken = metaTokenStore.pageAccessToken;

  if (!pageToken) {
    throw new Error('No Meta page access token available.');
  }

  const url = getGraphApiUrl(`/${videoId}`, {
    fields:
      'title,description,length,views,likes.summary(true),comments.summary(true)',
    access_token: pageToken,
  });

  const response = await axios.get(url);
  const data = response.data;

  return {
    title: data.title || '',
    description: data.description || '',
    length: data.length || 0,
    views: data.views || 0,
    likes: data.likes?.summary?.total_count || 0,
    comments: data.comments?.summary?.total_count || 0,
  };
}

/**
 * Fetch scheduled posts from a Facebook Page
 */
export async function getScheduledPosts(): Promise<Date[]> {
  const pageId = metaTokenStore.pageId;
  const pageToken = metaTokenStore.pageAccessToken;

  if (!pageId || !pageToken) {
    throw new Error('Facebook Page not configured. Please authenticate first.');
  }

  // Try cache first
  const cached = readFbScheduleCache();
  if (cached) {
    return cached.data;
  }

  const url = getGraphApiUrl(`/${pageId}/scheduled_posts`, {
    fields: 'scheduled_publish_time,message,created_time',
    access_token: pageToken,
  });

  try {
    const response = await axios.get(url);
    const posts = response.data.data || [];

    const scheduledDates: Date[] = posts
      .filter((post: any) => post.scheduled_publish_time)
      .map(
        (post: any) =>
          new Date(parseInt(post.scheduled_publish_time) * 1000)
      )
      .sort((a: Date, b: Date) => a.getTime() - b.getTime());

    // Write to cache
    writeFbScheduleCache(scheduledDates);

    logger.info(`Found ${scheduledDates.length} scheduled Facebook posts`);
    return scheduledDates;
  } catch (error: any) {
    logger.error(`Error fetching scheduled posts: ${error.message}`);
    return [];
  }
}

// ── Cache helpers ──────────────────────────────────────────────────────

function ensureCacheDirectory() {
  const cacheDir = path.dirname(CACHE_FILE_PATH);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
}

function readFbScheduleCache(): ScheduleCache | null {
  try {
    if (!fs.existsSync(CACHE_FILE_PATH)) return null;

    const content = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
    const cache: ScheduleCache = JSON.parse(content);
    cache.data = cache.data.map((d) => new Date(d));

    if (Date.now() - cache.timestamp < CACHE_DURATION) {
      logger.info('Using cached Facebook schedule data');
      return cache;
    }

    return null;
  } catch {
    return null;
  }
}

function writeFbScheduleCache(data: Date[]) {
  try {
    ensureCacheDirectory();
    const cache: ScheduleCache = { data, timestamp: Date.now() };
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cache, null, 2));
  } catch (error) {
    logger.error('Error writing Facebook schedule cache:', error);
  }
}

export function clearFbScheduleCache() {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      fs.unlinkSync(CACHE_FILE_PATH);
      logger.info('Facebook schedule cache cleared');
    }
  } catch (error) {
    logger.error('Error clearing Facebook schedule cache:', error);
  }
}
