import { youtube } from '../config/google';
import { validVideoExtensions } from '../config/multer';
import fs from 'fs';
import path from 'path';

type VideoMetadata = {
  title: string;
  description?: string;
  tags?: string[];
  publishAt?: string;
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

  const requestBody = {
    snippet: {
      title: metadata.title,
      description: metadata.description || '',
      tags: metadata.tags,
      categoryId: metadata.categoryId,
    },
    status: {
      privacyStatus: 'private',
      ...(metadata.publishAt && {
        publishAt: new Date(metadata.publishAt).toISOString(),
      }),
    },
  };

  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
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
