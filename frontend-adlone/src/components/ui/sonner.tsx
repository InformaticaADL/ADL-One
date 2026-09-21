import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { IconAlertCircle, IconAlertTriangle, IconCircleCheck, IconInfoCircle } from '@tabler/icons-react';
import { useThemeStore } from '@/store/themeStore';

// Wrapper estándar de shadcn/ui para sonner — mapea los tokens de tema del
// proyecto (--sc-*) a las variables que sonner espera, en vez de una paleta
// propia, para que los toasts se vean consistentes con el resto de la app
// (bordes, radios, claro/oscuro) sin definir estilos aparte.
//
// Sin `richColors`, sonner pinta el ícono con el mismo `color` (texto neutro)
// que el resto del toast — por eso se veía negro/gris pese al fondo blanco
// minimalista. `icons` reemplaza el set propio de sonner por íconos con su
// color semántico ya fijado, sin heredar el `color` neutro del contenedor.
const Toaster = ({ ...props }: ToasterProps) => {
    const mode = useThemeStore((s) => s.mode);

    return (
        <Sonner
            theme={mode}
            className="toaster group"
            closeButton
            icons={{
                success: <IconCircleCheck size={20} className="text-success" />,
                info: <IconInfoCircle size={20} className="text-primary" />,
                warning: <IconAlertTriangle size={20} className="text-warning" />,
                error: <IconAlertCircle size={20} className="text-destructive" />,
            }}
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
