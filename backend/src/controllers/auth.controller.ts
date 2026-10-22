import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { validatePassword } from '../utils/validation.js';

const JWT_SECRET = process.env.JWT_SECRET || 'gizli_anahtarim';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

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
      phone.trim(),
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
    if (phone !== undefined) updates.phone = phone ? phone.trim() : null;
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
