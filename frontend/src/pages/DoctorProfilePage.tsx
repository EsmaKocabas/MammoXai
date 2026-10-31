import { useState, type FormEvent, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  User,
  Shield,
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Save,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  getMe,
  updateDoctorProfile,
  deleteDoctorAccount,
  clearSession,
  updateStoredDoctor,
  updateStoredToken,
  type Doctor,
  type UpdateProfileData,
} from '../lib/api';
import { useToast } from '../components/ToastContext';
import '../styles/dashboard.css';

// Yalnızca harfler ve boşluk kontrolü (Türkçe karakterler dahil)
const LETTERS_ONLY_REGEX = /^[a-zA-ZçÇğĞıİöÖşŞüÜ\s]+$/;

// Şifre doğrulama kuralları (backend ile tam uyumlu)
const validatePasswordStrict = (password: string): { valid: boolean; message?: string } => {
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

export default function DoctorProfilePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { setDoctor } = useOutletContext<{
    doctor: Doctor | null;
    setDoctor: (d: Doctor | null) => void;
  }>();

  const [formData, setFormData] = useState({
    full_name: '',
    tc_no: '',
    title: 'Uzm. Dr.',
    specialty: 'Radyoloji',
    hospital: '',
    phone: '',
    email: '',
  });

  const [passwords, setPasswords] = useState({
    current_password: '',
    new_password: '',
    new_password_confirm: '',
  });

  // Şifre görünürlük durumları
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getMe().then((res) => {
      if (res?.doctor) {
        setDoctor(res.doctor);
        setFormData({
          full_name: (res.doctor.full_name || '').replace(/[^a-zA-ZçÇğĞıİöÖşŞüÜ\s]/g, ''),
          tc_no: res.doctor.tc_no || '',
          title: res.doctor.title || 'Uzm. Dr.',
          specialty: (res.doctor.specialty || 'Radyoloji').replace(/[^a-zA-ZçÇğĞıİöÖşŞüÜ\s]/g, ''),
          hospital: (res.doctor.hospital || '').replace(/[^a-zA-ZçÇğĞıİöÖşŞüÜ\s]/g, ''),
          phone: res.doctor.phone || '',
          email: res.doctor.email || '',
        });
      }
    }).catch(() => undefined);
  }, [setDoctor]);

  // Telefon girişi: Yalnızca rakamlar ve en başta tek bir '+' kabul edilir, harf/noktalama engellenir
  const handlePhoneChange = (val: string) => {
    let cleaned = val.replace(/[^\d+]/g, '');
    if (cleaned.includes('+')) {
      cleaned = '+' + cleaned.replace(/\+/g, '');
    }
    cleaned = cleaned.slice(0, 16);
    setFormData((prev) => ({ ...prev, phone: cleaned }));
  };

  // Metin alanları: Ad Soyad, Uzmanlık Alanı, Hastane
  // Sayı, noktalama ve özel karakterler anında filtrelenir; yalnızca harfler ve boşluk kabul edilir
  const handleTextOnlyChange = (
    field: 'full_name' | 'specialty' | 'hospital',
    val: string
  ) => {
    const cleaned = val.replace(/[^a-zA-ZçÇğĞıİöÖşŞüÜ\s]/g, '');
    setFormData((prev) => ({ ...prev, [field]: cleaned }));
  };


  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    // 1. Unvan doğrulaması
    const titleTrimmed = formData.title.trim();
    if (!titleTrimmed) {
      const err = 'Lütfen bir unvan seçiniz.';
      setErrorMsg(err);
      showToast('Eksik Bilgi', err, 'error');
      return;
    }

    // 2. Ad Soyad doğrulaması (sayı ve noktalama olmamalı)
    const nameTrimmed = formData.full_name.trim();
    if (!nameTrimmed || !LETTERS_ONLY_REGEX.test(nameTrimmed)) {
      const err = 'Ad Soyad alanında sayı, noktalama işareti veya özel karakter kullanılamaz; yalnızca harflerden oluşmalıdır.';
      setErrorMsg(err);
      showToast('Geçersiz İsim', err, 'error');
      return;
    }

    // 3. Uzmanlık alanı doğrulaması (sayı ve noktalama olmamalı)
    const specialtyTrimmed = formData.specialty.trim();
    if (!specialtyTrimmed || !LETTERS_ONLY_REGEX.test(specialtyTrimmed)) {
      const err = 'Uzmanlık alanı alanında sayı, noktalama işareti veya özel karakter kullanılamaz; yalnızca harf içermelidir.';
      setErrorMsg(err);
      showToast('Geçersiz Uzmanlık', err, 'error');
      return;
    }

    // 4. Hastane doğrulaması (sayı ve noktalama olmamalı)
    const hospitalTrimmed = formData.hospital.trim();
    if (!hospitalTrimmed || !LETTERS_ONLY_REGEX.test(hospitalTrimmed)) {
      const err = 'Hastane / Kurum alanında sayı, noktalama işareti veya özel karakter kullanılamaz; yalnızca harf içermelidir.';
      setErrorMsg(err);
      showToast('Geçersiz Hastane', err, 'error');
      return;
    }

    // 5. Telefon doğrulaması (harf içermemeli, + ile başlayıp 8-15 rakam)
    const phoneTrimmed = formData.phone.trim();
    if (!phoneTrimmed || !/^\+[1-9]\d{7,14}$/.test(phoneTrimmed)) {
      const err = 'Geçersiz telefon numarası. Harf içeremez; ülke koduyla birlikte yalnızca rakamlardan oluşmalıdır (Örnek: +905321234567).';
      setErrorMsg(err);
      showToast('Geçersiz Telefon', err, 'error');
      return;
    }

    // 6. E-posta doğrulaması
    const emailTrimmed = formData.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailTrimmed || !emailRegex.test(emailTrimmed)) {
      const err = 'Lütfen geçerli bir e-posta adresi giriniz.';
      setErrorMsg(err);
      showToast('Geçersiz E-posta', err, 'error');
      return;
    }

    // 7. Şifre değiştirme talebi kontrolü
    if (passwords.new_password || passwords.current_password) {
      if (!passwords.current_password) {
        const err = 'Şifrenizi değiştirmek için mevcut şifrenizi girmelisiniz.';
        setErrorMsg(err);
        showToast('Şifre Hatası', err, 'error');
        return;
      }

      if (!passwords.new_password) {
        const err = 'Lütfen yeni şifrenizi belirleyin.';
        setErrorMsg(err);
        showToast('Şifre Hatası', err, 'error');
        return;
      }

      if (passwords.new_password !== passwords.new_password_confirm) {
        const err = 'Yeni şifreler birbiriyle eşleşmiyor.';
        setErrorMsg(err);
        showToast('Şifre Hatası', err, 'error');
        return;
      }

      const passCheck = validatePasswordStrict(passwords.new_password);
      if (!passCheck.valid) {
        const err = passCheck.message || 'Şifre kriterlere uygun değil.';
        setErrorMsg(err);
        showToast('Şifre Güvenlik Kriteri', err, 'error');
        return;
      }
    }

    setLoading(true);
    try {
      const payload: UpdateProfileData = {
        email: emailTrimmed,
        full_name: nameTrimmed,
        title: titleTrimmed,
        specialty: specialtyTrimmed,
        hospital: hospitalTrimmed,
        phone: phoneTrimmed,
      };

      if (passwords.new_password) {
        payload.current_password = passwords.current_password;
        payload.new_password = passwords.new_password;
      }

      const res = await updateDoctorProfile(payload);
      setDoctor(res.doctor);
      updateStoredDoctor(res.doctor);
      if (res.token) {
        updateStoredToken(res.token);
      }
      const okMsg = 'Profil bilgileriniz başarıyla güncellendi.';
      setSuccessMsg(okMsg);
      showToast('Profil Güncellendi', okMsg, 'success');
      setPasswords({
        current_password: '',
        new_password: '',
        new_password_confirm: '',
      });
    } catch (err: any) {
      const errMsg = err.message || 'Profil güncellenirken bir hata oluştu.';
      setErrorMsg(errMsg);
      showToast('Güncelleme Başarısız', errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'SİL') {
      const err = 'Hesabınızı silmek için onay kutusuna SİL yazmalısınız.';
      setErrorMsg(err);
      showToast('Onay Gerekli', err, 'error');
      return;
    }

    setDeleting(true);
    try {
      await deleteDoctorAccount();
      clearSession();
      alert('Hesabınız başarıyla silindi ve oturumunuz kapatıldı.');
      navigate('/login', { replace: true });
    } catch (err: any) {
      const errMsg = err.message || 'Hesap silinirken bir hata meydana geldi.';
      setErrorMsg(errMsg);
      showToast('Silme Başarısız', errMsg, 'error');
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  const initials = formData.full_name
    ? formData.full_name
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
    : 'DR';

  return (
    <div className="dashboard-content">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Doktor Profili & Ayarlar</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#64748b' }}>
            Kişisel ve klinik bilgilerinizi güncelleyin, hesap tercihlerinizi yönetin.
          </p>
        </div>
      </div>

      <div className="profile-grid">
        {/* Bilgilendirme ve Uyarılar */}
        {successMsg && (
          <div className="alert-message success">
            <CheckCircle2 size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="alert-message error">
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Profil Kartı */}
        <div className="profile-card">
          <div className="profile-header-banner">
            <div className="profile-large-avatar">{initials}</div>
            <div className="profile-banner-info">
              <h2>{formData.title} {formData.full_name}</h2>
              <p>{formData.specialty} • {formData.hospital || 'Kurum Belirtilmemiş'}</p>
            </div>
          </div>

          <form onSubmit={handleUpdate}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <User size={18} color="#00766c" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                Klinik & Kişisel Bilgiler
              </h3>
            </div>

            <div className="form-grid-2">
              {/* Unvan (Listeden seçim) */}
              <div className="form-group">
                <label htmlFor="prof-title">Unvan</label>
                <select
                  id="prof-title"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  required
                >
                  {!['Uzm. Dr.', 'Prof. Dr.', 'Doç. Dr.', 'Dr. Öğr. Üyesi', 'Op. Dr.', 'Dr.', 'Radyoloji Uzmanı'].includes(formData.title) && formData.title && (
                    <option value={formData.title}>{formData.title}</option>
                  )}
                  <option value="Uzm. Dr.">Uzm. Dr.</option>
                  <option value="Prof. Dr.">Prof. Dr.</option>
                  <option value="Doç. Dr.">Doç. Dr.</option>
                  <option value="Dr. Öğr. Üyesi">Dr. Öğr. Üyesi</option>
                  <option value="Op. Dr.">Op. Dr.</option>
                  <option value="Dr.">Dr.</option>
                  <option value="Radyoloji Uzmanı">Radyoloji Uzmanı</option>
                </select>
              </div>

              {/* Ad Soyad */}
              <div className="form-group">
                <label htmlFor="prof-name">Ad Soyad</label>
                <input
                  id="prof-name"
                  type="text"
                  placeholder="Örn: Aylin Yalçın"
                  value={formData.full_name}
                  onChange={(e) => handleTextOnlyChange('full_name', e.target.value)}
                  required
                />
              </div>

              {/* Uzmanlık Alanı */}
              <div className="form-group">
                <label htmlFor="prof-specialty">Uzmanlık Alanı</label>
                <input
                  id="prof-specialty"
                  type="text"
                  placeholder="Örn: Radyoloji veya Meme Cerrahisi"
                  value={formData.specialty}
                  onChange={(e) => handleTextOnlyChange('specialty', e.target.value)}
                  required
                />
              </div>

              {/* Hastane / Kurum */}
              <div className="form-group">
                <label htmlFor="prof-hospital">Hastane / Kurum</label>
                <input
                  id="prof-hospital"
                  type="text"
                  placeholder="Örn: Şehir Hastanesi"
                  value={formData.hospital}
                  onChange={(e) => handleTextOnlyChange('hospital', e.target.value)}
                  required
                />
              </div>

              {/* Telefon Numarası */}
              <div className="form-group">
                <label htmlFor="prof-phone">Telefon Numarası</label>
                <input
                  id="prof-phone"
                  type="tel"
                  placeholder="+905321234567"
                  value={formData.phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  required
                />
              </div>

              {/* TC Kimlik No (Değiştirilemez) */}
              <div className="form-group">
                <label htmlFor="prof-tc">TC Kimlik No (Değiştirilemez)</label>
                <input
                  id="prof-tc"
                  type="text"
                  value={formData.tc_no || 'Belirtilmemiş'}
                  disabled
                  style={{ background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }}
                />
              </div>

              {/* E-posta */}
              <div className="form-group">
                <label htmlFor="prof-email">E-posta Adresi</label>
                <input
                  id="prof-email"
                  type="email"
                  placeholder="doktor@mammoai.com"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
            </div>

            {/* Şifre Değiştirme Bölümü */}
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Shield size={18} color="#00766c" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  Şifre Değiştir
                </h3>
              </div>

              <div className="form-grid-2">
                {/* Mevcut Şifre */}
                <div className="form-group">
                  <label htmlFor="prof-current-pass">Mevcut Şifre</label>
                  <div className="input-with-icon">
                    <input
                      id="prof-current-pass"
                      type={showCurrentPassword ? 'text' : 'password'}
                      placeholder="Mevcut şifreniz"
                      value={passwords.current_password}
                      onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowCurrentPassword((prev) => !prev)}
                      aria-label={showCurrentPassword ? 'Mevcut şifreyi gizle' : 'Mevcut şifreyi göster'}
                    >
                      {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Yeni Şifre */}
                <div className="form-group">
                  <label htmlFor="prof-new-pass">Yeni Şifre</label>
                  <div className="input-with-icon">
                    <input
                      id="prof-new-pass"
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Yeni şifreniz"
                      value={passwords.new_password}
                      onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      aria-label={showNewPassword ? 'Yeni şifreyi gizle' : 'Yeni şifreyi göster'}
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Yeni Şifre Tekrar */}
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label htmlFor="prof-new-pass-confirm">Yeni Şifre Tekrar</label>
                  <div className="input-with-icon">
                    <input
                      id="prof-new-pass-confirm"
                      type={showNewPasswordConfirm ? 'text' : 'password'}
                      placeholder="Yeni şifrenizi tekrar girin"
                      value={passwords.new_password_confirm}
                      onChange={(e) => setPasswords({ ...passwords, new_password_confirm: e.target.value })}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowNewPasswordConfirm((prev) => !prev)}
                      aria-label={showNewPasswordConfirm ? 'Yeni şifre tekrarını gizle' : 'Yeni şifre tekrarını göster'}
                    >
                      {showNewPasswordConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 8, lineHeight: 1.4 }}>
                * Şifreniz en az 8 karakter, 1 büyük harf (A-Z), 1 küçük harf (a-z), 1 sayı (0-9) ve 1 özel karakter içermelidir.
              </p>
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="btn-new-analysis"
                disabled={loading}
              >
                <Save size={16} />
                <span>{loading ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Tehlikeli Bölge: Hesabı Sil */}
        <div className="danger-zone-card">
          <div className="danger-zone-header">
            <AlertTriangle size={20} />
            <h3>Tehlikeli Bölge: Doktor Hesabını Sil</h3>
          </div>
          <p className="danger-zone-desc">
            Hesabınızı sildiğinizde sistem erişiminiz derhal kapatılır, aktif oturumlarınız sonlandırılır.
            Klinik ve yasal kayıt saklama yükümlülükleri gereğince geçmiş analiz raporları arşiv statüsüne alınır.
          </p>
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              setDeleteConfirmText('');
              setShowDeleteModal(true);
            }}
          >
            <Trash2 size={16} />
            <span>Hesabımı Kalıcı Olarak Sil</span>
          </button>
        </div>
      </div>

      {/* Hesap Silme Onay Modalı */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Trash2 size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  Doktor Hesabını Sil
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
                  Bu işlem geri alınamaz!
                </p>
              </div>
            </div>

            <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6, marginBottom: 16 }}>
              <strong>{formData.title} {formData.full_name}</strong> adlı hesabınızı silmek üzeresiniz.
              Onaylamak için aşağıdaki kutuya büyük harflerle <strong>SİL</strong> yazınız.
            </p>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <input
                type="text"
                placeholder="SİL"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                style={{ borderColor: deleteConfirmText === 'SİL' ? '#dc2626' : '#cbd5e1' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={deleteConfirmText !== 'SİL' || deleting}
                onClick={handleDeleteAccount}
              >
                {deleting ? 'Siliniyor...' : 'Evet, Hesabımı Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
