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
