import { z } from 'zod';

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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

