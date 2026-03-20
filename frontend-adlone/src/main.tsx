import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@mantine/core/styles.css'
import './index.css'
import App from './App.tsx'
import { MantineProvider, createTheme } from '@mantine/core'

const theme = createTheme({
  primaryColor: 'adl-blue',
  primaryShade: { light: 6, dark: 4 },
  colors: {
    'adl-blue': [
      '#e6f0fa', // 0
      '#c0d8f4', // 1
      '#99bfed', // 2
      '#72a6e6', // 3
      '#4c8ddf', // 4
      '#2574d8', // 5
      '#0062a8', // 6 ← brand
      '#00508a', // 7
      '#003e6c', // 8
      '#002c4e', // 9
    ],
  },
  fontFamily: 'Inter, system-ui, sans-serif',
  defaultRadius: 'md',
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} forceColorScheme="light">
      <App />
    </MantineProvider>
  </StrictMode>,
)
