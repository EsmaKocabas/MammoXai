import { Response } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { DATE_REGEX, formatZodError } from '../utils/validation.js';

const createPatientSchema = z.object({
  tc_no: z.string().regex(/^[1-9]\d{10}$/, 'TC Kimlik No 11 haneli olmalı ve 0 ile başlamamalıdır.'),
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  date_of_birth: z.string().regex(DATE_REGEX, 'Tarih YYYY-AA-GG formatında olmalıdır.'),
  gender: z.enum(['Kadın', 'Erkek', 'Diğer']),
  phone: z.string().max(20).optional(),
  email: z.email().optional(),
  address: z.string().optional(),
  blood_type: z.string().max(5).optional(),
  allergies: z.string().optional(),
  chronic_diseases: z.string().optional(),
  family_history_of_cancer: z.boolean().optional(),
});

const PATIENT_COLUMNS = `
  id, tc_no, first_name, last_name, date_of_birth, gender, phone, email, address,
  blood_type, allergies, chronic_diseases, family_history_of_cancer, registered_by, created_at, updated_at
`;

// Yeni Hasta Kaydı
export const createPatient = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createPatientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Geçersiz hasta bilgileri.', details: formatZodError(parsed.error) });
    return;
  }

  const p = parsed.data;
  try {
    const result = await pool.query(
      `INSERT INTO patients (
         tc_no, first_name, last_name, date_of_birth, gender, phone, email, address,
         blood_type, allergies, chronic_diseases, family_history_of_cancer, registered_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING ${PATIENT_COLUMNS}`,
      [
        p.tc_no, p.first_name, p.last_name, p.date_of_birth, p.gender,
        p.phone ?? null, p.email ?? null, p.address ?? null, p.blood_type ?? null,
        p.allergies ?? null, p.chronic_diseases ?? null, p.family_history_of_cancer ?? false,
        req.user!.id,
      ]
    );
    res.status(201).json({ patient: result.rows[0] });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Bu TC Kimlik No ile kayıtlı bir hasta zaten mevcut.' });
      return;
    }
    throw error;
  }
};

// Hasta Listeleme / Arama (?q=ad, soyad veya TC no)
export const listPatients = async (req: AuthRequest, res: Response): Promise<void> => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const limit = Math.min(Number(req.query.limit) || 20, 100);

  const result = q
    ? await pool.query(
        `SELECT ${PATIENT_COLUMNS} FROM patients
         WHERE tc_no LIKE $1 || '%'
            OR (first_name || ' ' || last_name) ILIKE '%' || $1 || '%'
         ORDER BY last_name, first_name
         LIMIT $2`,
        [q, limit]
      )
    : await pool.query(
        `SELECT ${PATIENT_COLUMNS} FROM patients ORDER BY created_at DESC LIMIT $1`,
        [limit]
      );

  res.json({ patients: result.rows });
};

// Tek Hasta Detayı
export const getPatient = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: 'Geçersiz hasta ID.' });
    return;
  }

  const result = await pool.query(`SELECT ${PATIENT_COLUMNS} FROM patients WHERE id = $1`, [id.data]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Hasta bulunamadı.' });
    return;
  }

  res.json({ patient: result.rows[0] });
};
