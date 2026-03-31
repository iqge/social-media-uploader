// services/instagramService.ts - Instagram Reels upload logic
import axios from 'axios';
import {
  metaTokenStore,
  getGraphApiUrl,
  PUBLIC_BASE_URL,
} from '../config/meta';
import logger from '../utils/logger';

type ReelOptions = {
  caption: string;
  shareToFeed?: boolean;
  coverUrl?: string;
};

type MediaStatus = 'IN_PROGRESS' | 'FINISHED' | 'ERROR' | 'EXPIRED';

const POLL_INTERVAL_MS = 5000; // 5 seconds
const MAX_POLL_ATTEMPTS = 60; // 5 minutes max wait

/**
 * Upload a video as an Instagram Reel using the two-phase process:
 * 1. Create media container with video URL
 * 2. Poll for processing completion
 * 3. Publish the media
 */
export async function uploadReel(
  videoUrl: string,
  options: ReelOptions
): Promise<{ mediaId: string; permalink: string | null }> {
  const igUserId = metaTokenStore.instagramBusinessAccountId;
  const accessToken = metaTokenStore.pageAccessToken;

  if (!igUserId) {
    throw new Error(
      'Instagram Business Account ID not configured. Please authenticate with Meta first.'
    );
  }

  if (!accessToken) {
    throw new Error(
      'No Meta access token available. Please authenticate first.'
    );
  }

  logger.info(`Starting Instagram Reel upload for IG user: ${igUserId}`);

  // Phase 1: Create media container
  const creationId = await createMediaContainer(
    igUserId,
    accessToken,
    videoUrl,
    options
  );

  logger.info(`Media container created: ${creationId}`);

  // Phase 2: Wait for processing
  await waitForProcessing(creationId, accessToken);

  logger.info('Video processing complete, publishing...');

  // Phase 3: Publish
  const mediaId = await publishMedia(igUserId, accessToken, creationId);

  logger.info(`Reel published successfully! Media ID: ${mediaId}`);

  // Try to get permalink
  let permalink: string | null = null;
  try {
    permalink = await getMediaPermalink(mediaId, accessToken);
  } catch {
    logger.warn('Could not fetch permalink for published Reel');
  }

  return { mediaId, permalink };
}

/**
 * Phase 1: Create a media container for the Reel
 */
async function createMediaContainer(
  igUserId: string,
  accessToken: string,
  videoUrl: string,
  options: ReelOptions
): Promise<string> {
  const url = getGraphApiUrl(`/${igUserId}/media`);

  const params: Record<string, any> = {
    media_type: 'REELS',
    video_url: videoUrl,
    caption: options.caption,
    access_token: accessToken,
  };

  if (options.shareToFeed !== undefined) {
    params.share_to_feed = options.shareToFeed;
  }

  if (options.coverUrl) {
    params.cover_url = options.coverUrl;
  }

  const response = await axios.post(url, null, { params });

  if (!response.data.id) {
    throw new Error(
      `Failed to create media container: ${JSON.stringify(response.data)}`
    );
  }

  return response.data.id;
}

/**
 * Phase 2: Poll for video processing completion
 */
async function waitForProcessing(
  creationId: string,
  accessToken: string
): Promise<void> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const status = await checkMediaStatus(creationId, accessToken);

    logger.info(
      `Processing status (attempt ${attempt + 1}/${MAX_POLL_ATTEMPTS}): ${status}`
    );

    if (status === 'FINISHED') {
      return;
    }

    if (status === 'ERROR') {
      throw new Error(
        'Instagram video processing failed. The video may be in an unsupported format or too large.'
      );
    }

    if (status === 'EXPIRED') {
      throw new Error(
        'Instagram media container expired. The upload took too long.'
      );
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Video processing timed out after ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000} seconds`
  );
}

/**
 * Check the processing status of a media container
 */
async function checkMediaStatus(
  creationId: string,
  accessToken: string
): Promise<MediaStatus> {
  const url = getGraphApiUrl(`/${creationId}`, {
    fields: 'status_code',
    access_token: accessToken,
  });

  const response = await axios.get(url);
  return response.data.status_code as MediaStatus;
}

/**
 * Phase 3: Publish the processed media
 */
async function publishMedia(
  igUserId: string,
  accessToken: string,
  creationId: string
): Promise<string> {
  const url = getGraphApiUrl(`/${igUserId}/media_publish`);

  const response = await axios.post(url, null, {
    params: {
      creation_id: creationId,
      access_token: accessToken,
    },
  });

  if (!response.data.id) {
    throw new Error(
      `Failed to publish media: ${JSON.stringify(response.data)}`
    );
  }

  return response.data.id;
}

/**
 * Get the permalink for a published media item
 */
async function getMediaPermalink(
  mediaId: string,
  accessToken: string
): Promise<string> {
  const url = getGraphApiUrl(`/${mediaId}`, {
    fields: 'permalink',
    access_token: accessToken,
  });

  const response = await axios.get(url);
  return response.data.permalink;
}

/**
 * Get insights for a published Reel
 */
export async function getMediaInsights(
  mediaId: string
): Promise<Record<string, any>> {
  const accessToken = metaTokenStore.pageAccessToken;

  if (!accessToken) {
    throw new Error('No Meta access token available.');
  }

  const url = getGraphApiUrl(`/${mediaId}/insights`, {
    metric: 'plays,reach,saved,comments,likes,shares',
    access_token: accessToken,
  });

  const response = await axios.get(url);
  const insights: Record<string, any> = {};

  if (response.data.data) {
    for (const metric of response.data.data) {
      insights[metric.name] = metric.values?.[0]?.value ?? 0;
    }
  }

  return insights;
}

/**
 * Build a public URL for a temporarily served video file.
 * The file must be accessible at this URL for Instagram to fetch it.
 */
export function buildTempVideoUrl(filename: string): string {
  return `${PUBLIC_BASE_URL}/temp-media/${filename}`;
}
