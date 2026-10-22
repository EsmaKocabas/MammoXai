import { Response } from 'express';
import { pool } from '../config/db.js';

export interface NotificationPayload {
  doctorId: string;
  title: string;
  message: string;
  type?: 'alert' | 'warning' | 'info' | 'success';
  link?: string;
  relatedId?: string;
}

// Aktif SSE (Server-Sent Events) istemcileri: doctorId -> Set of express Responses
const clients = new Map<string, Set<Response>>();

// Yeni SSE istemcisi ekle (Canlı Push Dinleyici)
export const addSseClient = (doctorId: string, res: Response): void => {
  if (!clients.has(doctorId)) {
    clients.set(doctorId, new Set());
  }
  clients.get(doctorId)!.add(res);

  res.on('close', () => {
    const doctorClients = clients.get(doctorId);
    if (doctorClients) {
      doctorClients.delete(res);
      if (doctorClients.size === 0) {
        clients.delete(doctorId);
      }
    }
  });
};

// Bildirim oluştur ve anlık (Push) olarak doktora ilet
export const createNotification = async (payload: NotificationPayload) => {
  const { doctorId, title, message, type = 'info', link, relatedId } = payload;

  try {
    // 1. Veritabanına kaydet
    const result = await pool.query(
      `INSERT INTO notifications (doctor_id, title, message, type, link, related_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, doctor_id, title, message, type, link, related_id, is_read, created_at`,
      [doctorId, title, message, type, link ?? null, relatedId ?? null]
    );

    const notification = result.rows[0];

    // 2. Canlı dinleyen doktora anında Push et (SSE)
    const doctorClients = clients.get(doctorId);
    if (doctorClients && doctorClients.size > 0) {
      const data = `data: ${JSON.stringify(notification)}\n\n`;
      doctorClients.forEach((client) => {
        try {
          client.write(data);
        } catch {
          // Bağlantı kopmuşsa bir sonraki close event'inde temizlenir
        }
      });
    }

    return notification;
  } catch (error) {
    console.error('[Notification Service Error]:', error);
    return null;
  }
};
