import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register, saveSession, type RegisterData } from '../lib/api';
import '../styles/auth.css';
import { Eye, EyeOff } from 'lucide-react';

const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<RegisterData>({
    full_name: '',
    title: 'Uzm. Dr.',
    specialty: 'Radyoloji',
    hospital: '',
    phone: '',
    email: '',
    password: '',
  });
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (field: keyof RegisterData, value: string) => {
    if (field === 'phone') {
      // Yalnızca rakamlar ve en başta tek bir + işareti.
      value = value.replace(/[^\d+]/g, '');

      if (value.includes('+')) {
        value = '+' + value.replace(/\+/g, '');
      }

      // E.164 biçimi: + ve en fazla 15 rakam.
      value = value.slice(0, 16);
    }

    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const normalizedPhone = formData.phone.trim();

    if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      setError(
        'Geçerli bir telefon numarası girin. Ülke kodu zorunludur. Örnek: +905321234567'
      );
      return;
    }

    // Temel istemci doğrulamaları
    if (formData.password !== passwordConfirm) {
      setError('Girdiğiniz şifreler birbiriyle eşleşmiyor.');
      return;
    }

    if (formData.password.length < 8) {
      setError('Şifre en az 8 karakter olmalıdır.');
      return;
    }

    setLoading(true);
    try {
      const { token, doctor } = await register({
        ...formData,
        full_name: formData.full_name.trim(),
        hospital: formData.hospital.trim(),
        phone: normalizedPhone,
        email: formData.email.trim(),
      });
      // Başarılı kayıtta otomatik oturum aç ve dashboard'a yönlendir
      saveSession(token, doctor, true);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt işlemi sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="register-page">
      <section className="register-card" aria-labelledby="register-title">
        <p className="register-eyebrow">HEKİM KAYIT PROTOKOLÜ</p>
        <h1 id="register-title" className="register-title">Yeni doktor hesabı oluşturun</h1>
        <p className="register-subtitle">
          Mamografi analiz platformuna erişmek ve klinik karar desteği almak için hekim bilgilerinizi tanımlayın.
        </p>

        <form className="register-form" onSubmit={handleSubmit} noValidate>
          {/* Ad Soyad & Unvan */}
          <div className="form-grid">
            <div className="field">
              <label htmlFor="reg-name">Ad Soyad</label>
              <input
                id="reg-name"
                type="text"
                placeholder="Dr. Aylin Yılmaz"
                value={formData.full_name}
                onChange={(e) => handleChange('full_name', e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="reg-title">Unvan</label>
              <select
                id="reg-title"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                required
              >
                <option value="Uzm. Dr.">Uzm. Dr.</option>
                <option value="Prof. Dr.">Prof. Dr.</option>
                <option value="Doç. Dr.">Doç. Dr.</option>
                <option value="Dr. Öğr. Üyesi">Dr. Öğr. Üyesi</option>
                <option value="Op. Dr.">Op. Dr.</option>
                <option value="Dr.">Dr.</option>
                <option value="Radyoloji Uzmanı">Radyoloji Uzmanı</option>
              </select>
            </div>
          </div>

          {/* Uzmanlık Alanı & Hastane */}
          <div className="form-grid">
            <div className="field">
              <label htmlFor="reg-specialty">Uzmanlık Alanı</label>
              <input
                id="reg-specialty"
                type="text"
                placeholder="Radyoloji / Meme Cerrahisi"
                value={formData.specialty}
                onChange={(e) => handleChange('specialty', e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="reg-hospital">Kurum / Hastane</label>
              <input
                id="reg-hospital"
                type="text"
                placeholder="Ankara Şehir Hastanesi"
                value={formData.hospital}
                onChange={(e) => handleChange('hospital', e.target.value)}
                required
              />
            </div>
          </div>

          {/* E-posta & Telefon */}
          <div className="form-grid">
            <div className="field">
              <label htmlFor="reg-email">E-posta adresi</label>
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                placeholder="dr.aylin@mammoai.com"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="reg-phone">Telefon Numarası</label>
              <input
                id="reg-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+905321234567"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                pattern="\+[1-9][0-9]{7,14}"
                title="Ülke koduyla birlikte girin. Örnek: +905321234567"
                maxLength={16}
                required
              />
              <small style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                Ülke koduyla birlikte girin. Örnek: +905321234567
              </small>
            </div>
          </div>

          {/* Şifre & Şifre Tekrarı */}
          <div className="form-grid">
            <div className="field">
              <label htmlFor="reg-pass">Şifre</label>
              <div className="input-with-icon">
                <input
                  id="reg-pass"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="field">
              <label htmlFor="reg-pass-confirm">Şifre Tekrarı</label>
              <div className="input-with-icon">
                <input
                  id="reg-pass-confirm"
                  type={showPasswordConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPasswordConfirm((prev) => !prev)}
                  aria-label={
                    showPasswordConfirm
                      ? 'Şifre tekrarını gizle'
                      : 'Şifre tekrarını göster'
                  }
                  aria-pressed={showPasswordConfirm}
                >
                  {showPasswordConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          <p className="password-hint">
            * Şifreniz en az 8 karakter, 1 büyük harf, 1 küçük harf, 1 sayı ve 1 özel karakter içermelidir.
          </p>

          {error && (
            <div className="register-error" role="alert">
              {error}
            </div>
          )}

          <button
            id="register-submit"
            type="submit"
            className="btn-primary"
            disabled={loading || !formData.full_name || !formData.email || !formData.password}
          >
            {loading ? (
              <span className="spinner" aria-label="Hesap oluşturuluyor" />
            ) : (
              <>
                Kayıt Ol ve Başla <ChevronIcon />
              </>
            )}
          </button>

          <div className="register-login-switch">
            Zaten bir doktor hesabınız var mı?{' '}
            <Link to="/login" className="link">
              Giriş yapın
            </Link>
          </div>
        </form>

        <p className="register-disclaimer">
          Bu platform tanı koymaz; sağlık profesyonellerine klinik karar desteği sağlar.
        </p>
      </section>
    </main >
  );
}
