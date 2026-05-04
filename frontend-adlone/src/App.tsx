import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import './App.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ToastContainer } from './components/Toast/Toast';
import ErrorBoundary from './components/common/ErrorBoundary';
import logoAdl from './assets/images/logo-adlone.png';

const AppContent = () => {
  const { isAuthenticated, loading } = useAuth();

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
