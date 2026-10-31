import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Users,
  Image as ImageIcon,
  Activity,
  Check,
  Plus,
  X,
  UploadCloud,
  FileImage,
  Trash2,
  Sparkles,
  Loader2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import {
  fetchDashboardStats,
  fetchPatients,
  createAnalysis,
  type DashboardStats,
  type RecentAnalysis,
  type Doctor,
  type Patient,
} from '../lib/api';
import { useToast } from '../components/ToastContext';
import '../styles/dashboard.css';

export default function DashboardPage() {
  const { doctor } = useOutletContext<{ doctor: Doctor | null }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<RecentAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  // Yeni Analiz Modalı Durumları
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);

  // Form Durumları
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [laterality, setLaterality] = useState<'Sol' | 'Sağ' | 'İkili'>('Sol');
  const [viewPosition, setViewPosition] = useState<string>('MLO');
  const [acquisitionDate, setAcquisitionDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [equipmentModel, setEquipmentModel] = useState<string>('');

  // Sürükle-bırak & AI İşleme Durumu
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStepText, setAnalysisStepText] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Tarih biçimlendirme: "28 Ekim 2026, Çarşamba"
  const today = new Date();
  const formattedDate = today.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  });

  // Saate göre dinamik selamlama
  const getGreeting = () => {
    const hour = today.getHours();
    if (hour >= 5 && hour < 12) return 'Günaydın';
    if (hour >= 12 && hour < 18) return 'İyi günler';
    return 'İyi akşamlar';
  };

  const doctorGreetingName = doctor
    ? `Dr. ${doctor.full_name.split(' ')[0]}`
    : 'Doktor';

  const loadDashboardData = () => {
    setLoading(true);
    fetchDashboardStats()
      .then((data) => {
        setStats(data.stats);
        setRecentAnalyses(data.recent_analyses || []);
      })
      .catch((err) => {
        console.warn('Dashboard verisi alınamadı:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Modal Açma Fonksiyonu & Hastaları Yükleme
  const handleOpenModal = async () => {
    setIsModalOpen(true);
    setModalError(null);

    if (patients.length === 0) {
      setLoadingPatients(true);
      try {
        const res = await fetchPatients('', 100);
        setPatients(res.patients || []);
        if (res.patients && res.patients.length > 0 && !selectedPatientId) {
          setSelectedPatientId(res.patients[0].id);
        }
      } catch (err: any) {
        setModalError('Hasta listesi yüklenemedi: ' + (err.message || 'Sunucu hatası'));
      } finally {
        setLoadingPatients(false);
      }
    } else if (!selectedPatientId && patients.length > 0) {
      setSelectedPatientId(patients[0].id);
    }
  };

  // Modal Kapatma
  const handleCloseModal = () => {
    if (isAnalyzing) return; // Analiz devam ederken kapatmayı engelle
    setIsModalOpen(false);
    resetModalForm();
  };

  const resetModalForm = () => {
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    setSelectedFile(null);
    setFilePreview(null);
    setModalError(null);
    setIsAnalyzing(false);
    setAnalysisStepText('');
  };

  // Dosya Seçim & Doğrulama
  const handleFileProcess = (file: File) => {
    setModalError(null);

    // Format kontrolü (PNG veya JPEG)
    const validMimes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validMimes.includes(file.type)) {
      setModalError('Yalnızca PNG veya JPEG formatında mamografi görüntüsü yüklenebilir.');
      return;
    }

    // Boyut kontrolü (Maks 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setModalError('Görüntü boyutu 50MB sınırını aşamaz.');
      return;
    }

    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }

    setSelectedFile(file);
    setFilePreview(URL.createObjectURL(file));
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileProcess(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isAnalyzing) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isAnalyzing) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileProcess(files[0]);
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Dosya Boyutu Formatlayıcı
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Yapay Zeka Modelini Çalıştırma (Analiz Et)
  const handleSubmitAnalysis = async () => {
    if (!selectedPatientId) {
      setModalError('Lütfen analiz yapılacak hastayı seçiniz.');
      return;
    }
    if (!selectedFile) {
      setModalError('Lütfen analiz edilecek mamografi görüntüsünü yükleyiniz.');
      return;
    }

    setModalError(null);
    setIsAnalyzing(true);
    setAnalysisStepText('Mamografi görüntüsü sunucuya iletiliyor...');

    const stepTimer = setTimeout(() => {
      setAnalysisStepText('EfficientNet-B4 derin öğrenme modeli ve Grad-CAM++ açıklanabilirlik haritası hesaplanıyor...');
    }, 1800);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('patient_id', selectedPatientId);
      formData.append('laterality', laterality);
      formData.append('view_position', viewPosition);
      if (acquisitionDate) {
        formData.append('acquisition_date', acquisitionDate);
      }
      if (equipmentModel.trim()) {
        formData.append('equipment_model', equipmentModel.trim());
      }

      const res = await createAnalysis(formData);
      clearTimeout(stepTimer);

      const protocol = res.analysis?.protocol_no || 'Yeni analiz';
      const risk = res.analysis?.risk_level || 'Tamamlandı';

      showToast(
        '✅ Analiz Başarıyla Tamamlandı',
        `${protocol} nolu vaka yapay zeka tarafından incelendi. Sonuç: ${risk}`,
        'success'
      );

      // Modalı kapat ve temizle
      handleCloseModal();

      // Dashboard verilerini arka planda güncelle
      loadDashboardData();

      // Çıktıyı doğrudan görmek üzere Analizler sayfasına yönlendir
      navigate('/dashboard/analyses');
    } catch (err: any) {
      clearTimeout(stepTimer);
      setIsAnalyzing(false);
      const errMsg = err?.message || 'Mamografi analizi sırasında beklenmeyen bir hata oluştu.';
      setModalError(errMsg);
      showToast('Analiz Başarısız Oldu', errMsg, 'error');
    }
  };

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
          onClick={handleOpenModal}
          title="Yeni mamografi analizi başlat"
        >
          <Plus size={18} strokeWidth={2.4} />
          <span>Yeni analiz</span>
        </button>
      </div>

      {/* İstatistik Kartları */}
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

      {/* Son Vakalar Tablosu */}
      <div className="recent-cases-card">
        <div className="card-header-flex">
          <div>
            <h2 className="card-title">Son vakalar</h2>
            <p className="card-subtitle">Son yüklenen mamografi analizleri</p>
          </div>
          <Link to="/dashboard/analyses" className="card-action-link">
            Tüm analizleri gör
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

      {/* YENİ MAMOGRAFİ ANALİZİ MODALI */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div
            className="modal-card analysis-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="modal-header-flex">
              <div className="modal-header-left">
                <div className="modal-header-icon">
                  <Sparkles size={22} />
                </div>
                <div>
                  <h3 className="modal-header-title">Yeni Mamografi Analizi</h3>
                  <p className="modal-header-subtitle">
                    Yapay Zeka (EfficientNet-B4) & Grad-CAM++ Açıklanabilir Karar Desteği
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseModal}
                disabled={isAnalyzing}
                title="Kapat"
              >
                <X size={20} />
              </button>
            </div>

            {/* Hata Bildirimi */}
            {modalError && (
              <div className="alert-message error" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
                <AlertCircle size={18} />
                <span>{modalError}</span>
              </div>
            )}

            {/* Hasta Seçimi */}
            <div className="form-group" style={{ marginBottom: 18 }}>
              <label htmlFor="analysis-patient-select">
                Hasta Seçimi <span style={{ color: '#dc2626' }}>*</span>
              </label>
              {loadingPatients ? (
                <div style={{ fontSize: 13, color: '#64748b', padding: '8px 0' }}>
                  Hastalar yükleniyor...
                </div>
              ) : patients.length === 0 ? (
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}>
                  <p style={{ margin: '0 0 8px', color: '#64748b' }}>
                    Sistemde henüz kayıtlı bir hasta bulunmuyor.
                  </p>
                  <Link
                    to="/dashboard/patients"
                    style={{ color: '#00766c', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <span>Yeni hasta kaydı oluştur</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              ) : (
                <select
                  id="analysis-patient-select"
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  disabled={isAnalyzing}
                  style={{ fontWeight: 500 }}
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name} — TC: {p.tc_no}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Mamografi Görseli Yükleme Alanı (Dropzone & Preview) */}
            <div className="form-group" style={{ marginBottom: 18 }}>
              <label>
                Mamografi Görseli <span style={{ color: '#dc2626' }}>*</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                style={{ display: 'none' }}
                onChange={handleFileInputChange}
                disabled={isAnalyzing}
              />

              {!selectedFile ? (
                <div
                  className={`dropzone-container ${isDragging ? 'dragging' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !isAnalyzing && fileInputRef.current?.click()}
                >
                  <div className="dropzone-icon-box">
                    <UploadCloud size={28} />
                  </div>
                  <p className="dropzone-primary-text">
                    Görseli buraya sürükleyin veya <span>dosya seçin</span>
                  </p>
                  <p className="dropzone-hint">
                    Desteklenen formatlar: PNG, JPG, JPEG (Maks. 50 MB)
                  </p>
                </div>
              ) : (
                <div className="image-preview-card">
                  <div className="preview-thumb-wrapper">
                    {filePreview ? (
                      <img
                        src={filePreview}
                        alt="Mamografi Önizleme"
                        className="preview-thumb-img"
                      />
                    ) : (
                      <FileImage size={28} color="#94a3b8" />
                    )}
                  </div>
                  <div className="preview-details">
                    <p className="preview-filename">{selectedFile.name}</p>
                    <p className="preview-meta">
                      <span>{formatFileSize(selectedFile.size)}</span>
                      <span>•</span>
                      <span style={{ textTransform: 'uppercase' }}>
                        {selectedFile.type.split('/')[1] || 'IMG'}
                      </span>
                    </p>
                  </div>
                  {!isAnalyzing && (
                    <button
                      type="button"
                      className="preview-remove-btn"
                      onClick={handleRemoveFile}
                      title="Görseli kaldır"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Çekim Detayları (Grid: Lateralite & Pozisyon) */}
            <div className="form-grid-2" style={{ marginBottom: 18 }}>
              <div className="form-group">
                <label>Meme Yönü (Lateralite)</label>
                <select
                  value={laterality}
                  onChange={(e) => setLaterality(e.target.value as any)}
                  disabled={isAnalyzing}
                >
                  <option value="Sol">Sol Meme (Left)</option>
                  <option value="Sağ">Sağ Meme (Right)</option>
                  <option value="İkili">İkili (Bilateral)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Pozisyon Açısı</label>
                <select
                  value={viewPosition}
                  onChange={(e) => setViewPosition(e.target.value)}
                  disabled={isAnalyzing}
                >
                  <option value="MLO">MLO (Mediyo-Lateral Oblik)</option>
                  <option value="CC">CC (Kraniyo-Kaudal)</option>
                  <option value="Diğer">Diğer Pozisyon</option>
                </select>
              </div>
            </div>

            {/* Tarih ve Cihaz Bilgisi (Grid) */}
            <div className="form-grid-2" style={{ marginBottom: 20 }}>
              <div className="form-group">
                <label>Çekim Tarihi</label>
                <input
                  type="date"
                  value={acquisitionDate}
                  onChange={(e) => setAcquisitionDate(e.target.value)}
                  disabled={isAnalyzing}
                />
              </div>

              <div className="form-group">
                <label>Cihaz Modeli (Opsiyonel)</label>
                <input
                  type="text"
                  placeholder="Örn: Hologic Selenia Dimensions"
                  value={equipmentModel}
                  onChange={(e) => setEquipmentModel(e.target.value)}
                  disabled={isAnalyzing}
                />
              </div>
            </div>

            {/* AI İşleme Durumu Göstergesi */}
            {isAnalyzing && (
              <div className="ai-processing-box">
                <div className="ai-pulse-spinner" />
                <div className="ai-processing-text">
                  <h4>
                    <Sparkles size={16} />
                    <span>Yapay Zeka Modeli Çalışıyor</span>
                  </h4>
                  <p>{analysisStepText}</p>
                </div>
              </div>
            )}

            {/* Aksiyon Butonları */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 12,
                marginTop: isAnalyzing ? 18 : 24,
                paddingTop: 16,
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCloseModal}
                disabled={isAnalyzing}
              >
                İptal
              </button>

              <button
                type="button"
                className="btn-analyze-submit"
                onClick={handleSubmitAnalysis}
                disabled={isAnalyzing || !selectedFile || !selectedPatientId}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Analiz Ediliyor...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>Analiz Et</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

