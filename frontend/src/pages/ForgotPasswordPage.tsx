import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../lib/api';
import '../styles/auth.css';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setMessage(null);
        setError(null);
        setLoading(true);

        try {
            const result = await requestPasswordReset(email.trim());
            setMessage(result.message);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'İstek gönderilemedi. Lütfen tekrar deneyin.',
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="login-page">
            <section className="login-card" aria-labelledby="forgot-title">
                <p className="login-eyebrow">Hesap güvenliği</p>

                <h1 id="forgot-title" className="login-title">
                    Şifrenizi mi unuttunuz?
                </h1>

                {!message && (
                    <p className="login-subtitle">
                        Hesabınıza bağlı e-posta adresini girin. Şifrenizi yenilemeniz için
                        size bir bağlantı gönderelim.
                    </p>
                )}

                {message ? (
                    <div role="status" aria-live="polite">
                        <p className="login-subtitle">{message}</p>
                        <Link to="/login" className="btn-primary">
                            Giriş sayfasına dön
                        </Link>
                    </div>
                ) : (
                    <form
                        className="login-form"
                        onSubmit={handleSubmit}
                        noValidate
                    >
                        <div className="field">
                            <label htmlFor="forgot-email">E-posta adresi</label>
                            <input
                                id="forgot-email"
                                type="email"
                                autoComplete="email"
                                placeholder="dr.aylin@mammoai.com"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                required
                            />
                        </div>

                        {error && (
                            <div className="login-error" role="alert">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={loading || !email.trim()}
                        >
                            {loading ? (
                                <span
                                    className="spinner"
                                    aria-label="E-posta gönderiliyor"
                                />
                            ) : (
                                'Sıfırlama bağlantısı gönder'
                            )}
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
                        Şifre sıfırlama bağlantısı güvenliğiniz için sınırlı bir süre geçerlidir.
                    </p>
                )}
            </section>
        </main>
    );
}