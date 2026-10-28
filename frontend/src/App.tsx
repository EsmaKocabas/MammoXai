import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import PatientsPage from './pages/PatientsPage';
import AnalysesPage from './pages/AnalysesPage';
import DoctorProfilePage from './pages/DoctorProfilePage';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import { getToken } from './lib/api';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';

import { ToastProvider } from './components/ToastContext';

export default function App() {
  return (
    <ToastProvider>
      <Routes>
      <Route
        path="/login"
        element={getToken() ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={getToken() ? <Navigate to="/dashboard" replace /> : <RegisterPage />}
      />
      <Route
        path="/forgot-password"
        element={getToken() ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />}
      />
      <Route
        path="/reset-password"
        element={<ResetPasswordPage />}
      />

      {/* Korumalı Rotalar (Giriş Yapmış Doktor Alanı) */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dashboard/patients" element={<PatientsPage />} />
        <Route path="/dashboard/analyses" element={<AnalysesPage />} />
        <Route path="/dashboard/profile" element={<DoctorProfilePage />} />
      </Route>

      {/* Kolay yönlendirmeler */}
      <Route path="/patients" element={<Navigate to="/dashboard/patients" replace />} />
      <Route path="/analyses" element={<Navigate to="/dashboard/analyses" replace />} />
      <Route path="/profile" element={<Navigate to="/dashboard/profile" replace />} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  </ToastProvider>
  );
}
