import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { getDoctor, type AppNotification } from '../lib/api';
import '../styles/dashboard.css';

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'alert' | 'info';
}

type ToastType = ToastItem['type'];

interface ShowToastOptions {
  // false ise toast bildirim geçmişine (zil ikonu) kaydedilmez.
  // Varsayılan: 'error' dışındaki tüm toast'lar kaydedilir (form doğrulama hataları zili kirletmesin).
  persist?: boolean;
}

interface ToastContextType {
  showToast: (title: string, message: string, type?: ToastType, options?: ShowToastOptions) => void;
  // Toast'lardan türetilen, tarayıcıda saklanan yerel bildirimler
  localNotifications: AppNotification[];
  refreshLocalNotifications: () => void;
  markLocalNotificationAsRead: (id: string) => void;
  markAllLocalNotificationsAsRead: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const LOCAL_NOTIF_LIMIT = 50;
export const LOCAL_NOTIF_PREFIX = 'local-';

// Her doktorun yerel bildirimleri ayrı anahtarda tutulur
const storageKey = () => {
  const doctorId = getDoctor()?.id;
  return doctorId ? `mammoai_local_notifications_${doctorId}` : null;
};

const readLocal = (): AppNotification[] => {
  const key = storageKey();
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as AppNotification[]) : [];
  } catch {
    return [];
  }
};

const writeLocal = (items: AppNotification[]) => {
  const key = storageKey();
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(items.slice(0, LOCAL_NOTIF_LIMIT)));
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [localNotifications, setLocalNotifications] = useState<AppNotification[]>(readLocal);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateLocal = useCallback((updater: (prev: AppNotification[]) => AppNotification[]) => {
    const next = updater(readLocal());
    writeLocal(next);
    setLocalNotifications(next.slice(0, LOCAL_NOTIF_LIMIT));
  }, []);

  const showToast = useCallback(
    (title: string, message: string, type: ToastType = 'info', options?: ShowToastOptions) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, title, message, type }]);

      setTimeout(() => {
        removeToast(id);
      }, 5000);

      const shouldPersist = options?.persist ?? type !== 'error';
      if (shouldPersist && storageKey()) {
        const notification: AppNotification = {
          id: `${LOCAL_NOTIF_PREFIX}${id}`,
          title,
          message,
          type: type === 'error' ? 'alert' : type,
          link: null,
          is_read: false,
          created_at: new Date().toISOString(),
        };
        updateLocal((prev) => [notification, ...prev]);
      }
    },
    [removeToast, updateLocal]
  );

  // Oturum açan doktor değiştiğinde (login/logout) doğru listeyi yükle
  const refreshLocalNotifications = useCallback(() => {
    setLocalNotifications(readLocal());
  }, []);

  const markLocalNotificationAsRead = useCallback(
    (id: string) => {
      updateLocal((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
    },
    [updateLocal]
  );

  const markAllLocalNotificationsAsRead = useCallback(() => {
    const now = new Date().toISOString();
    updateLocal((prev) => prev.map((n) => (n.is_read ? n : { ...n, is_read: true, read_at: now })));
  }, [updateLocal]);

  const getIcon = (type: ToastItem['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={20} color="#16a34a" />;
      case 'error':
        return <AlertCircle size={20} color="#dc2626" />;
      case 'alert':
        return <AlertTriangle size={20} color="#dc2626" />;
      default:
        return <Info size={20} color="#0284c7" />;
    }
  };

  return (
    <ToastContext.Provider
      value={{
        showToast,
        localNotifications,
        refreshLocalNotifications,
        markLocalNotificationAsRead,
        markAllLocalNotificationsAsRead,
      }}
    >
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-card ${t.type}`}>
            <div>{getIcon(t.type)}</div>
            <div className="toast-content">
              <div className="toast-title">{t.title}</div>
              <div className="toast-message">{t.message}</div>
            </div>
            <button
              type="button"
              className="toast-close-btn"
              onClick={() => removeToast(t.id)}
              aria-label="Kapat"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
