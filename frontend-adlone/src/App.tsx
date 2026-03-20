import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import './App.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ToastContainer } from './components/Toast/Toast';
import ErrorBoundary from './components/common/ErrorBoundary';

const AppContent = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando...</div>;
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
