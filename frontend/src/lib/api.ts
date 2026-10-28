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
  profile_photo_url?: string | null;
  created_at?: string;
  last_login_at?: string;
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

export const updateStoredDoctor = (doctor: Doctor) => {
  if (localStorage.getItem(DOCTOR_KEY)) {
    localStorage.setItem(DOCTOR_KEY, JSON.stringify(doctor));
  }
  if (sessionStorage.getItem(DOCTOR_KEY)) {
    sessionStorage.setItem(DOCTOR_KEY, JSON.stringify(doctor));
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
    let message = data.error || 'Beklenmeyen bir hata oluştu.';
    if (Array.isArray(data.details) && data.details.length > 0) {
      const detailedMessages = data.details
        .map((item: any) => (typeof item === 'string' ? item : item.message || ''))
        .filter(Boolean);
      if (detailedMessages.length > 0) {
        message = detailedMessages.join(' ');
      }
    }
    throw new ApiError(message, response.status);
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

export const requestPasswordReset = (email: string) =>
  apiFetch<{ message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

// --- DOKTOR PROFİLİ İŞLEMLERİ ---
export const getMe = () =>
  apiFetch<{ doctor: Doctor }>('/api/auth/me');

export interface UpdateProfileData {
  full_name?: string;
  title?: string;
  specialty?: string;
  hospital?: string;
  phone?: string;
  current_password?: string;
  new_password?: string;
}

export const updateDoctorProfile = (data: UpdateProfileData) =>
  apiFetch<{ message: string; doctor: Doctor }>('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteDoctorAccount = () =>
  apiFetch<{ message: string }>('/api/auth/profile', {
    method: 'DELETE',
  });

// --- DASHBOARD İSTATİSTİKLERİ ---
export interface DashboardStats {
  total_patients: number;
  total_analyses: number;
  completed_analyses: number;
  pending_analyses: number;
  processing_analyses: number;
  failed_analyses: number;
  reviewed_analyses: number;
  awaiting_review: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  this_month_analyses?: number;
  today_awaiting_review?: number;
  urgent_pending_count?: number;
}

export interface RecentAnalysis {
  id: string;
  protocol_no: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  risk_level: 'Yüksek risk' | 'İnceleniyor' | 'Düşük risk' | null;
  classification_label: string | null;
  malignancy_probability: number | null;
  model_confidence: number | null;
  is_reviewed: boolean;
  created_at: string;
  patient_name: string;
}

export interface DashboardResponse {
  stats: DashboardStats;
  recent_analyses: RecentAnalysis[];
}

export const fetchDashboardStats = () =>
  apiFetch<DashboardResponse>('/api/dashboard/stats');

// --- HASTALAR ---
export interface Patient {
  id: string;
  tc_no: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: 'Kadın' | 'Erkek' | 'Diğer';
  phone: string;
  email: string;
  address: string;
  blood_type: string;
  allergies: string;
  chronic_diseases: string;
  family_history_of_cancer: boolean;
  created_at: string;
  updated_at?: string;
}

export const fetchPatients = (q: string = '', limit: number = 50) =>
  apiFetch<{ patients: Patient[] }>(`/api/patients?limit=${limit}${q ? `&q=${encodeURIComponent(q)}` : ''}`);

export const createPatient = (patient: Omit<Patient, 'id' | 'created_at' | 'updated_at'>) =>
  apiFetch<{ patient: Patient }>('/api/patients', {
    method: 'POST',
    body: JSON.stringify(patient),
  });

export const updatePatient = (id: string, patient: Partial<Patient>) =>
  apiFetch<{ message: string; patient: Patient }>(`/api/patients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patient),
  });

export const deletePatient = (id: string) =>
  apiFetch<{ message: string }>(`/api/patients/${id}`, {
    method: 'DELETE',
  });

// --- ANALİZLER ---
export interface AnalysisItem {
  id: string;
  protocol_no: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  malignancy_probability: number | null;
  risk_level: 'Yüksek risk' | 'İnceleniyor' | 'Düşük risk' | null;
  classification_label: string | null;
  model_confidence: number | null;
  classification_model?: string;
  model_version?: string;
  xai_heatmap_url?: string | null;
  xai_explanation?: string | null;
  doctor_notes?: string | null;
  final_decision?: string | null;
  is_reviewed: boolean;
  reviewed_at?: string | null;
  requested_at?: string;
  completed_at?: string | null;
  patient: {
    id: string;
    tc_no: string;
    first_name: string;
    last_name: string;
    date_of_birth: string;
    gender: string;
    phone: string;
  };
  image: {
    id: string;
    url: string;
    original_filename: string;
    laterality?: string;
    view_position?: string;
    acquisition_date?: string;
  };
}

export const fetchAnalyses = (patientId?: string, page: number = 1, limit: number = 20) => {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (patientId) query.set('patient_id', patientId);
  return apiFetch<{ analyses: AnalysisItem[]; page: number; limit: number }>(`/api/analyses?${query.toString()}`);
};

// --- BİLDİRİMLER (NOTIFICATIONS) ---
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'alert' | 'warning' | 'info' | 'success';
  link?: string | null;
  related_id?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export const fetchNotifications = () =>
  apiFetch<{ unread_count: number; notifications: AppNotification[] }>('/api/notifications');

export const markNotificationAsRead = (id: string) =>
  apiFetch<{ message: string }>(`/api/notifications/${id}/read`, { method: 'PUT' });

export const markAllNotificationsAsRead = () =>
  apiFetch<{ message: string }>('/api/notifications/read-all', { method: 'PUT' });
