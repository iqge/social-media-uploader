import { youtube } from '../config/google';
import { validVideoExtensions } from '../config/multer';
import fs from 'fs';
import path from 'path';

type VideoMetadata = {
  title: string;
  description?: string;
  tags?: string[];
  publishAt?: string;
  is18Plus?: boolean;
  categoryId: string;
};

type ScheduleCache = {
  data: Date[];
  timestamp: number;
};

// Cache configuration
const CACHE_FILE_PATH = path.join(__dirname, '../../cache/schedule-cache.json');
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Ensure cache directory exists
const ensureCacheDirectory = () => {
  const cacheDir = path.dirname(CACHE_FILE_PATH);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
};

// Read cache from file
const readCache = (): ScheduleCache | null => {
  try {
    if (!fs.existsSync(CACHE_FILE_PATH)) {
      return null;
    }

    const cacheContent = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
    const cache: ScheduleCache = JSON.parse(cacheContent);

    // Convert ISO strings back to Date objects
    cache.data = cache.data.map((dateStr) => new Date(dateStr));

    // Check if cache is still valid
    if (Date.now() - cache.timestamp < CACHE_DURATION) {
      console.log('Using cached schedule data from file');
      return cache;
    }

    return null;
  } catch (error) {
    console.error('Error reading cache:', error);
    return null;
  }
};

// Write cache to file
const writeCache = (data: Date[]) => {
  try {
    ensureCacheDirectory();

    const cache: ScheduleCache = {
      data,
      timestamp: Date.now(),
    };

    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cache, null, 2));
    console.log('Schedule cache written to file');
  } catch (error) {
    console.error('Error writing cache:', error);
  }
};

// Clear cache (useful for forcing refresh)
export const clearScheduleCache = () => {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      fs.unlinkSync(CACHE_FILE_PATH);
      console.log('Schedule cache cleared');
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

export const uploadVideo = async (
  file: Express.Multer.File,
  metadata: VideoMetadata
) => {
  const fileExtension = path.extname(file.originalname).toLowerCase();
  if (!validVideoExtensions.includes(fileExtension)) {
    throw new Error(`Invalid video file extension: ${file.originalname}`);
  }

  const requestBody: any = {
    snippet: {
      title: metadata.title,
      description: metadata.description || '',
      tags: metadata.tags,
      categoryId: metadata.categoryId,
    },
    status: {
      privacyStatus: 'private',
      selfDeclaredMadeForKids: false,
      ...(metadata.publishAt && {
        publishAt: new Date(metadata.publishAt).toISOString(),
      }),
    },
  };

  if (metadata.is18Plus) {
    requestBody.status.madeForKids = false;
    requestBody.contentDetails = {
      contentRating: {
        ytRating: 'ytAgeRestricted',
      },
    };
  }

  const response = await youtube.videos.insert({
    part: ['snippet', 'status', 'contentDetails'],
    requestBody,
    media: {
      body: fs.createReadStream(file.path),
      mimeType: `video/${fileExtension.slice(1)}`,
    },
  });

  // Clear cache after upload since schedule has changed
  clearScheduleCache();

  return response.data;
};

export const getVideoStats = async (videoId: string) => {
  const response = await youtube.videos.list({
    part: ['snippet', 'statistics'],
    id: [videoId],
  });

  if (!response.data.items?.length) {
    const error = new Error('Video not found');
    (error as any).code = 404;
    throw error;
  }

  return response.data.items[0];
};

// Fetch ALL scheduled videos from YouTube API with full pagination
const fetchScheduledVideosFromAPI = async (): Promise<Date[]> => {
  const scheduledVideos: Date[] = [];

  try {
    // Step 1: Get channel info (1 quota unit)
    const channelResponse = await youtube.channels.list({
      part: ['contentDetails'],
      mine: true,
    });

    if (!channelResponse.data.items?.length) {
      throw new Error('No channel found for authenticated user');
    }

    const uploadsPlaylistId =
      channelResponse.data.items[0].contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
      return [];
    }

    // Step 2: Paginate through ALL videos in the uploads playlist
    // playlistItems.list costs 1 quota unit per request, videos.list costs 1 per request
    // This is much cheaper than search.list (100 units per request)
    let pageToken: string | undefined = undefined;
    let totalFetched = 0;
    // Track consecutive pages with zero scheduled videos to stop early
    // when we've passed through all recent/scheduled content
    let consecutivePagesWithNoScheduled = 0;
    const MAX_EMPTY_PAGES = 3; // Stop after 3 consecutive pages with no scheduled videos

    // Use while(true) with explicit breaks to avoid TypeScript circular reference issues
    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const playlistResponse: any = await youtube.playlistItems.list({
        part: ['contentDetails', 'status'],
        playlistId: uploadsPlaylistId,
        maxResults: 50,
        pageToken,
      });

      const items = playlistResponse.data.items as any[] | undefined;
      if (!items || items.length === 0) break;

      const videoIds: string[] = [];
      for (const item of items) {
        const videoId = item.contentDetails?.videoId;
        if (videoId) {
          videoIds.push(videoId as string);
        }
      }

      let foundScheduledOnThisPage = false;

      if (videoIds.length > 0) {
        // Step 3: Get video details in batch (1 quota unit per 50 videos)
        // Request both status and snippet to get publishAt and upload date
        const videosResponse = await youtube.videos.list({
          part: ['status', 'snippet'],
          id: videoIds,
        });

        if (videosResponse.data.items) {
          for (const video of videosResponse.data.items) {
            // Check for scheduled (private with publishAt) videos
            const publishAtStr = video.status?.publishAt;
            if (publishAtStr) {
              const publishDate = new Date(publishAtStr);
              if (publishDate > new Date()) {
                scheduledVideos.push(publishDate);
                foundScheduledOnThisPage = true;
                console.log(
                  `Found scheduled video: "${video.snippet?.title}" → ${publishDate.toISOString()}`
                );
              }
            }
          }
        }
      }

      totalFetched += items.length;
      const nextPageToken: string | null | undefined =
        playlistResponse.data.nextPageToken;
      pageToken = nextPageToken ? nextPageToken : undefined;

      // Track consecutive empty pages to avoid fetching entire back-catalog
      if (foundScheduledOnThisPage) {
        consecutivePagesWithNoScheduled = 0;
      } else {
        consecutivePagesWithNoScheduled++;
      }

      console.log(
        `Fetched page: ${items.length} videos (total: ${totalFetched}), ` +
          `scheduled found so far: ${scheduledVideos.length}, ` +
          `empty pages streak: ${consecutivePagesWithNoScheduled}`
      );

      // Stop if we've had too many consecutive pages without scheduled videos
      // This prevents scanning thousands of old published videos
      if (
        consecutivePagesWithNoScheduled >= MAX_EMPTY_PAGES &&
        totalFetched > 50
      ) {
        console.log(
          `Stopping pagination after ${MAX_EMPTY_PAGES} consecutive pages with no scheduled videos`
        );
        break;
      }

      // No more pages
      if (!pageToken) break;
    }

    console.log(
      `Total scheduled videos found: ${scheduledVideos.length} (scanned ${totalFetched} videos)`
    );

    // Sort dates in ascending order
    return scheduledVideos.sort((a, b) => a.getTime() - b.getTime());
  } catch (error: any) {
    console.error('Error fetching scheduled videos:', error.message || error);
    // Return empty array instead of throwing to avoid blocking uploads
    return [];
  }
};

// Main function with caching
export const getScheduledVideos = async (
  forceRefresh: boolean = false
): Promise<Date[]> => {
  // Try to use cache first
  if (!forceRefresh) {
    const cachedData = readCache();
    if (cachedData) {
      return cachedData.data;
    }
  }

  console.log('Fetching scheduled videos from YouTube API...');

  // Fetch fresh data from API
  const scheduledVideos = await fetchScheduledVideosFromAPI();

  // Write to cache
  writeCache(scheduledVideos);

  return scheduledVideos;
};

// Quota-efficient version: No backend calculation needed
// Frontend handles all schedule distribution
export const calculateSafePublishTimes = async (
  requestedTimes: Date[],
  minGapDays: number = 1
): Promise<Date[]> => {
  // This function is deprecated - frontend handles scheduling now
  // Keeping for backward compatibility
  console.warn(
    'calculateSafePublishTimes is deprecated. Use frontend scheduling instead.'
  );
  return requestedTimes;
};
