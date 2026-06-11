import { useState, useEffect } from 'react';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import './App.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ToastContainer } from './components/Toast/Toast';
import ErrorBoundary from './components/common/ErrorBoundary';
import logoAdl from './assets/images/logo-adlone.png';
import { useNavStore } from './store/navStore';

const AppContent = () => {
  const { isAuthenticated, loading } = useAuth();
  const { setActiveModule, setActiveSubmodule, setPendingRequestId, setFichasMode } = useNavStore();
  // S-14/15/16/17: detectar URL de reset password
  const [resetMode, setResetMode] = useState<boolean>(() => {
    return window.location.pathname.startsWith('/reset-password')
        || window.location.hash.startsWith('#/reset-password');
  });

  // Deep-link desde correos: /?ficha=:id -> abre el detalle de la ficha,
  // /?vista=calendario -> abre el Calendario de Servicios.
  // Se usa un query param (no una ruta) porque la SPA no se sirve con
  // rutas propias: el servidor solo conoce "/".
  useEffect(() => {
    if (!isAuthenticated) return;

    const params = new URLSearchParams(window.location.search);
    const fichaId = params.get('ficha');
    const vista = params.get('vista');

    if (fichaId) {
      const id = parseInt(fichaId, 10);
      setPendingRequestId(id);
      setActiveModule('medio_ambiente');
      setActiveSubmodule('ma-fichas-ingreso');
      window.history.replaceState({}, '', '/');
    } else if (vista === 'calendario') {
      setActiveModule('medio_ambiente');
      setActiveSubmodule('ma-fichas-ingreso');
      setFichasMode('calendar');
      window.history.replaceState({}, '', '/');
    } else if (vista === 'ejecutados') {
      setActiveModule('medio_ambiente');
      setActiveSubmodule('ma-fichas-ingreso');
      setFichasMode('list_ejecutados');
      window.history.replaceState({}, '', '/');
    }
  }, [isAuthenticated, setActiveModule, setActiveSubmodule, setPendingRequestId, setFichasMode]);

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        background: '#f4f4f5',
      }}>
        <img src={logoAdl} alt="ADL ONE" style={{ height: 56, objectFit: 'contain' }} />
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid #e0e0e0',
          borderTopColor: '#228be6',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (resetMode && !isAuthenticated) {
    return <ResetPasswordPage onDone={() => setResetMode(false)} />;
  }

  return isAuthenticated ? <DashboardPage /> : <LoginPage />;
};

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <AppContent />
          <ToastContainer />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
