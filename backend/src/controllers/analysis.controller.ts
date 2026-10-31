import { Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { PoolClient } from 'pg';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { HEATMAP_DIR, UPLOADS_DIR } from '../config/paths.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { requestPrediction } from '../services/ai.service.js';
import { createNotification } from '../services/notification.service.js';
import { generateAnalysisPdfBuffer } from '../services/pdf.service.js';
import { normalizeDate, dropEmptyStrings, formatZodError } from '../utils/validation.js';

const createAnalysisSchema = z.object({
  patient_id: z.uuid('Geçersiz hasta ID.'),
  laterality: z.enum(['Sol', 'Sağ', 'İkili']).optional(),
  view_position: z.string().max(20).optional(), // örn. CC, MLO
  image_quality: z.string().max(20).optional(),
  acquisition_date: z.string().optional().transform((val, ctx) => {
    if (!val) return undefined;
    const normalized = normalizeDate(val);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Tarih gün, ay, yıl formatında olmalıdır (Örnek: 03.05.1985 veya 1985-05-03).',
      });
      return z.NEVER;
    }
    return normalized;
  }),
  equipment_model: z.string().max(150).optional(),
});

// Analiz + hasta + görüntü bilgilerini tek nesnede döndüren ortak sorgu
const ANALYSIS_SELECT = `
  SELECT
    a.id, a.protocol_no, a.status,
    a.malignancy_probability, a.risk_level, a.classification_label, a.model_confidence,
    a.classification_model, a.model_version,
    a.xai_heatmap_url, a.xai_explanation,
    a.doctor_notes, a.final_decision, a.is_reviewed, a.reviewed_at,
    a.requested_at, a.completed_at,
    json_build_object(
      'id', p.id, 'tc_no', p.tc_no, 'first_name', p.first_name, 'last_name', p.last_name,
      'date_of_birth', p.date_of_birth, 'gender', p.gender, 'phone', p.phone
    ) AS patient,
    json_build_object(
      'id', i.id, 'url', i.storage_url, 'original_filename', i.original_filename,
      'laterality', i.laterality, 'view_position', i.view_position,
      'acquisition_date', i.acquisition_date
    ) AS image
  FROM analyses a
  JOIN patients p ON p.id = a.patient_id
  JOIN mammography_images i ON i.id = a.image_id
`;

// ⚠️ Eşikler klinik olarak doğrulanmamıştır; model kalibrasyonuna göre .env'den ayarlanmalıdır.
const getRiskLevel = (malignancyProbability: number): string => {
  const lowMax = Number(process.env.RISK_LOW_MAX ?? 0.3);
  const highMin = Number(process.env.RISK_HIGH_MIN ?? 0.7);
  if (malignancyProbability >= highMin) return 'Yüksek risk';
  if (malignancyProbability < lowMax) return 'Düşük risk';
  return 'İnceleniyor';
};

const removeFile = (filePath: string) => fs.unlink(filePath).catch(() => undefined);

// generate_protocol_no() COUNT tabanlı olduğu için eşzamanlı isteklerde çakışabilir; çakışmada yeniden dener
const insertAnalysisWithProtocol = async (
  client: PoolClient,
  doctorId: string,
  patientId: string,
  imageId: string
) => {
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; ; attempt++) {
    await client.query('SAVEPOINT protocol_attempt');
    try {
      const result = await client.query(
        `INSERT INTO analyses (doctor_id, patient_id, image_id, protocol_no, status)
         VALUES ($1, $2, $3, generate_protocol_no(), 'processing')
         RETURNING id, protocol_no`,
        [doctorId, patientId, imageId]
      );
      return result.rows[0] as { id: string; protocol_no: string };
    } catch (error: any) {
      await client.query('ROLLBACK TO SAVEPOINT protocol_attempt');
      if (error.code !== '23505' || attempt >= MAX_ATTEMPTS) throw error;
    }
  }
};

// Mamografi Yükle + Analiz Et
// multipart/form-data: image (dosya), patient_id, laterality?, view_position?, acquisition_date?, ...
export const createAnalysis = async (req: AuthRequest, res: Response): Promise<void> => {
  const file = req.file;
  const doctorId = req.user!.id;

  if (!file) {
    res.status(400).json({ error: 'Mamografi görüntüsü ("image" alanı) zorunludur.' });
    return;
  }

  const parsed = createAnalysisSchema.safeParse(dropEmptyStrings(req.body));
  if (!parsed.success) {
    await removeFile(file.path);
    res.status(400).json({ error: 'Geçersiz analiz bilgileri.', details: formatZodError(parsed.error) });
    return;
  }
  const data = parsed.data;

  const patient = await pool.query('SELECT id FROM patients WHERE id = $1', [data.patient_id]);
  if (patient.rows.length === 0) {
    await removeFile(file.path);
    res.status(404).json({ error: 'Hasta bulunamadı.' });
    return;
  }

  // Görüntü ve analiz kaydını veritabanında oluştur
  const client = await pool.connect();
  let analysis: { id: string; protocol_no: string };
  try {
    await client.query('BEGIN');
    const image = await client.query(
      `INSERT INTO mammography_images (
         patient_id, uploaded_by, original_filename, storage_url, file_size_bytes, mime_type,
         view_position, laterality, image_quality, acquisition_date, equipment_model
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        data.patient_id, doctorId, file.originalname, `/uploads/mammograms/${file.filename}`,
        file.size, file.mimetype, data.view_position ?? null, data.laterality ?? null,
        data.image_quality ?? null, data.acquisition_date ?? null, data.equipment_model ?? null,
      ]
    );
    analysis = await insertAnalysisWithProtocol(client, doctorId, data.patient_id, image.rows[0].id);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    await removeFile(file.path);
    throw error;
  } finally {
    client.release();
  }

  // Yapay zeka servisinden tahmin alıp ısı haritası ve analiz sonuçlarını kaydet
  const heatmapFilename = `${analysis.id}.jpg`;
  const heatmapPath = path.join(HEATMAP_DIR, heatmapFilename);
  try {
    const prediction = await requestPrediction(file.path, file.mimetype, file.originalname);

    await fs.writeFile(heatmapPath, Buffer.from(prediction.xai.heatmap_base64, 'base64'));

    const malignancyProbability = prediction.probabilities.malignant / 100;
    const isMalignant = prediction.prediction === 'malignant';

    await pool.query(
      `UPDATE analyses SET
         status = 'completed',
         malignancy_probability = $2,
         risk_level = $3,
         classification_label = $4,
         model_confidence = $5,
         model_version = $6,
         xai_heatmap_url = $7,
         xai_explanation = $8,
         completed_at = NOW()
       WHERE id = $1`,
      [
        analysis.id,
        malignancyProbability,
        getRiskLevel(malignancyProbability),
        isMalignant ? 'Malign şüpheli' : 'Malign bulgu yok',
        prediction.confidence_score / 100,
        // analyses.model_version VARCHAR(30)
        (process.env.MODEL_VERSION || 'efficientnet_b4_final_best').slice(0, 30),
        `/uploads/heatmaps/${heatmapFilename}`,
        `${prediction.xai.method} (${prediction.xai.target_layer}) – hedef sınıf: ${prediction.xai.target_class}`,
      ]
    );
  } catch (error) {
    console.error('[Analysis Error]:', error);
    await removeFile(heatmapPath);
    await pool.query(`UPDATE analyses SET status = 'failed' WHERE id = $1`, [analysis.id]);

    createNotification({
      doctorId,
      title: '⚠️ Analiz İşlemi Başarısız Oldu',
      message: `${analysis.protocol_no} protokol nolu mamografi analizi işlenirken hata oluştu.`,
      type: 'warning',
      link: '/analyses',
      relatedId: analysis.id,
    }).catch(() => undefined);

    if (!res.headersSent) {
      res.status(502).json({
        error: 'Görüntü kaydedildi ancak AI analizi başarısız oldu.',
        analysis_id: analysis.id,
        protocol_no: analysis.protocol_no,
        status: 'failed',
        ...(process.env.NODE_ENV !== 'production' && {
          detail: error instanceof Error ? error.message : String(error),
        }),
      });
    }
    return;
  }

  const result = await pool.query(`${ANALYSIS_SELECT} WHERE a.id = $1`, [analysis.id]);
  const createdAnalysis = result.rows[0];

  // Doktor için anlık Push Bildirimi üret ve ilet
  const isHighRisk = createdAnalysis.risk_level === 'Yüksek risk';
  const patientName = `${createdAnalysis.patient.first_name} ${createdAnalysis.patient.last_name}`;
  const probPercent = createdAnalysis.malignancy_probability !== null
    ? `%${(Number(createdAnalysis.malignancy_probability) * 100).toFixed(1)}`
    : '';

  createNotification({
    doctorId,
    title: isHighRisk ? '🚨 Kritik Triyaj Uyarısı: Yüksek Risk!' : '✅ Mamografi Analizi Tamamlandı',
    message: isHighRisk
      ? `${patientName} (${createdAnalysis.protocol_no}) isimli hastada ${probPercent} malignite şüphesi tespit edildi. Öncelikli inceleme önerilir.`
      : `${patientName} (${createdAnalysis.protocol_no}) mamografi analizi ve Grad-CAM++ haritası hazırlandı.`,
    type: isHighRisk ? 'alert' : 'info',
    link: `/analyses/${analysis.id}`,
    relatedId: analysis.id,
  }).catch((err) => console.error('[Push Notification Error]:', err));

  if (!res.headersSent) {
    res.status(201).json({ analysis: createdAnalysis });
  }
};

// Doktorun Analizlerini Listele (?patient_id=&page=&limit=)
export const listAnalyses = async (req: AuthRequest, res: Response): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const page = Math.max(Number(req.query.page) || 1, 1);

  const params: unknown[] = [req.user!.id];
  let where = 'WHERE a.doctor_id = $1';

  if (req.query.patient_id) {
    const patientId = z.uuid().safeParse(req.query.patient_id);
    if (!patientId.success) {
      res.status(400).json({ error: 'Geçersiz hasta ID.' });
      return;
    }
    params.push(patientId.data);
    where += ` AND a.patient_id = $${params.length}`;
  }

  params.push(limit, (page - 1) * limit);
  const result = await pool.query(
    `${ANALYSIS_SELECT} ${where}
     ORDER BY a.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({ page, limit, analyses: result.rows });
};

// Tek Analiz Detayı
export const getAnalysis = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: 'Geçersiz analiz ID.' });
    return;
  }

  const result = await pool.query(`${ANALYSIS_SELECT} WHERE a.id = $1 AND a.doctor_id = $2`, [
    id.data,
    req.user!.id,
  ]);

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Analiz bulunamadı.' });
    return;
  }

  res.json({ analysis: result.rows[0] });
};

// Klinik Değerlendirme & Karar Girişi
const reviewAnalysisSchema = z.object({
  final_decision: z.enum([
    'Benign', 'Malign', 'Şüpheli - Biyopsi Önerilir', 'Normal', 'Takip Gerekli',
  ], { message: 'Geçersiz karar değeri.' }),
  doctor_notes: z.string().max(2000).optional(),
});

export const reviewAnalysis = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: 'Geçersiz analiz ID.' });
    return;
  }

  const parsed = reviewAnalysisSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Geçersiz değerlendirme bilgileri.', details: formatZodError(parsed.error) });
    return;
  }

  const { final_decision, doctor_notes } = parsed.data;

  const update = await pool.query(
    `UPDATE analyses SET
       final_decision = $2,
       doctor_notes = $3,
       is_reviewed = TRUE,
       reviewed_at = NOW()
     WHERE id = $1 AND doctor_id = $4
     RETURNING id`,
    [id.data, final_decision, doctor_notes ?? null, req.user!.id]
  );

  if (update.rows.length === 0) {
    res.status(404).json({ error: 'Analiz bulunamadı veya yetkiniz yok.' });
    return;
  }

  const result = await pool.query(`${ANALYSIS_SELECT} WHERE a.id = $1`, [id.data]);
  res.json({ message: 'Değerlendirme kaydedildi.', analysis: result.rows[0] });
};

// Analiz ve İlişkili Görüntüleri Silme
export const deleteAnalysis = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: 'Geçersiz analiz ID.' });
    return;
  }

  // Silmeden önce dosya yollarını al
  const existing = await pool.query(
    `SELECT a.id, a.xai_heatmap_url, i.storage_url, a.image_id
     FROM analyses a
     JOIN mammography_images i ON i.id = a.image_id
     WHERE a.id = $1 AND a.doctor_id = $2`,
    [id.data, req.user!.id]
  );

  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'Analiz bulunamadı veya yetkiniz yok.' });
    return;
  }

  const row = existing.rows[0];

  // Transaction: analiz ve bağlı görüntü kaydını sil
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM analyses WHERE id = $1', [id.data]);
    await client.query('DELETE FROM mammography_images WHERE id = $1', [row.image_id]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  // Dosyaları sil (DB başarılı olduktan sonra, hata olursa yoksay)
  if (row.storage_url) {
    const mammoPath = path.join(UPLOADS_DIR, row.storage_url.replace(/^\/uploads\//, ''));
    await removeFile(mammoPath);
  }
  if (row.xai_heatmap_url) {
    const heatmapPath = path.join(UPLOADS_DIR, row.xai_heatmap_url.replace(/^\/uploads\//, ''));
    await removeFile(heatmapPath);
  }

  res.json({ message: 'Analiz ve ilişkili görüntüler silindi.' });
};

// PDF Rapor Üretimi ve İndirme
export const getAnalysisReport = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: 'Geçersiz analiz ID.' });
    return;
  }

  // Analiz ve hasta bilgilerini al
  const analysisRes = await pool.query(`${ANALYSIS_SELECT} WHERE a.id = $1 AND a.doctor_id = $2`, [
    id.data,
    req.user!.id,
  ]);

  if (analysisRes.rows.length === 0) {
    res.status(404).json({ error: 'Analiz bulunamadı veya yetkiniz yok.' });
    return;
  }

  const analysis = analysisRes.rows[0];

  // Doktor bilgilerini al
  const doctorRes = await pool.query(
    'SELECT full_name, title, specialty, hospital FROM doctors WHERE id = $1',
    [req.user!.id]
  );
  const doctor = doctorRes.rows[0] || { full_name: 'Uzm. Dr.' };

  try {
    const pdfBuffer = await generateAnalysisPdfBuffer({ analysis, doctor });

    const safeProtocol = (analysis.protocol_no || 'rapor').replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="MammoXai_${safeProtocol}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (error) {
    console.error('[PDF Report Error]:', error);
    res.status(500).json({ error: 'PDF raporu oluşturulurken bir hata meydana geldi.' });
  }
};

