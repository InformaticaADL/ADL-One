import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import 'dayjs/locale/es'
import './index.css'
import App from './App.tsx'
import { useThemeStore } from './store/themeStore'

// eslint-disable-next-line react-refresh/only-export-components -- entry point, not fast-refreshed
function Root() {
  const mode = useThemeStore((s) => s.mode);

  // Refleja el modo en <html data-theme>, que lee index.css (--app-*, --sc-*).
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
