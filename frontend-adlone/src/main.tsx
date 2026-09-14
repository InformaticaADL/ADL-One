import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import 'dayjs/locale/es'
import './index.css'
import App from './App.tsx'
import { MantineProvider, createTheme } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { ConfigProvider, theme as antdAlgorithms } from 'antd'
import esES from 'antd/locale/es_ES'
import { useThemeStore } from './store/themeStore'

// Tokens de Ant Design — alineados al look del módulo de Facturación
// (#1677ff, radio 12px, tarjetas/tags suaves), adoptado como estándar visual
// para toda la app. Ant Design queda como envoltorio EXTERNO: MantineProvider
// se mantiene montado porque el resto de la app todavía depende de sus
// variables CSS (--mantine-color-*) y componentes. Claro/oscuro lo decide
// useThemeStore — ver getAntdTheme() más abajo, que intercambia el algoritmo
// y los tonos que sí necesitan valor explícito por modo.
function getAntdTheme(mode: 'light' | 'dark') {
  const dark = mode === 'dark';
  return {
    algorithm: dark ? antdAlgorithms.darkAlgorithm : antdAlgorithms.defaultAlgorithm,
    token: {
      colorPrimary: '#1677ff',
      colorInfo: '#1677ff',
      borderRadius: 12,
      fontFamily: 'Inter, system-ui, sans-serif',
      // Borde y texto secundario más suaves (línea zinc-200 en vez de gris
      // corporativo) — sostiene el look minimalista en toda la app sin tocar
      // archivo por archivo.
      colorBorder: dark ? 'rgba(255,255,255,0.12)' : '#e4e4e7',
      colorBorderSecondary: dark ? 'rgba(255,255,255,0.08)' : '#f0f0f2',
      colorTextSecondary: dark ? '#a1a1aa' : '#71717a',
      colorTextTertiary: dark ? '#71717a' : '#a1a1aa',
    },
    components: {
      Menu: {
        itemSelectedBg: dark ? 'rgba(22,119,255,0.25)' : '#e6f4ff',
        itemSelectedColor: dark ? '#69b1ff' : '#1677ff',
        itemHoverBg: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
        itemHeight: 40,
        itemBorderRadius: 10,
        subMenuItemBg: 'transparent',
      },
      Button: {
        fontWeight: 600,
        controlHeight: 38,
        borderRadius: 10,
      },
      Card: {
        borderRadiusLG: 12,
      },
      Input: {
        controlHeight: 38,
        borderRadius: 10,
      },
      InputNumber: {
        controlHeight: 38,
        borderRadius: 10,
      },
      Select: {
        controlHeight: 38,
        borderRadius: 10,
      },
      DatePicker: {
        controlHeight: 38,
        borderRadius: 10,
      },
      // El "look Shadcn": sin el fondo gris clásico del header, más aire
      // entre filas, línea divisoria apenas visible.
      Table: {
        headerBg: dark ? '#1c1c1c' : '#ffffff',
        headerColor: dark ? '#a1a1aa' : '#71717a',
        headerSplitColor: 'transparent',
        borderColor: dark ? 'rgba(255,255,255,0.1)' : '#e4e4e7',
        rowHoverBg: dark ? 'rgba(255,255,255,0.04)' : '#f4f4f5',
        cellPaddingBlock: 14,
        cellPaddingInline: 16,
        cellFontSize: 13,
      },
      // Los Tag de estado ya salen como píldora suave (fondo claro + texto de
      // color, sin relleno sólido) en vez de las etiquetas planas de antes.
      Tag: {
        borderRadiusSM: 8,
        defaultBg: dark ? 'rgba(255,255,255,0.06)' : '#f4f4f5',
      },
    },
  };
}

const mantineTheme = createTheme({
  primaryColor: 'adl-blue',
  primaryShade: { light: 6, dark: 4 },
  colors: {
    'adl-blue': [
      '#e6f4ff', // 0
      '#bae0ff', // 1
      '#91caff', // 2
      '#69b1ff', // 3
      '#4096ff', // 4
      '#1677ff', // 5
      '#1677ff', // 6 ← brand
      '#0958d9', // 7
      '#003eb3', // 8
      '#002c8c', // 9
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
        // MA-05: filter defensivo global. Mantine por defecto hace option.label.toLowerCase()
        // sin null-check y crashea cuando algún registro de BD trae el campo display en null.
        // Este wrapper tolera label/value null/undefined.
        filter: ({ options, search }: any) => {
          const term = String(search ?? '').toLowerCase().trim();
          if (!term) return options;
          return options.filter((option: any) => {
            const label = String(option?.label ?? '').toLowerCase();
            const value = String(option?.value ?? '').toLowerCase();
            return label.includes(term) || value.includes(term);
          });
        },
      },
    },
    MultiSelect: {
      defaultProps: {
        radius: 'md',
        filter: ({ options, search }: any) => {
          const term = String(search ?? '').toLowerCase().trim();
          if (!term) return options;
          return options.filter((option: any) => {
            const label = String(option?.label ?? '').toLowerCase();
            const value = String(option?.value ?? '').toLowerCase();
            return label.includes(term) || value.includes(term);
          });
        },
      },
    },
    Autocomplete: {
      defaultProps: {
        radius: 'md',
        filter: ({ options, search }: any) => {
          const term = String(search ?? '').toLowerCase().trim();
          if (!term) return options;
          return options.filter((option: any) => {
            const label = String(option?.label ?? '').toLowerCase();
            const value = String(option?.value ?? '').toLowerCase();
            return label.includes(term) || value.includes(term);
          });
        },
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

// eslint-disable-next-line react-refresh/only-export-components -- entry point, not fast-refreshed
function Root() {
  const mode = useThemeStore((s) => s.mode);

  // Refleja el modo en <html data-theme>, que leen index.css (--app-*) y
  // cualquier CSS module fuera de Ant Design / Mantine (p.ej. Sidebar).
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  return (
    <ConfigProvider theme={getAntdTheme(mode)} locale={esES}>
      <MantineProvider theme={mantineTheme} forceColorScheme={mode}>
        <ModalsProvider>
          <App />
        </ModalsProvider>
      </MantineProvider>
    </ConfigProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
