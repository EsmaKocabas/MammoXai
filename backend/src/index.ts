import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { pool, initDatabase } from './config/db.js';
import { UPLOADS_DIR } from './config/paths.js';
import { UploadError } from './middlewares/upload.middleware.js';
import authRoutes from './routes/auth.routes.js';
import patientRoutes from './routes/patient.routes.js';
import analysisRoutes from './routes/analysis.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import notificationRoutes from './routes/notification.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

// Veritabanı tablolarının hazır olduğundan emin ol
initDatabase().catch((err) => console.error('[DB Init Error]:', err));

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Yüklenen mamografiler ve Grad-CAM++ ısı haritaları
app.use(
  '/uploads',
  express.static(UPLOADS_DIR, {
    setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
  })
);

// Rotalar
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/analyses', analysisRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);

// Sağlık kontrolü & DB bağlantı testi
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const dbRes = await pool.query('SELECT NOW() as current_time');
    res.json({
      status: 'ok',
      service: 'MammoXai Backend API',
      database: 'connected',
      timestamp: dbRes.rows[0].current_time,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      service: 'MammoXai Backend API',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
    });
  }
});

// Ana karşılama rotası
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'MammoXai API Servisi Aktif',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      patients: '/api/patients',
      analyses: '/api/analyses',
      dashboard: '/api/dashboard/stats',
      notifications: '/api/notifications',
    },
  });
});

// Merkezi hata yakalayıcı (Express 5 async hataları da buraya düşer)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    res.status(status).json({ error: `Dosya yükleme hatası: ${err.message}` });
    return;
  }
  if (err instanceof UploadError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error('[Unhandled Error]:', err);
  res.status(500).json({ error: 'Sunucu hatası oluştu.' });
});

app.listen(PORT, () => {
  console.log(`[Server] MammoXai API http://localhost:${PORT} üzerinde çalışıyor.`);
});
