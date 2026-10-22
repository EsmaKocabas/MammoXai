import multer from 'multer';
import { randomUUID } from 'crypto';
import { MAMMOGRAM_DIR } from '../config/paths.js';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
};

const MAX_FILE_SIZE_MB = 50;

export class UploadError extends Error {
  status = 400;
}

// Form alanı adı: "image"
export const uploadMammogram = multer({
  storage: multer.diskStorage({
    destination: MAMMOGRAM_DIR,
    // Tahmin edilemez dosya adı: orijinal ad (hasta bilgisi içerebilir) diske yazılmaz
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${ALLOWED_MIME_TYPES[file.mimetype]}`),
  }),
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new UploadError('Yalnızca PNG veya JPEG formatında mamografi görüntüsü yüklenebilir.'));
    }
  },
}).single('image');
