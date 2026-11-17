import { StrictMode, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import 'dayjs/locale/es'
import './index.css'
import App from './App.tsx'
import { useThemeStore } from './store/themeStore'
import { recargarPorVersionNueva } from './lib/recargaPorVersion'

// Vite avisa con este evento cuando no puede cargar un archivo de la versión anterior (ya no está en el servidor): se carga la página de nuevo.
window.addEventListener('vite:preloadError', (e) => { e.preventDefault(); recargarPorVersionNueva(); });

// eslint-disable-next-line react-refresh/only-export-components -- entry point, not fast-refreshed
function Root() {
  const mode = useThemeStore((s) => s.mode);

  // Refleja el modo en <html data-theme>, que lee index.css (--app-*, --sc-*).
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
