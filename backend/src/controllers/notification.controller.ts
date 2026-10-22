import { Response } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { addSseClient } from '../services/notification.service.js';

// Bildirimleri Listele (Son 50 bildirim ve okunmamış sayısı)
export const listNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  const doctorId = req.user!.id;

  const result = await pool.query(
    `SELECT id, title, message, type, link, related_id, is_read, read_at, created_at
     FROM notifications
     WHERE doctor_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [doctorId]
  );

  const unreadCountRes = await pool.query(
    'SELECT COUNT(*)::int AS unread_count FROM notifications WHERE doctor_id = $1 AND is_read = FALSE',
    [doctorId]
  );

  res.json({
    unread_count: unreadCountRes.rows[0]?.unread_count ?? 0,
    notifications: result.rows,
  });
};

// Canlı Push Bildirim Akışı (Server-Sent Events - SSE)
export const subscribeNotifications = (req: AuthRequest, res: Response): void => {
  const doctorId = req.user!.id;

  // SSE Header'ları ayarla
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx / reverse proxy bufferlamasını engelle
  res.flushHeaders?.();

  // İlk bağlantı teyidi
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Bildirim akışı aktif.' })}\n\n`);

  // Canlı dinleyici listesine ekle
  addSseClient(doctorId, res);

  // Bağlantıyı canlı tutmak için her 30 saniyede bir kalp atışı (keep-alive ping)
  const interval = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch {
      clearInterval(interval);
    }
  }, 30000);

  res.on('close', () => {
    clearInterval(interval);
  });
};

// Tek Bildirimi Okundu Olarak İşaretle
export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: 'Geçersiz bildirim ID.' });
    return;
  }

  const result = await pool.query(
    `UPDATE notifications
     SET is_read = TRUE, read_at = NOW()
     WHERE id = $1 AND doctor_id = $2
     RETURNING id, is_read, read_at`,
    [id.data, req.user!.id]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Bildirim bulunamadı.' });
    return;
  }

  res.json({ message: 'Bildirim okundu olarak işaretlendi.', notification: result.rows[0] });
};

// Tüm Bildirimleri Okundu Olarak İşaretle
export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  const doctorId = req.user!.id;

  await pool.query(
    `UPDATE notifications
     SET is_read = TRUE, read_at = NOW()
     WHERE doctor_id = $1 AND is_read = FALSE`,
    [doctorId]
  );

  res.json({ message: 'Tüm bildirimler okundu olarak işaretlendi.' });
};

// Bildirimi Sil
export const deleteNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: 'Geçersiz bildirim ID.' });
    return;
  }

  const result = await pool.query(
    'DELETE FROM notifications WHERE id = $1 AND doctor_id = $2 RETURNING id',
    [id.data, req.user!.id]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Bildirim bulunamadı.' });
    return;
  }

  res.json({ message: 'Bildirim silindi.' });
};
