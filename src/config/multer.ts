// config/multer.ts
import multer from 'multer';

export const upload = multer({ dest: 'uploads/' });
export const validVideoExtensions = [
  '.mp4',
  '.mov',
  '.avi',
  '.mkv',
  '.flv',
  '.wmv',
];
