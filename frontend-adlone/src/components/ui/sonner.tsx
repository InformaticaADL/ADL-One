import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useThemeStore } from '@/store/themeStore';

// Wrapper estándar de shadcn/ui para sonner — mapea los tokens de tema del
// proyecto (--sc-*) a las variables que sonner espera, en vez de una paleta
// propia, para que los toasts se vean consistentes con el resto de la app
// (bordes, radios, claro/oscuro) sin definir estilos aparte.
const Toaster = ({ ...props }: ToasterProps) => {
    const mode = useThemeStore((s) => s.mode);

    return (
        <Sonner
            theme={mode}
            className="toaster group"
            closeButton
            style={
                {
                    '--normal-bg': 'var(--sc-card)',
                    '--normal-text': 'var(--sc-card-foreground)',
                    '--normal-border': 'var(--sc-border)',
                } as React.CSSProperties
            }
            {...props}
        />
    );
};

export { Toaster };
