import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env dosyasını hem backend hem de proje kök dizininden arayacak şekilde yükle
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=') || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : undefined,
});

pool.on('connect', () => {
  console.log('[Database] NeonDB bağlantısı başarılı.');
});

pool.on('error', (err) => {
  console.error('[Database Error]', err);
});
