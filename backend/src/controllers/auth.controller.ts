import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { validatePassword } from '../utils/validation.js';
import crypto from 'node:crypto';
import { sendPasswordResetEmail } from '../lib/mailer.js';

const JWT_SECRET = process.env.JWT_SECRET || 'gizli_anahtarim';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const validatePhone = (phone: unknown): phone is string => {
  return typeof phone === 'string' && /^\+[1-9]\d{7,14}$/.test(phone);
};

// Kayıt Ol (Register - Doktor Kaydı)
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      email,
      password,
      full_name,
      name, // Alternatif alan adı uyumluluğu için
      title,
      specialty,
      hospital,
      phone
    } = req.body;

    const doctorName = full_name || name;

    // Tüm alanların doldurulması zorunludur (hiçbiri boş bırakılamaz)
    if (
      !email?.trim() ||
      !password ||
      !doctorName?.trim() ||
      !title?.trim() ||
      !specialty?.trim() ||
      !hospital?.trim() ||
      !phone?.trim()
    ) {
      res.status(400).json({
        error: 'Tüm alanların doldurulması zorunludur: E-posta, şifre, isim, unvan, uzmanlık alanı, hastane ve telefon boş bırakılamaz.',
      });
      return;
    }

    // Telefon format kontrolü
    const normalizedPhone = phone.trim();

    if (!validatePhone(normalizedPhone)) {
      res.status(400).json({
        error: 'Geçersiz telefon numarası. Ülke koduyla birlikte girin. Örnek: +905321234567',
      });
      return;
    }

    // E-posta format kontrolü
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      res.status(400).json({ error: 'Lütfen geçerli bir e-posta adresi giriniz.' });
      return;
    }

    const passValidation = validatePassword(password);
    if (!passValidation.valid) {
      res.status(400).json({ error: passValidation.message });
      return;
    }

    // E-posta zaten kayıtlı mı kontrolü
    const existingDoctor = await pool.query(
      'SELECT id FROM doctors WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (existingDoctor.rows.length > 0) {
      res.status(409).json({ error: 'Bu e-posta adresi ile kayıtlı bir doktor zaten mevcut.' });
      return;
    }

    // Şifreyi hashle
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Doctors tablosuna ekle
    const insertQuery = `
      INSERT INTO doctors (
        email, 
        password_hash, 
        full_name, 
        title, 
        specialty, 
        hospital, 
        phone
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING id, email, full_name, title, specialty, hospital, phone, created_at
    `;

    const result = await pool.query(insertQuery, [
      email.toLowerCase().trim(),
      passwordHash,
      doctorName.trim(),
      title.trim(),
      specialty.trim(),
      hospital.trim(),
      normalizedPhone,
    ]);

    const newDoctor = result.rows[0];

    // Otomatik JWT Token üret
    const token = jwt.sign(
      { id: newDoctor.id, email: newDoctor.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    res.status(201).json({
      message: 'Kayıt işlemi başarıyla tamamlandı.',
      token,
      doctor: newDoctor,
    });
  } catch (error) {
    console.error('[Register Error]:', error);
    res.status(500).json({ error: 'Kayıt sırasında sunucu hatası oluştu.' });
  }
};

// Giriş Yap (Login)
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'E-posta ve şifre zorunludur.' });
      return;
    }

    // Doktoru veritabanında bul
    const query = `
      SELECT id, email, password_hash, full_name, title, specialty, hospital, phone, is_active 
      FROM doctors 
      WHERE LOWER(email) = LOWER($1)
    `;
    const result = await pool.query(query, [email.trim()]);

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Geçersiz e-posta veya şifre.' });
      return;
    }

    const doctor = result.rows[0];

    // Hesap aktiflik kontrolü
    if (!doctor.is_active) {
      res.status(403).json({ error: 'Hesabınız pasife alınmıştır. Lütfen yöneticiyle iletişime geçin.' });
      return;
    }

    // Şifre doğrulama (password_hash ile)
    const isPasswordValid = await bcrypt.compare(password, doctor.password_hash);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Geçersiz e-posta veya şifre.' });
      return;
    }

    // Son giriş zamanını güncelle
    await pool.query('UPDATE doctors SET last_login_at = NOW() WHERE id = $1', [doctor.id]);

    // JWT Token üret
    const token = jwt.sign(
      { id: doctor.id, email: doctor.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    // Hassas bilgileri response'tan çıkar
    const { password_hash, ...safeDoctor } = doctor;

    res.json({
      message: 'Giriş başarılı.',
      token,
      doctor: safeDoctor,
    });
  } catch (error) {
    console.error('[Login Error]:', error);
    res.status(500).json({ error: 'Giriş sırasında sunucu hatası oluştu.' });
  }
};

// Aktif Giriş Yapmış Doktor Bilgilerini Getir (Profile / Me)
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const doctorId = req.user?.id;

    if (!doctorId) {
      res.status(401).json({ error: 'Yetkisiz erişim.' });
      return;
    }

    const query = `
      SELECT id, email, full_name, title, specialty, hospital, phone, profile_photo_url, created_at, last_login_at
      FROM doctors 
      WHERE id = $1
    `;
    const result = await pool.query(query, [doctorId]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Doktor bulunamadı.' });
      return;
    }

    res.json({
      doctor: result.rows[0],
    });
  } catch (error) {
    console.error('[GetMe Error]:', error);
    res.status(500).json({ error: 'Profil bilgileri alınırken hata oluştu.' });
  }
};

// Doktor Profilini Güncelleme / Şifre Değiştirme (PUT /api/auth/profile)
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const doctorId = req.user?.id;
    if (!doctorId) {
      res.status(401).json({ error: 'Yetkisiz erişim.' });
      return;
    }

    const {
      full_name,
      title,
      specialty,
      hospital,
      phone,
      profile_photo_url,
      current_password,
      new_password,
    } = req.body;
    // Telefon numarasını her profil güncellemesinde doğrula
    if (phone !== undefined) {
      if (typeof phone !== 'string' || !validatePhone(phone.trim())) {
        res.status(400).json({
          error:
            'Geçersiz telefon numarası. Ülke koduyla birlikte girin. Örnek: +905321234567',
        });
        return;
      }
    }
    // Şifre değiştirme talebi varsa mevcut şifreyi doğrula
    let newPasswordHash: string | null = null;
    if (new_password) {
      if (!current_password) {
        res.status(400).json({ error: 'Şifrenizi değiştirmek için mevcut şifrenizi girmelisiniz.' });
        return;
      }
      const passValidation = validatePassword(new_password);
      if (!passValidation.valid) {
        res.status(400).json({ error: passValidation.message });
        return;
      }

      const docRes = await pool.query('SELECT password_hash FROM doctors WHERE id = $1', [doctorId]);
      if (docRes.rows.length === 0) {
        res.status(404).json({ error: 'Doktor bulunamadı.' });
        return;
      }

      const isMatch = await bcrypt.compare(current_password, docRes.rows[0].password_hash);
      if (!isMatch) {
        res.status(400).json({ error: 'Mevcut şifre hatalı.' });
        return;
      }

      const salt = await bcrypt.genSalt(10);
      newPasswordHash = await bcrypt.hash(new_password, salt);
    }

    // Dinamik alan güncelleme
    const updates: Record<string, any> = {};
    if (full_name !== undefined && full_name.trim()) updates.full_name = full_name.trim();
    if (title !== undefined) updates.title = title ? title.trim() : null;
    if (specialty !== undefined) updates.specialty = specialty ? specialty.trim() : null;
    if (hospital !== undefined) updates.hospital = hospital ? hospital.trim() : null;
    if (phone !== undefined) { updates.phone = phone.trim(); }
    if (profile_photo_url !== undefined) updates.profile_photo_url = profile_photo_url ? profile_photo_url.trim() : null;
    if (newPasswordHash) updates.password_hash = newPasswordHash;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'Güncellenecek herhangi bir bilgi belirtilmedi.' });
      return;
    }

    const setClauses: string[] = [];
    const values: any[] = [doctorId];

    Object.entries(updates).forEach(([col, val]) => {
      values.push(val);
      setClauses.push(`${col} = $${values.length}`);
    });

    const updateQuery = `
      UPDATE doctors
      SET ${setClauses.join(', ')}
      WHERE id = $1
      RETURNING id, email, full_name, title, specialty, hospital, phone, profile_photo_url, updated_at
    `;

    const result = await pool.query(updateQuery, values);
    res.json({
      message: 'Profil bilgileri başarıyla güncellendi.',
      doctor: result.rows[0],
    });
  } catch (error) {
    console.error('[UpdateProfile Error]:', error);
    res.status(500).json({ error: 'Profil güncellenirken sunucu hatası oluştu.' });
  }
};

// Doktor Profilini / Hesabını Silme (DELETE /api/auth/profile)
export const deleteAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const doctorId = req.user?.id;
    if (!doctorId) {
      res.status(401).json({ error: 'Yetkisiz erişim.' });
      return;
    }

    // Hesabı pasife al ve varsa şifre sıfırlama tokenlarını temizle
    await pool.query('UPDATE doctors SET is_active = FALSE WHERE id = $1', [doctorId]);
    await pool.query('DELETE FROM password_reset_tokens WHERE doctor_id = $1', [doctorId]);

    res.json({
      message: 'Hesabınız başarıyla silindi ve oturumunuz sonlandırıldı.',
    });
  } catch (error) {
    console.error('[DeleteAccount Error]:', error);
    res.status(500).json({ error: 'Hesap silinirken sunucu hatası oluştu.' });
  }
};

// Şifre Sıfırlama E-postası İste
export const forgotPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const genericMessage =
    'Eğer bu e-posta adresi sistemimizde kayıtlıysa şifre sıfırlama bağlantısı gönderilecektir.';

  try {
    const email =
      typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      res.status(200).json({ message: genericMessage });
      return;
    }

    const result = await pool.query(
      'SELECT id, email FROM doctors WHERE LOWER(email) = $1 LIMIT 1',
      [email],
    );

    if (result.rows.length > 0) {
      const doctor = result.rows[0];
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await pool.query(
        `UPDATE password_reset_tokens
         SET used_at = NOW()
         WHERE doctor_id = $1 AND used_at IS NULL`,
        [doctor.id],
      );

      await pool.query(
        `INSERT INTO password_reset_tokens (doctor_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [doctor.id, tokenHash, expiresAt],
      );

      const frontendUrl = process.env.FRONTEND_URL;
      if (!frontendUrl) throw new Error('FRONTEND_URL tanımlanmamış.');

      const resetUrl = new URL('/reset-password', frontendUrl);
      resetUrl.searchParams.set('token', rawToken);

      await sendPasswordResetEmail(doctor.email, resetUrl.toString());
    }

    res.status(200).json({ message: genericMessage });
  } catch (error) {
    console.error('[ForgotPassword Error]:', error);
    res.status(500).json({
      error: 'Şifre sıfırlama isteği işlenirken bir sunucu hatası oluştu.',
    });
  }
};

// Token ile yeni şifre belirle
export const resetPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const token =
      typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const password =
      typeof req.body?.password === 'string' ? req.body.password : '';

    if (!token || !password) {
      res.status(400).json({
        error: 'Sıfırlama tokenı ve yeni şifre zorunludur.',
      });
      return;
    }

    const passValidation = validatePassword(password);
    if (!passValidation.valid) {
      res.status(400).json({ error: passValidation.message });
      return;
    }

    // E-postadaki ham token ile veritabanındaki hash eşleştirilir.
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Token geçerli, süresi dolmamış ve daha önce kullanılmamış olmalı.
    const tokenResult = await pool.query(
      `SELECT id, doctor_id
       FROM password_reset_tokens
       WHERE token = $1
         AND expires_at > NOW()
         AND used_at IS NULL
       LIMIT 1`,
      [tokenHash],
    );

    if (tokenResult.rows.length === 0) {
      res.status(400).json({
        error: 'Sıfırlama bağlantısı geçersiz veya süresi dolmuş. Lütfen yeni bir bağlantı isteyin.',
      });
      return;
    }

    const resetRecord = tokenResult.rows[0];
    const passwordHash = await bcrypt.hash(password, 10);

    // Token'ın aynı anda iki kez kullanılmasını engellemek için transaction.
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const lockedToken = await client.query(
        `SELECT id, doctor_id
         FROM password_reset_tokens
         WHERE id = $1
           AND expires_at > NOW()
           AND used_at IS NULL
         FOR UPDATE`,
        [resetRecord.id],
      );

      if (lockedToken.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(400).json({
          error: 'Bu bağlantı artık kullanılamıyor. Lütfen yeni bir bağlantı isteyin.',
        });
        return;
      }

      await client.query(
        `UPDATE doctors
         SET password_hash = $1
         WHERE id = $2`,
        [passwordHash, resetRecord.doctor_id],
      );

      await client.query(
        `UPDATE password_reset_tokens
         SET used_at = NOW()
         WHERE id = $1`,
        [resetRecord.id],
      );

      // Diğer aktif sıfırlama bağlantılarını da geçersiz kıl.
      await client.query(
        `UPDATE password_reset_tokens
         SET used_at = NOW()
         WHERE doctor_id = $1
           AND id <> $2
           AND used_at IS NULL`,
        [resetRecord.doctor_id, resetRecord.id],
      );

      await client.query('COMMIT');

      res.status(200).json({
        message: 'Şifreniz başarıyla yenilendi. Yeni şifrenizle giriş yapabilirsiniz.',
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[ResetPassword Error]:', error);
    res.status(500).json({
      error: 'Şifre yenilenirken bir sunucu hatası oluştu.',
    });
  }
};
