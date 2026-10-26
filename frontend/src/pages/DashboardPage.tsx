import { useNavigate } from 'react-router-dom';
import { clearSession, getDoctor } from '../lib/api';

// Geçici sayfa: giriş akışının çalıştığını doğrulamak için. Dashboard tasarımı gelince değiştirilecek.
export default function DashboardPage() {
  const navigate = useNavigate();
  const doctor = getDoctor();

  const handleLogout = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>
          Hoş geldiniz{doctor ? `, ${[doctor.title, doctor.full_name].filter(Boolean).join(' ')}` : ''}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', margin: '0 0 20px' }}>Dashboard yakında burada olacak.</p>
        <button id="logout-button" className="btn-primary" style={{ width: 160 }} onClick={handleLogout}>
          Çıkış yap
        </button>
      </div>
    </main>
  );
}
