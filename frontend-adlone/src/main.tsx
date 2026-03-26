import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@mantine/core/styles.css'
import './index.css'
import App from './App.tsx'
import { MantineProvider, createTheme } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'

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
  shadows: {
    xs: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.1)',
    sm: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
    md: '0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.03)',
    lg: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
    xl: '0 25px 50px -12px rgba(0,0,0,0.25)',
  },
  components: {
    Button: {
      defaultProps: {
        radius: 'md',
        fw: 600,
      },
    },
    Paper: {
      defaultProps: {
        withBorder: true,
        radius: 'md',
        shadow: 'sm',
      },
    },
    Card: {
      defaultProps: {
        withBorder: true,
        radius: 'md',
        shadow: 'sm',
      },
    },
    TextInput: {
      defaultProps: {
        radius: 'md',
      },
    },
    Select: {
      defaultProps: {
        radius: 'md',
      },
    },
    Title: {
      styles: {
        root: {
          fontWeight: 800,
          letterSpacing: '-0.02em',
        },
      },
    },
    Badge: {
        defaultProps: {
            radius: 'sm',
            fw: 700,
        }
    }
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} forceColorScheme="light">
      <ModalsProvider>
        <App />
      </ModalsProvider>
    </MantineProvider>
  </StrictMode>,
)
