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

// Function: Get all scheduled videos from the channel (for frontend conflict checking)
export const getScheduledVideos = async () => {
  const scheduledVideos: Date[] = [];
  let pageToken: string | undefined = undefined;

  try {
    // Get the channel ID first
    const channelResponse = await youtube.channels.list({
      part: ['contentDetails'],
      mine: true,
    });

    if (!channelResponse.data.items?.length) {
      throw new Error('No channel found for authenticated user');
    }

    // Fetch all videos from the channel
    do {
      const response = await youtube.search.list({
        part: ['snippet'],
        forMine: true,
        type: ['video'],
        maxResults: 50,
        pageToken,
      });

      if (response.data.items) {
        const videoIds = response.data.items
          .map(item => item.id?.videoId)
          .filter((id): id is string => !!id);

        if (videoIds.length > 0) {
          // Get detailed info including publish status
          const videosResponse = await youtube.videos.list({
            part: ['status', 'snippet'],
            id: videoIds,
          });

          if (videosResponse.data.items) {
            for (const video of videosResponse.data.items) {
              // Check if video is scheduled (has publishAt date in the future)
              if (video.status?.publishAt) {
                const publishDate = new Date(video.status.publishAt);
                if (publishDate > new Date()) {
                  scheduledVideos.push(publishDate);
                }
              }
            }
          }
        }
      }

      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    // Sort dates in ascending order
    return scheduledVideos.sort((a, b) => a.getTime() - b.getTime());
  } catch (error: any) {
    console.error('Error fetching scheduled videos:', error);
    throw new Error(`Failed to fetch scheduled videos: ${error.message}`);
  }
};

// New function: Calculate safe publish times avoiding conflicts
export const calculateSafePublishTimes = (
  requestedTimes: Date[],
  minGapDays: number = 1
): Promise<Date[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      const existingSchedule = await getScheduledVideos();
      const allScheduledDates = [...existingSchedule];
      const safeTimes: Date[] = [];
      const minGapMs = minGapDays * 24 * 60 * 60 * 1000;

      for (const requestedTime of requestedTimes) {
        let adjustedTime = new Date(requestedTime);
        let attempts = 0;
        const maxAttempts = 100;

        while (attempts < maxAttempts) {
          let hasConflict = false;

          // Check against all scheduled dates (existing + newly calculated)
          for (const scheduledDate of allScheduledDates) {
            const timeDiff = Math.abs(adjustedTime.getTime() - scheduledDate.getTime());
            
            if (timeDiff < minGapMs) {
              hasConflict = true;
              // Move the time forward past the conflict
              adjustedTime = new Date(scheduledDate.getTime() + minGapMs);
              break;
            }
          }

          if (!hasConflict) {
            safeTimes.push(new Date(adjustedTime));
            allScheduledDates.push(new Date(adjustedTime));
            break;
          }

          attempts++;
        }

        if (attempts >= maxAttempts) {
          console.warn(`Could not find conflict-free time for ${requestedTime}, using adjusted time anyway`);
          safeTimes.push(adjustedTime);
          allScheduledDates.push(adjustedTime);
        }
      }

      resolve(safeTimes);
    } catch (error) {
      reject(error);
    }
  });
};