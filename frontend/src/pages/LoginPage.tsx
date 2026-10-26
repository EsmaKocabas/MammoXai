import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login, saveSession } from '../lib/api';
import '../styles/auth.css';

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, doctor } = await login(email.trim(), password);
      saveSession(token, doctor, remember);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş yapılamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <p className="login-eyebrow">Güvenli erişim</p>
        <h1 id="login-title" className="login-title">Hesabınıza giriş yapın</h1>
        <p className="login-subtitle">
          Mamografi analiz paneline erişmek için doktor hesabınızla devam edin.
        </p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="login-email">E-posta adresi</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="dr.aylin@mammoai.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="login-password">Şifre</label>
            <div className="input-with-icon">
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <span className="input-icon"><LockIcon /></span>
            </div>
          </div>

          <div className="login-options">
            <label className="checkbox" htmlFor="login-remember">
              <input
                id="login-remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Beni hatırla
            </label>
            <a id="login-forgot" className="link" href="#" onClick={(e) => e.preventDefault()}>
              Şifremi unuttum
            </a>
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button
            id="login-submit"
            type="submit"
            className="btn-primary"
            disabled={loading || !email || !password}
          >
            {loading ? (
              <span className="spinner" aria-label="Giriş yapılıyor" />
            ) : (
              <>
                Giriş yap <ChevronIcon />
              </>
            )}
          </button>

          <div style={{ marginTop: 6, fontSize: 13, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Henüz doktor hesabınız yok mu?{' '}
            <Link to="/register" className="link">
              Kayıt olun
            </Link>
          </div>
        </form>

        <p className="login-disclaimer">
          Bu platform tanı koymaz; sağlık profesyonellerine klinik karar desteği sağlar.
        </p>
      </section>
    </main>
  );
}
