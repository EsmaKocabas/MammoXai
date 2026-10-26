// Backend ile iletişim + oturum (token) yönetimi

const TOKEN_KEY = 'mammoai_token';
const DOCTOR_KEY = 'mammoai_doctor';

export interface Doctor {
  id: string;
  email: string;
  full_name: string;
  title?: string | null;
  specialty?: string | null;
  hospital?: string | null;
  phone?: string | null;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// "Beni hatırla" işaretliyse localStorage (kalıcı), değilse sessionStorage (sekme kapanınca silinir)
export const saveSession = (token: string, doctor: Doctor, remember: boolean) => {
  clearSession();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(TOKEN_KEY, token);
  storage.setItem(DOCTOR_KEY, JSON.stringify(doctor));
};

export const getToken = (): string | null =>
  localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);

export const getDoctor = (): Doctor | null => {
  const raw = localStorage.getItem(DOCTOR_KEY) ?? sessionStorage.getItem(DOCTOR_KEY);
  try {
    return raw ? (JSON.parse(raw) as Doctor) : null;
  } catch {
    return null;
  }
};

export const clearSession = () => {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem(TOKEN_KEY);
    storage.removeItem(DOCTOR_KEY);
  }
};

export const apiFetch = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(path, { ...options, headers });
  } catch {
    throw new ApiError('Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.', 0);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) clearSession();
    throw new ApiError(data.error || 'Beklenmeyen bir hata oluştu.', response.status);
  }
  return data as T;
};

export const login = (email: string, password: string) =>
  apiFetch<{ token: string; doctor: Doctor }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export interface RegisterData {
  full_name: string;
  title: string;
  specialty: string;
  hospital: string;
  phone: string;
  email: string;
  password: string;
}

export const register = (data: RegisterData) =>
  apiFetch<{ message: string; token: string; doctor: Doctor }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });

