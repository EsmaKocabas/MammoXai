import { useEffect, useState, useRef, useMemo } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Activity,
  LogOut,
  HeartPulse,
  Bell,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  clearSession,
  getDoctor,
  getMe,
  updateStoredDoctor,
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getToken,
  type Doctor,
  type AppNotification,
} from '../lib/api';
import { useToast, LOCAL_NOTIF_PREFIX } from './ToastContext';
import '../styles/dashboard.css';

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    showToast,
    localNotifications,
    refreshLocalNotifications,
    markLocalNotificationAsRead,
    markAllLocalNotificationsAsRead,
  } = useToast();
  const [doctor, setDoctor] = useState<Doctor | null>(getDoctor());

  // Bildirim state'leri
  const [serverNotifications, setServerNotifications] = useState<AppNotification[]>([]);
  const [serverUnreadCount, setServerUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Oturum açan doktora ait yerel (toast) bildirimleri yükle
  useEffect(() => {
    refreshLocalNotifications();
  }, [doctor?.id, refreshLocalNotifications]);

  // Backend bildirimleri + toast'lardan gelen yerel bildirimler (en yeni üstte)
  const notifications = useMemo(
    () =>
      [...serverNotifications, ...localNotifications].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [serverNotifications, localNotifications]
  );

  const unreadCount =
    serverUnreadCount + localNotifications.filter((n) => !n.is_read).length;

  // Sayfa başlığı
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/dashboard/patients':
        return 'Hastalar & Vakalar';
      case '/dashboard/analyses':
        return 'Mamografi Analizleri & AI Karar Desteği';
      case '/dashboard/profile':
        return 'Doktor Profili & Ayarlar';
      default:
        return 'Genel Bakış';
    }
  };

  // Giriş yapmış doktor bilgilerini al
  useEffect(() => {
    getMe()
      .then((res) => {
        if (res?.doctor) {
          setDoctor(res.doctor);
          updateStoredDoctor(res.doctor);
        }
      })
      .catch(() => undefined);
  }, []);

  // Bildirimleri periyodik olarak ve ilk açılışta yükle
  const loadNotifications = () => {
    fetchNotifications()
      .then((data) => {
        setServerNotifications(data.notifications || []);
        setServerUnreadCount(data.unread_count || 0);
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 15000); // 15 saniyede bir kontrol
    return () => clearInterval(interval);
  }, []);

  // Canlı Push Bildirim Bağlantısı (SSE - Server-Sent Events)
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    let eventSource: EventSource | null = null;
    try {
      // EventSource tarayıcı desteği ile canlı akışa bağlan
      eventSource = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'connected') return;

          // Yeni bildirim geldiğinde listeye ekle ve Toast uyarısı ver
          setServerUnreadCount((prev) => prev + 1);
          setServerNotifications((prev) => [payload, ...prev]);

          // Backend'de zaten kayıtlı; yerel geçmişe tekrar yazma (persist: false)
          showToast(
            payload.title || 'Yeni Bildirim',
            payload.message || 'Sisteminizde yeni bir vaka güncellemesi var.',
            payload.type === 'alert' ? 'alert' : 'info',
            { persist: false }
          );
        } catch {
          // SSE format uyuşmazlığı
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
      };
    } catch {
      // EventSource başlatılamazsa periyodik polling devrede kalır
    }

    return () => {
      eventSource?.close();
    };
  }, [showToast]);

  // Dropdown dışına tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (notif: AppNotification) => {
    if (!notif.is_read) {
      if (notif.id.startsWith(LOCAL_NOTIF_PREFIX)) {
        markLocalNotificationAsRead(notif.id);
      } else {
        try {
          await markNotificationAsRead(notif.id);
          setServerNotifications((prev) =>
            prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
          );
          setServerUnreadCount((prev) => Math.max(0, prev - 1));
        } catch {
          // Hata durumunda yoksay
        }
      }
    }

    if (notif.link) {
      setShowDropdown(false);
      navigate(notif.link);
    }
  };

  const handleMarkAllRead = async () => {
    markAllLocalNotificationsAsRead();
    if (serverUnreadCount === 0) return;
    try {
      await markAllNotificationsAsRead();
      setServerNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setServerUnreadCount(0);
    } catch {
      // Hata durumunda yoksay
    }
  };

  const handleLogout = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  // İsimden baş harfleri türet (örn. "Aylin Yalçın" -> "AY")
  const getInitials = (name?: string) => {
    if (!name) return 'DR';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const displayName = doctor
    ? `${doctor.title ? `${doctor.title} ` : ''}${doctor.full_name}`
    : 'Dr. Doktor';

  const displaySpecialty = doctor?.specialty || doctor?.hospital || 'Radyoloji Uzmanı';

  const formatNotificationTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const diffMins = Math.floor((Date.now() - d.getTime()) / (1000 * 60));
      if (diffMins < 1) return 'Az önce';
      if (diffMins < 60) return `${diffMins} dk önce`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} saat önce`;
      return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  return (
    <div className="app-container">
      {/* Sol Menü (Sidebar) */}
      <aside className="sidebar">
        {/* Logo / Marka */}
        <div className="sidebar-brand">
          <div className="sidebar-logo-icon">
            <HeartPulse size={22} strokeWidth={2.2} />
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-title">MammoAI</span>
            <span className="sidebar-brand-subtitle">KLİNİK KARAR DESTEĞİ</span>
          </div>
        </div>

        {/* Menü Linkleri */}
        <nav className="sidebar-nav">
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            <LayoutDashboard size={18} />
            <span>Genel bakış</span>
          </NavLink>

          <NavLink
            to="/dashboard/patients"
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            <Users size={18} />
            <span>Hastalar</span>
          </NavLink>

          <NavLink
            to="/dashboard/analyses"
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            <Activity size={18} />
            <span>Analizler</span>
          </NavLink>
        </nav>

        {/* Alt Kısım: Doktor Profili & Çıkış Yap */}
        <div className="sidebar-footer">
          <NavLink
            to="/dashboard/profile"
            className={`doctor-profile-card ${
              location.pathname === '/dashboard/profile' ? 'active' : ''
            }`}
            title="Profil ve Hesap Ayarları"
          >
            <div className="doctor-avatar">
              {getInitials(doctor?.full_name)}
            </div>
            <div className="doctor-info">
              <span className="doctor-name">{displayName}</span>
              <span className="doctor-role">{displaySpecialty}</span>
            </div>
          </NavLink>

          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
            title="Oturumu Kapat"
          >
            <LogOut size={16} />
            <span>Çıkış Yap</span>
          </button>
        </div>
      </aside>

      {/* Sağ Ana İçerik ve Üst Bar */}
      <div className="main-wrapper">
        {/* Üst Bar (Top Bar) */}
        <header className="top-bar">
          <div className="top-bar-left">
            <span className="top-bar-title">{getPageTitle()}</span>
          </div>

          <div className="top-bar-right" ref={dropdownRef}>
            {/* Bildirimler Butonu */}
            <button
              type="button"
              className={`top-bar-btn ${showDropdown ? 'active' : ''}`}
              onClick={() => setShowDropdown((prev) => !prev)}
              title="Bildirimler"
              aria-label="Bildirimler"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="notification-badge">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Bildirimler Açılır Paneli (Dropdown) */}
            {showDropdown && (
              <div className="notifications-dropdown">
                <div className="dropdown-header">
                  <h4>Bildirimler</h4>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      className="mark-all-btn"
                      onClick={handleMarkAllRead}
                    >
                      Tümünü okundu işaretle
                    </button>
                  )}
                </div>

                <div className="notifications-list">
                  {notifications.length === 0 ? (
                    <div className="notifications-empty">
                      Henüz bildirim bulunmuyor.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`notification-item ${!n.is_read ? 'unread' : ''}`}
                        onClick={() => handleMarkAsRead(n)}
                      >
                        <div className={`notification-icon ${n.type === 'alert' || n.type === 'warning' ? 'alert' : 'info'}`}>
                          {n.type === 'alert' || n.type === 'warning' ? (
                            <AlertTriangle size={16} />
                          ) : (
                            <CheckCircle2 size={16} />
                          )}
                        </div>
                        <div className="notification-body">
                          <div className="notification-title">{n.title}</div>
                          <div className="notification-msg">{n.message}</div>
                          <div className="notification-time">
                            {formatNotificationTime(n.created_at)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Sayfa İçeriği */}
        <Outlet context={{ doctor, setDoctor }} />
      </div>
    </div>
  );
}
