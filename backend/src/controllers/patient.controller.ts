import { Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { UPLOADS_DIR } from '../config/paths.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { DATE_REGEX, formatZodError } from '../utils/validation.js';

const createPatientSchema = z.object({
  tc_no: z.string().regex(/^[1-9]\d{10}$/, 'TC Kimlik No 11 haneli olmalı ve 0 ile başlamamalıdır.'),
  first_name: z.string().trim().min(1, 'Hasta adı boş bırakılamaz.').max(80),
  last_name: z.string().trim().min(1, 'Hasta soyadı boş bırakılamaz.').max(80),
  date_of_birth: z.string().regex(DATE_REGEX, 'Doğum tarihi YYYY-AA-GG formatında olmalıdır.'),
  gender: z.enum(['Kadın', 'Erkek', 'Diğer'], { message: 'Cinsiyet seçimi zorunludur (Kadın, Erkek, Diğer).' }),
  phone: z.string().trim().min(1, 'Telefon numarası boş bırakılamaz.').max(20),
  email: z.string().trim().email('Geçerli bir e-posta adresi giriniz.'),
  address: z.string().trim().min(1, 'Adres bilgisi boş bırakılamaz.'),
  blood_type: z.string().trim().min(1, 'Kan grubu boş bırakılamaz.').max(5),
  allergies: z.string().trim().min(1, 'Alerji bilgisi boş bırakılamaz (Alerji yoksa "Yok" yazınız).'),
  chronic_diseases: z.string().trim().min(1, 'Kronik hastalık bilgisi boş bırakılamaz (Hastalık yoksa "Yok" yazınız).'),
  family_history_of_cancer: z.boolean({ message: 'Ailede kanser geçmişi seçimi zorunludur.' }),
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
        p.phone, p.email, p.address, p.blood_type,
        p.allergies, p.chronic_diseases, p.family_history_of_cancer,
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

// Hasta Bilgilerini Güncelleme
const updatePatientSchema = createPatientSchema.partial();

export const updatePatient = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: 'Geçersiz hasta ID.' });
    return;
  }

  const parsed = updatePatientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Geçersiz hasta bilgileri.', details: formatZodError(parsed.error) });
    return;
  }

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'Güncellenecek en az bir alan belirtilmelidir.' });
    return;
  }

  // Dinamik parametrik update sorgusu
  const setClauses: string[] = [];
  const values: unknown[] = [id.data];

  Object.entries(updates).forEach(([key, val]) => {
    values.push(val);
    setClauses.push(`${key} = $${values.length}`);
  });

  const query = `
    UPDATE patients
    SET ${setClauses.join(', ')}
    WHERE id = $1
    RETURNING ${PATIENT_COLUMNS}
  `;

  try {
    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Hasta bulunamadı.' });
      return;
    }

    res.json({ message: 'Hasta bilgileri başarıyla güncellendi.', patient: result.rows[0] });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Bu TC Kimlik No ile kayıtlı başka bir hasta zaten mevcut.' });
      return;
    }
    throw error;
  }
};

// Hasta Silme / Arşivleme (DELETE /api/patients/:id)
export const deletePatient = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: 'Geçersiz hasta ID.' });
    return;
  }

  // Hastanın varlığını kontrol et
  const patientCheck = await pool.query(
    'SELECT id, first_name, last_name FROM patients WHERE id = $1',
    [id.data]
  );
  if (patientCheck.rows.length === 0) {
    res.status(404).json({ error: 'Hasta bulunamadı.' });
    return;
  }

  const patient = patientCheck.rows[0];

  // Hastaya ait silinecek tüm mamografi ve ısı haritası dosyalarını topla
  const filesQuery = await pool.query(
    `SELECT i.storage_url, a.xai_heatmap_url
     FROM mammography_images i
     LEFT JOIN analyses a ON a.image_id = i.id
     WHERE i.patient_id = $1`,
    [id.data]
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // İlişkisel bütünlük: Önce analizleri, sonra görüntüleri, en son hastayı sil
    await client.query('DELETE FROM analyses WHERE patient_id = $1', [id.data]);
    await client.query('DELETE FROM mammography_images WHERE patient_id = $1', [id.data]);
    await client.query('DELETE FROM patients WHERE id = $1', [id.data]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  // Veritabanı işlemi başarılı olduktan sonra diskteki fiziksel dosyaları temizle
  for (const row of filesQuery.rows) {
    if (row.storage_url) {
      const p = path.join(UPLOADS_DIR, row.storage_url.replace(/^\/uploads\//, ''));
      await fs.unlink(p).catch(() => undefined);
    }
    if (row.xai_heatmap_url) {
      const p = path.join(UPLOADS_DIR, row.xai_heatmap_url.replace(/^\/uploads\//, ''));
      await fs.unlink(p).catch(() => undefined);
    }
  }

  res.json({
    message: `${patient.first_name} ${patient.last_name} isimli hasta ve ilişkili tüm analizler başarıyla silindi.`,
  });
};


