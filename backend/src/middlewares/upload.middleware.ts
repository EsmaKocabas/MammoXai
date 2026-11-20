
import multer from 'multer';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { MAMMOGRAM_DIR } from '../config/paths.js';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
};

const MAX_FILE_SIZE_MB = 50;

export class UploadError extends Error {
  status = 400;

  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

fs.mkdirSync(MAMMOGRAM_DIR, { recursive: true });

export const uploadMammogram = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, MAMMOGRAM_DIR);
    },

    filename: (_req, file, cb) => {
      const extension = ALLOWED_MIME_TYPES[file.mimetype];

      if (!extension) {
        return cb(
          new UploadError('Desteklenmeyen görüntü formatı.'),
          ''
        );
      }

      cb(null, `${randomUUID()}${extension}`);
    },
  }),

  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 1,
  },

  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES[file.mimetype]) {
      return cb(
        new UploadError(
          'Yalnızca PNG veya JPEG formatında mamografi görüntüsü yüklenebilir.'
        )
      );
    }

    cb(null, true);
  },
}).single('image');
