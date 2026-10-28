import { useState, useEffect, type FormEvent } from 'react';
import {
  Users,
  Search,
  Plus,
  Trash2,
  FileText,
  AlertCircle,
  X,
  Phone,
  Mail,
  MapPin,
  User,
  Edit3,
  Save,
  RotateCcw,
} from 'lucide-react';
import {
  fetchPatients,
  createPatient,
  updatePatient,
  deletePatient,
  type Patient,
} from '../lib/api';
import { useToast } from '../components/ToastContext';
import '../styles/dashboard.css';

// Hasta form doğrulayıcı
const validatePatientForm = (data: {
  tc_no?: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone: string;
  checkTc?: boolean;
}): { valid: boolean; message?: string } => {
  if (data.checkTc && data.tc_no) {
    if (!/^[1-9]\d{10}$/.test(data.tc_no.trim())) {
      return {
        valid: false,
        message: 'TC Kimlik No tam 11 haneli olmalı, yalnızca rakamlardan oluşmalı ve 0 ile başlamamalıdır.',
      };
    }
  }

  if (!data.first_name.trim()) {
    return { valid: false, message: 'Hasta adı boş bırakılamaz.' };
  }

  if (!data.last_name.trim()) {
    return { valid: false, message: 'Hasta soyadı boş bırakılamaz.' };
  }

  if (!data.date_of_birth) {
    return { valid: false, message: 'Doğum tarihi seçimi zorunludur.' };
  }

  if (!/^\+[1-9]\d{7,14}$/.test(data.phone.trim())) {
    return {
      valid: false,
      message: 'Geçersiz telefon numarası. Ülke koduyla birlikte girin (Örnek: +905321234567).',
    };
  }

  return { valid: true };
};

export default function PatientsPage() {
  const { showToast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Detay & Güncelleme Modal State'leri
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Patient>>({});
  const [editModalError, setEditModalError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Yeni Hasta Modal State'leri
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [newPatient, setNewPatient] = useState({
    tc_no: '',
    first_name: '',
    last_name: '',
    date_of_birth: '1985-05-12',
    gender: 'Kadın' as 'Kadın' | 'Erkek' | 'Diğer',
    phone: '+905321234567',
    email: '',
    address: 'İstanbul',
    blood_type: 'A Rh+',
    allergies: 'Yok',
    chronic_diseases: 'Yok',
    family_history_of_cancer: false,
  });

  const loadPatients = (q: string = '') => {
    setLoading(true);
    fetchPatients(q)
      .then((res) => {
        setPatients(res.patients || []);
      })
      .catch((err) => {
        console.warn('Hastalar yüklenemedi:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadPatients(searchQuery);
  }, [searchQuery]);

  // Yeni Hasta Ekleme
  const handleCreatePatient = async (e: FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const validation = validatePatientForm({
      tc_no: newPatient.tc_no,
      first_name: newPatient.first_name,
      last_name: newPatient.last_name,
      date_of_birth: newPatient.date_of_birth,
      phone: newPatient.phone,
      checkTc: true,
    });

    if (!validation.valid) {
      const err = validation.message || 'Lütfen bilgileri eksiksiz ve doğru doldurun.';
      setModalError(err);
      showToast('Eksik / Geçersiz Bilgi', err, 'error');
      return;
    }

    try {
      const res = await createPatient(newPatient);
      setPatients([res.patient, ...patients]);
      setShowAddModal(false);
      showToast(
        'Hasta Kaydedildi',
        `${res.patient.first_name} ${res.patient.last_name} başarıyla sisteme eklendi.`,
        'success'
      );
      setNewPatient({
        tc_no: '',
        first_name: '',
        last_name: '',
        date_of_birth: '1985-05-12',
        gender: 'Kadın',
        phone: '+905321234567',
        email: '',
        address: 'İstanbul',
        blood_type: 'A Rh+',
        allergies: 'Yok',
        chronic_diseases: 'Yok',
        family_history_of_cancer: false,
      });
    } catch (err: any) {
      const errorMsg = err.message || 'Hasta eklenemedi.';
      setModalError(errorMsg);
      showToast('Hasta Kaydı Başarısız', errorMsg, 'error');
    }
  };

  // Hasta Detayını Açma
  const handleOpenDetail = (p: Patient) => {
    setSelectedPatient(p);
    setIsEditingPatient(false);
    setEditFormData({ ...p });
    setEditModalError(null);
  };

  // Hasta Bilgilerini Güncelleme
  const handleUpdatePatient = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    setEditModalError(null);

    const validation = validatePatientForm({
      first_name: editFormData.first_name || '',
      last_name: editFormData.last_name || '',
      date_of_birth: editFormData.date_of_birth || '',
      phone: editFormData.phone || '',
      checkTc: false,
    });

    if (!validation.valid) {
      const err = validation.message || 'Lütfen bilgileri eksiksiz doldurun.';
      setEditModalError(err);
      showToast('Güncelleme Hatası', err, 'error');
      return;
    }

    setSavingEdit(true);
    try {
      const res = await updatePatient(selectedPatient.id, editFormData);
      setSelectedPatient(res.patient);
      setPatients((prev) => prev.map((p) => (p.id === res.patient.id ? res.patient : p)));
      setIsEditingPatient(false);
      showToast(
        'Hasta Bilgileri Güncellendi',
        `${res.patient.first_name} ${res.patient.last_name} kaydı başarıyla güncellendi.`,
        'success'
      );
    } catch (err: any) {
      const errMsg = err.message || 'Hasta bilgileri güncellenirken hata oluştu.';
      setEditModalError(errMsg);
      showToast('Güncelleme Başarısız', errMsg, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  // Hasta Silme
  const handleDeletePatient = async (id: string, name: string) => {
    if (!confirm(`${name} isimli hastayı silmek istediğinizden emin misiniz?`)) return;
    try {
      await deletePatient(id);
      setPatients(patients.filter((p) => p.id !== id));
      if (selectedPatient?.id === id) setSelectedPatient(null);
      showToast('Hasta Silindi', `${name} başarıyla sistemden kaldırıldı.`, 'success');
    } catch (err: any) {
      const errorMsg = err.message || 'Hasta silinemedi.';
      showToast('Silme Başarısız', errorMsg, 'error');
    }
  };

  // Yaş hesapla
  const getAge = (dob?: string) => {
    if (!dob) return '-';
    try {
      const birth = new Date(dob);
      const diff = Date.now() - birth.getTime();
      const ageDate = new Date(diff);
      return Math.abs(ageDate.getUTCFullYear() - 1970);
    } catch {
      return '-';
    }
  };

  return (
    <div className="dashboard-content">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Hastalar & Vakalar</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#64748b' }}>
            Kayıtlı hastaların demografik ve mamografi vaka geçmişi
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="search-input-box">
            <Search size={18} color="#94a3b8" />
            <input
              type="text"
              placeholder="Hasta adı veya TC ile ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="btn-new-analysis"
            onClick={() => {
              setModalError(null);
              setShowAddModal(true);
            }}
          >
            <Plus size={18} strokeWidth={2.4} />
            <span>Yeni Hasta</span>
          </button>
        </div>
      </div>

      {/* Hasta Listesi Tablosu */}
      <div className="recent-cases-card">
        <div className="cases-table-wrapper">
          <table className="cases-table">
            <thead>
              <tr>
                <th style={{ width: '28%' }}>HASTA / TC NO</th>
                <th style={{ width: '18%' }}>YAŞ & CİNSİYET</th>
                <th style={{ width: '22%' }}>İLETİŞİM</th>
                <th style={{ width: '18%' }}>RİSK GEÇMİŞİ</th>
                <th style={{ width: '14%', textAlign: 'right' }}>İŞLEMLER</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '36px 14px', color: '#64748b' }}>
                    Hastalar yükleniyor...
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '36px 14px', color: '#64748b' }}>
                    {searchQuery
                      ? 'Aramanıza uygun hasta kaydı bulunamadı.'
                      : 'Sistemde henüz kayıtlı hasta bulunmuyor. Yeni hasta eklemek için yukarıdaki "+ Yeni Hasta" butonunu kullanabilirsiniz.'}
                  </td>
                </tr>
              ) : (
                patients.map((p) => {
                  const age = getAge(p.date_of_birth);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="patient-cell">
                          <span className="patient-name-text">
                            {p.first_name} {p.last_name}
                          </span>
                          <span className="patient-protocol-text">
                            TC: {p.tc_no}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="date-text">
                          {age} yaş • {p.gender}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, color: '#334155' }}>
                          <div>{p.phone}</div>
                          {p.email && <div style={{ fontSize: 12, color: '#64748b' }}>{p.email}</div>}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`status-pill ${
                            p.family_history_of_cancer ? 'high-risk' : 'low-risk'
                          }`}
                        >
                          {p.family_history_of_cancer ? 'Ailede Kanser Var' : 'Risk Belirtisi Yok'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '6px 10px', fontSize: 12 }}
                            onClick={() => handleOpenDetail(p)}
                            title="Vaka ve Hasta Detayı"
                          >
                            <FileText size={14} />
                            <span>Detay</span>
                          </button>
                          <button
                            type="button"
                            className="btn-danger"
                            style={{ padding: '6px 10px', fontSize: 12 }}
                            onClick={() => handleDeletePatient(p.id, `${p.first_name} ${p.last_name}`)}
                            title="Hastayı Sil"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hasta Detay & Güncelleme Modalı */}
      {selectedPatient && (
        <div className="modal-overlay" onClick={() => setSelectedPatient(null)}>
          <div className="modal-card" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
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
                  <Users size={22} />
                </div>
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    {selectedPatient.first_name} {selectedPatient.last_name}
                  </h3>
                  <span style={{ fontSize: 12.5, color: '#64748b' }}>TC: {selectedPatient.tc_no}</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  className={isEditingPatient ? 'btn-secondary' : 'btn-new-analysis'}
                  style={{ padding: '6px 12px', fontSize: 12.5, borderRadius: 8 }}
                  onClick={() => {
                    setIsEditingPatient(!isEditingPatient);
                    setEditModalError(null);
                    setEditFormData({ ...selectedPatient });
                  }}
                >
                  {isEditingPatient ? <RotateCcw size={14} /> : <Edit3 size={14} />}
                  <span>{isEditingPatient ? 'Vazgeç' : 'Düzenle'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPatient(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Güncelleme Hata Uyarısı */}
            {editModalError && (
              <div className="alert-message error" style={{ marginBottom: 16 }}>
                <AlertCircle size={18} />
                <span>{editModalError}</span>
              </div>
            )}

            {/* GÖRÜNTÜLEME MODU (Uzun metinler otomatik alt satıra geçer) */}
            {!isEditingPatient ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13.5, color: '#334155', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <User size={16} color="#00766c" style={{ flexShrink: 0 }} />
                  <span style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    <strong>Yaş & Cinsiyet:</strong> {getAge(selectedPatient.date_of_birth)} yaş, {selectedPatient.gender}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <Phone size={16} color="#00766c" style={{ flexShrink: 0 }} />
                  <span style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    <strong>Telefon:</strong> {selectedPatient.phone}
                  </span>
                </div>
                {selectedPatient.email && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
                    <Mail size={16} color="#00766c" style={{ flexShrink: 0, marginTop: 3 }} />
                    <span style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                      <strong>E-posta:</strong> {selectedPatient.email}
                    </span>
                  </div>
                )}
                {selectedPatient.address && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
                    <MapPin size={16} color="#00766c" style={{ flexShrink: 0, marginTop: 3 }} />
                    <span style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: 1.5 }}>
                      <strong>Adres:</strong> {selectedPatient.address}
                    </span>
                  </div>
                )}
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 12, marginTop: 6, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>Klinik Bilgiler</div>
                  <div style={{ marginBottom: 6, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    <strong>Kan Grubu:</strong> {selectedPatient.blood_type}
                  </div>
                  <div style={{ marginBottom: 6, wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: 1.5 }}>
                    <strong>Alerjiler:</strong> {selectedPatient.allergies || 'Yok'}
                  </div>
                  <div style={{ marginBottom: 6, wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: 1.5 }}>
                    <strong>Kronik Hastalıklar:</strong> {selectedPatient.chronic_diseases || 'Yok'}
                  </div>
                  <div>
                    <strong>Ailede Kanser Öyküsü:</strong>{' '}
                    <span style={{ color: selectedPatient.family_history_of_cancer ? '#b91c1c' : '#15803d', fontWeight: 600 }}>
                      {selectedPatient.family_history_of_cancer ? 'Var' : 'Yok'}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setSelectedPatient(null)}
                  >
                    Kapat
                  </button>
                </div>
              </div>
            ) : (
              /* DÜZENLEME / GÜNCELLEME MODU */
              <form onSubmit={handleUpdatePatient}>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Ad</label>
                    <input
                      type="text"
                      maxLength={80}
                      value={editFormData.first_name || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Soyad</label>
                    <input
                      type="text"
                      maxLength={80}
                      value={editFormData.last_name || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Cinsiyet</label>
                    <select
                      value={editFormData.gender || 'Kadın'}
                      onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value as any })}
                    >
                      <option value="Kadın">Kadın</option>
                      <option value="Erkek">Erkek</option>
                      <option value="Diğer">Diğer</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Doğum Tarihi</label>
                    <input
                      type="date"
                      value={editFormData.date_of_birth ? editFormData.date_of_birth.slice(0, 10) : ''}
                      onChange={(e) => setEditFormData({ ...editFormData, date_of_birth: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Telefon</label>
                    <input
                      type="tel"
                      maxLength={16}
                      value={editFormData.phone || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>E-posta</label>
                    <input
                      type="email"
                      maxLength={120}
                      value={editFormData.email || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Kan Grubu</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={editFormData.blood_type || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, blood_type: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Adres</label>
                    <input
                      type="text"
                      maxLength={300}
                      value={editFormData.address || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Alerjiler</label>
                    <input
                      type="text"
                      maxLength={300}
                      value={editFormData.allergies || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, allergies: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Kronik Hastalıklar</label>
                    <input
                      type="text"
                      maxLength={300}
                      value={editFormData.chronic_diseases || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, chronic_diseases: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <input
                      id="edit_family_cancer"
                      type="checkbox"
                      checked={editFormData.family_history_of_cancer ?? false}
                      onChange={(e) => setEditFormData({ ...editFormData, family_history_of_cancer: e.target.checked })}
                      style={{ width: 18, height: 18 }}
                    />
                    <label htmlFor="edit_family_cancer" style={{ margin: 0, cursor: 'pointer' }}>
                      Ailede meme kanseri veya ilişkili kanser öyküsü var
                    </label>
                  </div>
                </div>

                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setIsEditingPatient(false)}
                    disabled={savingEdit}
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    className="btn-new-analysis"
                    disabled={savingEdit}
                  >
                    <Save size={16} />
                    <span>{savingEdit ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Yeni Hasta Ekle Modalı (Detaylı Hata Gösterimi & Toast Bildirimi) */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                Yeni Hasta Kaydı
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal İçi Detaylı Hata Bildirimi */}
            {modalError && (
              <div className="alert-message error" style={{ marginBottom: 16 }}>
                <AlertCircle size={18} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreatePatient}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>TC Kimlik No (11 Hane)</label>
                  <input
                    type="text"
                    maxLength={11}
                    placeholder="12345678901"
                    value={newPatient.tc_no}
                    onChange={(e) => setNewPatient({ ...newPatient, tc_no: e.target.value.replace(/\D/g, '') })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Cinsiyet</label>
                  <select
                    value={newPatient.gender}
                    onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value as any })}
                  >
                    <option value="Kadın">Kadın</option>
                    <option value="Erkek">Erkek</option>
                    <option value="Diğer">Diğer</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Ad</label>
                  <input
                    type="text"
                    placeholder="Örn: Ayşe"
                    value={newPatient.first_name}
                    onChange={(e) => setNewPatient({ ...newPatient, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Soyad</label>
                  <input
                    type="text"
                    placeholder="Örn: Kaya"
                    value={newPatient.last_name}
                    onChange={(e) => setNewPatient({ ...newPatient, last_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Doğum Tarihi</label>
                  <input
                    type="date"
                    value={newPatient.date_of_birth}
                    onChange={(e) => setNewPatient({ ...newPatient, date_of_birth: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Telefon</label>
                  <input
                    type="tel"
                    placeholder="+905321234567"
                    value={newPatient.phone}
                    onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>E-posta</label>
                  <input
                    type="email"
                    placeholder="hasta@example.com"
                    value={newPatient.email}
                    onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Kan Grubu</label>
                  <input
                    type="text"
                    placeholder="Örn: A Rh+"
                    value={newPatient.blood_type}
                    onChange={(e) => setNewPatient({ ...newPatient, blood_type: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Adres</label>
                  <input
                    type="text"
                    placeholder="İlçe, İl"
                    value={newPatient.address}
                    onChange={(e) => setNewPatient({ ...newPatient, address: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Alerjiler</label>
                  <input
                    type="text"
                    placeholder="Alerji yoksa 'Yok' yazınız"
                    value={newPatient.allergies}
                    onChange={(e) => setNewPatient({ ...newPatient, allergies: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Kronik Hastalıklar</label>
                  <input
                    type="text"
                    placeholder="Hastalık yoksa 'Yok' yazınız"
                    value={newPatient.chronic_diseases}
                    onChange={(e) => setNewPatient({ ...newPatient, chronic_diseases: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  <input
                    id="family_cancer"
                    type="checkbox"
                    checked={newPatient.family_history_of_cancer}
                    onChange={(e) => setNewPatient({ ...newPatient, family_history_of_cancer: e.target.checked })}
                    style={{ width: 18, height: 18 }}
                  />
                  <label htmlFor="family_cancer" style={{ margin: 0, cursor: 'pointer' }}>
                    Ailede meme kanseri veya ilişkili kanser öyküsü var
                  </label>
                </div>
              </div>

              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="btn-new-analysis"
                >
                  Hastayı Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
