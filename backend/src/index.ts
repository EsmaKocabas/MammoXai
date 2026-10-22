import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './config/db.js';
import authRoutes from './routes/auth.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Rotalar
app.use('/api/auth', authRoutes);

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
    },
  });
});

app.listen(PORT, () => {
  console.log(`[Server] MammoXai API http://localhost:${PORT} üzerinde çalışıyor.`);
});
