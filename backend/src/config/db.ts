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

// Bildirimler tablosunun varlığını otomatik garantiye al
export const initDatabase = async (): Promise<void> => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(30) NOT NULL DEFAULT 'info' CHECK (type IN ('alert', 'warning', 'info', 'success')),
        link TEXT,
        related_id UUID,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_doctor_id ON notifications (doctor_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications (doctor_id, is_read);
      CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at DESC);
    `);
  } catch (error) {
    console.error('[Database Init Error]:', error);
  }
};

