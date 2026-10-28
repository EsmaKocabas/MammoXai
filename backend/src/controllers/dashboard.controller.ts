
import { Response } from 'express';
import { pool } from '../config/db.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';

// Doktorun kendi verilerine göre özet istatistikler
export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  const doctorId = req.user!.id;

  // Tek sorguda tüm istatistikleri topla (N+1 sorgudan kaçın)
  const result = await pool.query(
    `SELECT
       -- Hasta sayısı (bu doktorun kaydettiği)
       (SELECT COUNT(*) FROM patients WHERE registered_by = $1)::int AS total_patients,

       -- Analiz sayıları
       (SELECT COUNT(*) FROM analyses WHERE doctor_id = $1)::int AS total_analyses,
       (SELECT COUNT(*) FROM analyses WHERE doctor_id = $1 AND status = 'completed')::int AS completed_analyses,
       (SELECT COUNT(*) FROM analyses WHERE doctor_id = $1 AND status = 'pending')::int AS pending_analyses,
       (SELECT COUNT(*) FROM analyses WHERE doctor_id = $1 AND status = 'processing')::int AS processing_analyses,
       (SELECT COUNT(*) FROM analyses WHERE doctor_id = $1 AND status = 'failed')::int AS failed_analyses,

       -- Doktor değerlendirme durumu
       (SELECT COUNT(*) FROM analyses WHERE doctor_id = $1 AND is_reviewed = TRUE)::int AS reviewed_analyses,
       (SELECT COUNT(*) FROM analyses WHERE doctor_id = $1 AND status = 'completed' AND is_reviewed = FALSE)::int AS awaiting_review,

       -- Risk dağılımı
       (SELECT COUNT(*) FROM analyses WHERE doctor_id = $1 AND risk_level = 'Yüksek risk')::int AS high_risk_count,
       (SELECT COUNT(*) FROM analyses WHERE doctor_id = $1 AND risk_level = 'İnceleniyor')::int AS medium_risk_count,
       (SELECT COUNT(*) FROM analyses WHERE doctor_id = $1 AND risk_level = 'Düşük risk')::int AS low_risk_count,

       -- Dinamik dönem hesapları
       (SELECT COUNT(*) FROM analyses WHERE doctor_id = $1 AND created_at >= date_trunc('month', NOW()))::int AS this_month_analyses,
       (SELECT COUNT(*) FROM analyses WHERE doctor_id = $1 AND is_reviewed = FALSE AND created_at >= date_trunc('day', NOW()))::int AS today_awaiting_review,
       (SELECT COUNT(*) FROM analyses WHERE doctor_id = $1 AND is_reviewed = FALSE AND risk_level = 'Yüksek risk')::int AS urgent_pending_count`,
    [doctorId]
  );

  const stats = result.rows[0];

  // Son 5 analiz (hızlı özet)
  const recentResult = await pool.query(
    `SELECT a.id, a.protocol_no, a.status, a.risk_level, a.classification_label,
            a.malignancy_probability, a.model_confidence,
            a.is_reviewed, a.created_at,
            p.first_name || ' ' || p.last_name AS patient_name
     FROM analyses a
     JOIN patients p ON p.id = a.patient_id
     WHERE a.doctor_id = $1
     ORDER BY a.created_at DESC
     LIMIT 5`,
    [doctorId]
  );

  res.json({
    stats,
    recent_analyses: recentResult.rows,
  });
};
