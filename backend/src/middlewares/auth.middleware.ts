import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'gizli_anahtarim';

export interface DoctorPayload {
  id: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: DoctorPayload;
}

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Yetkilendirme başarısız. Geçerli bir Bearer token bulunamadı.' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as DoctorPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token süresi dolmuş. Lütfen tekrar giriş yapın.' });
      return;
    }
    res.status(401).json({ error: 'Geçersiz veya bozuk token.' });
  }
};
