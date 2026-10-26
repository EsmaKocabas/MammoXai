import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import '../styles/auth.css';
import { apiFetch } from '../lib/api';
import { Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') ?? '';

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setMessage(null);
        setError(null);

        if (!token) {
            setError('Sıfırlama bağlantısı geçersiz. Lütfen yeni bir bağlantı isteyin.');
            return;
        }

        if (password.length < 8) {
            setError('Yeni şifreniz en az 8 karakter olmalıdır.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Girdiğiniz şifreler eşleşmiyor.');
            return;
        }

        setIsSubmitting(true);

        try {
            const result = await apiFetch<{ message: string }>('/api/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify({ token, password }),
            });

            setMessage(result.message || 'Şifreniz başarıyla yenilendi.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Şifre yenilenemedi. Lütfen tekrar deneyin.');
        } finally {
            setIsSubmitting(false);
        }
    };
    return (
        <main className="login-page">
            <section className="login-card" aria-labelledby="reset-title">
                <p className="login-eyebrow">Hesap güvenliği</p>

                <h1 id="reset-title" className="login-title">
                    {message ? 'Şifreniz yenilendi' : 'Yeni şifrenizi belirleyin'}
                </h1>

                {!message && (
                    <p className="login-subtitle">
                        Hesabınızı korumak için yeni şifrenizi iki kez girin.
                    </p>
                )}

                {!token && (
                    <div className="login-error" role="alert">
                        Sıfırlama bağlantısında token bulunamadı. E-posta üzerinden gelen
                        bağlantıyı kullanın.
                    </div>
                )}

                {message ? (
                    <div role="status" aria-live="polite">
                        <p className="login-subtitle">{message}</p>
                        <Link to="/login" className="link">
                            Giriş sayfasına dön
                        </Link>
                    </div>
                ) : (
                    <form className="login-form" onSubmit={handleSubmit} noValidate>
                        <div className="field">
                            <label htmlFor="reset-password">Yeni şifre</label>
                            <div className="input-with-icon">
                                <input
                                    id="reset-password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    placeholder="En az 8 karakter"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
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
                            <label htmlFor="reset-confirm-password">Yeni şifreyi tekrar girin</label>
                            <div className="input-with-icon">
                                <input
                                    id="reset-confirm-password"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    placeholder="Yeni şifrenizi tekrar girin"
                                    value={confirmPassword}
                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowConfirmPassword((previous) => !previous)}
                                    aria-label={showConfirmPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                                >
                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="login-error" role="alert">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={!token || !password || !confirmPassword || isSubmitting}
                        >
                            {isSubmitting ? 'Kaydediliyor...' : 'Şifremi yenile'}
                        </button>

                        <p style={{ textAlign: 'center', fontSize: 13 }}>
                            <Link to="/login" className="link">
                                Giriş sayfasına dön
                            </Link>
                        </p>
                    </form>
                )}

                {!message && (
                    <p className="login-disclaimer">
                        Güvenliğiniz için sıfırlama bağlantıları sınırlı süreyle geçerlidir.
                    </p>
                )}
            </section>
        </main>
    );
}