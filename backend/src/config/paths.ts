import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// src/config ve dist/config için aynı sonucu verir: backend/uploads
export const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
export const MAMMOGRAM_DIR = path.join(UPLOADS_DIR, 'mammograms');
export const HEATMAP_DIR = path.join(UPLOADS_DIR, 'heatmaps');

for (const dir of [MAMMOGRAM_DIR, HEATMAP_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}
