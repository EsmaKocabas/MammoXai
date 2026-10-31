import { z } from 'zod';

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Tarih dönüştürücü: GG.AA.YYYY, GG-AA-YYYY, GG/AA/YYYY, YYYY-AA-GG veya ISO tarih formatını YYYY-AA-GG biçimine dönüştürür
export const normalizeDate = (val: unknown): string | null => {
  if (typeof val !== 'string') return null;
  const s = val.trim();
  if (!s) return null;

  // 1. GG.AA.YYYY / GG-AA-YYYY / GG/AA/YYYY (Türkiye gün/ay/yıl standardı)
  const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return null;
  }

  // 2. YYYY-AA-GG / YYYY.AA.GG / YYYY/AA/GG
  const ymd = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 3. ISO tarih dizgisi (örn. 1985-05-03T21:00:00.000Z)
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    if (year >= 1900 && year <= 2100) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
};

export const formatZodError = (error: z.ZodError) =>
  error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));

// multipart/form-data'da boş bırakılan alanlar "" olarak gelir; bunları yok sayıyoruz
export const dropEmptyStrings = (body: Record<string, unknown> = {}) =>
  Object.fromEntries(Object.entries(body).filter(([, v]) => v !== ''));

// Doktor şifresi: En az 8 karakter, 1 büyük harf, 1 küçük harf, 1 sayı, 1 noktalama/özel karakter
export const validatePassword = (password: unknown): { valid: boolean; message?: string } => {
  if (typeof password !== 'string') {
    return { valid: false, message: 'Şifre metin formatında olmalıdır.' };
  }
  if (password.length < 8) {
    return { valid: false, message: 'Şifre en az 8 karakter uzunluğunda olmalıdır.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Şifre en az bir büyük harf (A-Z) içermelidir.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Şifre en az bir küçük harf (a-z) içermelidir.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Şifre en az bir sayı (0-9) içermelidir.' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, message: 'Şifre en az bir noktalama işareti veya özel karakter içermelidir.' };
  }
  return { valid: true };
};

