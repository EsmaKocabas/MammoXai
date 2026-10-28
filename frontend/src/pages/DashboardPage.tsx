import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  Users,
  Image as ImageIcon,
  Activity,
  Check,
  Plus,
  Info,
} from 'lucide-react';
import {
  fetchDashboardStats,
  type DashboardStats,
  type RecentAnalysis,
  type Doctor,
} from '../lib/api';
import '../styles/dashboard.css';

export default function DashboardPage() {
  const { doctor } = useOutletContext<{ doctor: Doctor | null }>();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<RecentAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewAnalysisNotice, setShowNewAnalysisNotice] = useState(false);

  // Tarih biçimlendirme: "28 Ekim 2026, Çarşamba"
  const today = new Date();
  const formattedDate = today.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  });

  // Saate göre dinamik selamlama (Günaydın, İyi günler/öğlenler, İyi akşamlar)
  const getGreeting = () => {
    const hour = today.getHours();
    if (hour >= 5 && hour < 12) return 'Günaydın';
    if (hour >= 12 && hour < 18) return 'İyi günler';
    return 'İyi akşamlar';
  };

  // Doktor ismi kısaltma (örn. "Dr. Aylin" ya da "Dr. Aylin Yalçın")
  const doctorGreetingName = doctor
    ? `Dr. ${doctor.full_name.split(' ')[0]}`
    : 'Doktor';

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchDashboardStats()
      .then((data) => {
        if (!isMounted) return;
        setStats(data.stats);
        setRecentAnalyses(data.recent_analyses || []);
      })
      .catch((err) => {
        console.warn('Dashboard verisi alınamadı:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Dinamik istatistik hesaplamaları
  const totalCount = stats?.total_analyses ?? 0;
  const pendingCount = stats?.pending_analyses ?? 0;
  const highRiskCount = stats?.high_risk_count ?? 0;
  const completedCount = stats?.completed_analyses ?? 0;
  const todayAwaiting = stats?.today_awaiting_review ?? stats?.awaiting_review ?? 0;

  // Dinamik kart alt yazıları
  const monthlyText = stats?.this_month_analyses
    ? `+${stats.this_month_analyses} bu ay`
    : 'Bu ay yeni vaka yok';

  const pendingText = stats?.urgent_pending_count
    ? `${stats.urgent_pending_count} yüksek öncelik`
    : pendingCount > 0
    ? `${pendingCount} beklemede`
    : 'Öncelikli bekleyen yok';

  const highRiskRatioText =
    totalCount > 0
      ? `Tüm vakaların %${((highRiskCount / totalCount) * 100).toFixed(1).replace('.', ',')}'i`
      : 'Yüksek riskli vaka yok';

  const completionRatioText =
    totalCount > 0
      ? `%${Math.round((completedCount / totalCount) * 100)} tamamlama oranı`
      : '%0 tamamlama oranı';

  // Dinamik karşılama alt yazısı
  const subtitleText = loading
    ? 'İstatistikler yükleniyor...'
    : todayAwaiting > 0
    ? `Bugün değerlendirilmesi gereken ${todayAwaiting} yeni vaka var.`
    : 'Bugün değerlendirilmesi gereken yeni vaka bulunmuyor.';

  // Tarih gösterimi biçimlendirici
  const formatCaseDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const isToday = d.toDateString() === today.toDateString();
      const timeStr = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      if (isToday) return `Bugün, ${timeStr}`;
      return `${d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}, ${timeStr}`;
    } catch {
      return '—';
    }
  };

  // Risk yüzdesi biçimlendirici
  const formatRiskPercent = (val: number | null, riskLevel: string | null) => {
    if (val !== null && val !== undefined) {
      const pct = Math.round(Number(val) * 100);
      return `${pct < 10 ? '0' : ''}${pct}%`;
    }
    if (riskLevel === 'İnceleniyor') return '—';
    return '—';
  };

  return (
    <div className="dashboard-content">
      {/* Üst Karşılama ve Başlık */}
      <div className="dashboard-header">
        <div>
          <div className="dashboard-date">{formattedDate}</div>
          <h1 className="dashboard-title">
            {getGreeting()}, {doctorGreetingName}
          </h1>
          <p className="dashboard-subtitle">{subtitleText}</p>
        </div>

        {/* Yeni Analiz Butonu */}
        <button
          type="button"
          className="btn-new-analysis"
          onClick={() => setShowNewAnalysisNotice(true)}
          title="Yeni mamografi analizi başlat"
        >
          <Plus size={18} strokeWidth={2.4} />
          <span>Yeni analiz</span>
        </button>
      </div>

      {/* İstatistik Kartları (Tamamen Veritabanından Dinamik 4 Kart) */}
      <div className="stats-grid">
        {/* 1. Toplam Vaka */}
        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">Toplam vaka</span>
            <span className="stat-value">{loading ? '—' : totalCount}</span>
            <span className="stat-subtext">{loading ? '...' : monthlyText}</span>
          </div>
          <div className="stat-icon-wrapper teal">
            <Users size={22} />
          </div>
        </div>

        {/* 2. Analiz Bekleyen */}
        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">Analiz bekleyen</span>
            <span className="stat-value">
              {loading
                ? '—'
                : pendingCount < 10
                ? `0${pendingCount}`
                : pendingCount}
            </span>
            <span className="stat-subtext">{loading ? '...' : pendingText}</span>
          </div>
          <div className="stat-icon-wrapper amber">
            <ImageIcon size={22} />
          </div>
        </div>

        {/* 3. Yüksek Risk */}
        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">Yüksek risk</span>
            <span className="stat-value">{loading ? '—' : highRiskCount}</span>
            <span className="stat-subtext">{loading ? '...' : highRiskRatioText}</span>
          </div>
          <div className="stat-icon-wrapper rose">
            <Activity size={22} />
          </div>
        </div>

        {/* 4. Tamamlanan */}
        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">Tamamlanan</span>
            <span className="stat-value">{loading ? '—' : completedCount}</span>
            <span className="stat-subtext">{loading ? '...' : completionRatioText}</span>
          </div>
          <div className="stat-icon-wrapper blue">
            <Check size={22} strokeWidth={2.6} />
          </div>
        </div>
      </div>

      {/* Son Vakalar Tablosu (Doğrudan Veritabanı Son 5 Vaka) */}
      <div className="recent-cases-card">
        <div className="card-header-flex">
          <div>
            <h2 className="card-title">Son vakalar</h2>
            <p className="card-subtitle">Son yüklenen mamografi analizleri</p>
          </div>
          <Link to="/dashboard/patients" className="card-action-link">
            Tümünü gör
          </Link>
        </div>

        <div className="cases-table-wrapper">
          <table className="cases-table">
            <thead>
              <tr>
                <th style={{ width: '38%' }}>HASTA</th>
                <th style={{ width: '26%' }}>TARİH</th>
                <th style={{ width: '22%' }}>DURUM</th>
                <th style={{ width: '14%', textAlign: 'right' }}>RİSK</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '36px 14px', color: '#64748b' }}>
                    Vakalar yükleniyor...
                  </td>
                </tr>
              ) : recentAnalyses.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '36px 14px', color: '#64748b' }}>
                    Henüz kayıtlı bir vaka veya analiz bulunmuyor.
                  </td>
                </tr>
              ) : (
                recentAnalyses.slice(0, 5).map((item) => {
                  const isHigh = item.risk_level === 'Yüksek risk';
                  const isPending =
                    item.risk_level === 'İnceleniyor' ||
                    item.status === 'processing' ||
                    item.status === 'pending';
                  const pillClass = isHigh
                    ? 'high-risk'
                    : isPending
                    ? 'pending'
                    : 'low-risk';

                  const displayRiskLevel =
                    item.risk_level || (isPending ? 'İnceleniyor' : 'Düşük risk');

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="patient-cell">
                          <span className="patient-name-text">
                            {item.patient_name}
                          </span>
                          <span className="patient-protocol-text">
                            {item.protocol_no}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="date-text">
                          {formatCaseDate(item.created_at)}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${pillClass}`}>
                          {displayRiskLevel}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="risk-percent-text">
                          {formatRiskPercent(item.malignancy_probability, item.risk_level)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Yeni Analiz Bilgilendirme Modalı */}
      {showNewAnalysisNotice && (
        <div className="modal-overlay" onClick={() => setShowNewAnalysisNotice(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'var(--color-dash-teal-light)',
                  color: 'var(--color-dash-teal)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Info size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  Yeni Analiz Modülü
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
                  Mamografi DICOM / Görüntü Yükleme
                </p>
              </div>
            </div>

            <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.6, marginBottom: 20 }}>
              Mamografi görüntüsü yükleme ve EfficientNet-B4 + Grad-CAM++ yapay zeka analiz akışı bir sonraki geliştirme aşamasında doğrudan bu butona entegre edilecektir.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn-new-analysis"
                onClick={() => setShowNewAnalysisNotice(false)}
              >
                Anladım
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
