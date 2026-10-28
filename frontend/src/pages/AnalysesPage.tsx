import { useState, useEffect } from 'react';
import {
  Activity,
  Search,
  Filter,
  Eye,
  X,
  FileCheck2,
  Layers,
} from 'lucide-react';
import {
  fetchAnalyses,
  type AnalysisItem,
} from '../lib/api';
import '../styles/dashboard.css';

export default function AnalysesPage() {
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'high' | 'pending' | 'low'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisItem | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchAnalyses()
      .then((res) => {
        setAnalyses(res.analyses || []);
      })
      .catch((err) => {
        console.warn('Analizler yüklenemedi:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const filteredItems = analyses.filter((item) => {
    // Arama filtresi
    const matchesSearch =
      item.protocol_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${item.patient?.first_name || ''} ${item.patient?.last_name || ''}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    // Durum filtresi
    if (!matchesSearch) return false;
    if (selectedFilter === 'high') return item.risk_level === 'Yüksek risk';
    if (selectedFilter === 'pending')
      return item.risk_level === 'İnceleniyor' || item.status === 'processing';
    if (selectedFilter === 'low') return item.risk_level === 'Düşük risk';
    return true;
  });

  return (
    <div className="dashboard-content">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Mamografi Analizleri & AI Karar Desteği</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#64748b' }}>
            EfficientNet-B4 derin öğrenme ve Grad-CAM++ açıklanabilir yapay zeka sonuçları
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="search-input-box">
            <Search size={18} color="#94a3b8" />
            <input
              type="text"
              placeholder="Protokol no veya hasta adı..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Filtreleme Butonları */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b', marginRight: 6 }}>
          <Filter size={15} />
          <span>Filtrele:</span>
        </div>
        <button
          type="button"
          className={selectedFilter === 'all' ? 'btn-new-analysis' : 'btn-secondary'}
          style={{ padding: '6px 14px', fontSize: 13 }}
          onClick={() => setSelectedFilter('all')}
        >
          Tümü ({analyses.length})
        </button>
        <button
          type="button"
          className={selectedFilter === 'high' ? 'btn-new-analysis' : 'btn-secondary'}
          style={{ padding: '6px 14px', fontSize: 13 }}
          onClick={() => setSelectedFilter('high')}
        >
          Yüksek Risk
        </button>
        <button
          type="button"
          className={selectedFilter === 'pending' ? 'btn-new-analysis' : 'btn-secondary'}
          style={{ padding: '6px 14px', fontSize: 13 }}
          onClick={() => setSelectedFilter('pending')}
        >
          İnceleniyor
        </button>
        <button
          type="button"
          className={selectedFilter === 'low' ? 'btn-new-analysis' : 'btn-secondary'}
          style={{ padding: '6px 14px', fontSize: 13 }}
          onClick={() => setSelectedFilter('low')}
        >
          Düşük Risk
        </button>
      </div>

      {/* Analizler Tablosu */}
      <div className="recent-cases-card">
        <div className="cases-table-wrapper">
          <table className="cases-table">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>PROTOKOL NO</th>
                <th style={{ width: '26%' }}>HASTA</th>
                <th style={{ width: '20%' }}>POZİSYON & ÇEKİM</th>
                <th style={{ width: '18%' }}>DURUM & RİSK</th>
                <th style={{ width: '14%', textAlign: 'right' }}>İŞLEMLER</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '36px 14px', color: '#64748b' }}>
                    Analizler yükleniyor...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '36px 14px', color: '#64748b' }}>
                    {searchQuery || selectedFilter !== 'all'
                      ? 'Kriterlere uygun analiz bulunamadı.'
                      : 'Henüz gerçekleştirilmiş bir mamografi analizi bulunmuyor.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isHigh = item.risk_level === 'Yüksek risk';
                  const isPending =
                    item.risk_level === 'İnceleniyor' || item.status === 'processing';
                  const pillClass = isHigh
                    ? 'high-risk'
                    : isPending
                    ? 'pending'
                    : 'low-risk';

                  const pctStr =
                    item.malignancy_probability !== null && item.malignancy_probability !== undefined
                      ? `%${Math.round(Number(item.malignancy_probability) * 100)}`
                      : '—';

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="patient-cell">
                          <span className="patient-name-text" style={{ fontFamily: 'monospace' }}>
                            {item.protocol_no}
                          </span>
                          <span className="patient-protocol-text">
                            Model: {item.classification_model || 'EfficientNet-B4'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="patient-cell">
                          <span className="patient-name-text">
                            {item.patient?.first_name} {item.patient?.last_name}
                          </span>
                          <span className="patient-protocol-text">
                            TC: {item.patient?.tc_no}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="date-text">
                          {item.image?.laterality || 'Bilateral'} • {item.image?.view_position || 'MLO'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className={`status-pill ${pillClass}`}>
                            {item.risk_level || (isPending ? 'İnceleniyor' : 'Düşük risk')}
                          </span>
                          <span className="risk-percent-text">{pctStr}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: 12.5 }}
                          onClick={() => setSelectedAnalysis(item)}
                        >
                          <Eye size={14} />
                          <span>Rapor</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Analiz ve XAI Detay Modalı */}
      {selectedAnalysis && (
        <div className="modal-overlay" onClick={() => setSelectedAnalysis(null)}>
          <div className="modal-card" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                  <Activity size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                    Analiz Raporu: {selectedAnalysis.protocol_no}
                  </h3>
                  <span style={{ fontSize: 12.5, color: '#64748b' }}>
                    Hasta: {selectedAnalysis.patient?.first_name} {selectedAnalysis.patient?.last_name}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAnalysis(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13.5 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: '#f8fafc', padding: 16, borderRadius: 14 }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: 12 }}>Malignite Olasılığı</span>
                  <div style={{ fontSize: 20, fontWeight: 700, color: selectedAnalysis.risk_level === 'Yüksek risk' ? '#b91c1c' : '#0f172a' }}>
                    {selectedAnalysis.malignancy_probability !== null
                      ? `%${(Number(selectedAnalysis.malignancy_probability) * 100).toFixed(1)}`
                      : 'Hesaplanıyor'}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: 12 }}>Model Güven Skoru</span>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#00766c' }}>
                    {selectedAnalysis.model_confidence !== null
                      ? `%${(Number(selectedAnalysis.model_confidence) * 100).toFixed(1)}`
                      : '—'}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: 12 }}>Sınıflandırma Etiketi</span>
                  <div style={{ fontWeight: 600, color: '#334155', marginTop: 2 }}>
                    {selectedAnalysis.classification_label || 'İnceleniyor'}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: 12 }}>Model Mimarisi</span>
                  <div style={{ fontWeight: 600, color: '#334155', marginTop: 2 }}>
                    {selectedAnalysis.classification_model || 'EfficientNet-B4'}
                  </div>
                </div>
              </div>

              {selectedAnalysis.xai_explanation && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>
                    <Layers size={16} color="#00766c" />
                    <span>Grad-CAM++ Açıklanabilirlik Bulguları:</span>
                  </div>
                  <p style={{ margin: 0, color: '#475569', lineHeight: 1.5, background: '#fff', border: '1px solid #e2e8f0', padding: 12, borderRadius: 10 }}>
                    {selectedAnalysis.xai_explanation}
                  </p>
                </div>
              )}

              {selectedAnalysis.doctor_notes && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>
                    <FileCheck2 size={16} color="#00766c" />
                    <span>Doktor Değerlendirme Notu:</span>
                  </div>
                  <p style={{ margin: 0, color: '#475569', lineHeight: 1.5, background: '#fff', border: '1px solid #e2e8f0', padding: 12, borderRadius: 10 }}>
                    {selectedAnalysis.doctor_notes}
                  </p>
                </div>
              )}
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedAnalysis(null)}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
