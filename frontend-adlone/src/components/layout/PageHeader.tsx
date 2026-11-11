import React, { useEffect } from 'react';
import { IconArrowLeft } from '@tabler/icons-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useNavStore } from '../../store/navStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    onBack?: () => void;
    breadcrumbItems?: { label: string; href?: string; onClick?: () => void }[];
    rightSection?: React.ReactNode;
    /** En celular centra título, subtítulo y acciones (y achica el margen
        inferior) en vez de alinearlos a la izquierda. Para páginas como "Hoy
        en Vivo", donde debajo del header va una fila de KPIs centrados y el
        texto pegado al borde izquierdo se veía descolgado. */
    centerOnMobile?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    subtitle,
    onBack,
    breadcrumbItems,
    rightSection,
    centerOnMobile = false
}) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const shouldStack = useMediaQuery('(max-width: 900px)');
    const { setPageBreadcrumb } = useNavStore();

    // La ruta global (Inicio / Módulo / Submódulo) vive en la barra de ruta
    // persistente sobre el contenido (RouteBreadcrumb, ver TopBar.tsx), pero
    // esa barra solo conoce activeModule/activeSubmodule — no la navegación
    // interna de una página (ej. Fichas de Ingreso -> Carga masiva, que es
    // estado local/del store fichasMode, no un submódulo nuevo). Publicamos
    // el breadcrumbItems de la página activa al store para que
    // RouteBreadcrumb lo pueda mostrar en vez de quedarse pegado en el
    // nombre del submódulo. Se limpia al desmontar para no dejar un tramo
    // viejo pegado si la siguiente vista no define breadcrumbItems.
    useEffect(() => {
        setPageBreadcrumb(breadcrumbItems ?? []);
        return () => setPageBreadcrumb([]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(breadcrumbItems?.map(i => i.label))]);

    // Botón "Volver" chico cuando la página necesita retroceder a una vista
    // interna anterior (ej. de "Detalle" a "Lista"): toma onBack si se pasó
    // directo, o si no, el onClick del penúltimo breadcrumbItem (el patrón
    // que ya usaban las páginas con navegación interna por sub-vistas).
    const backAction = onBack ?? (breadcrumbItems && breadcrumbItems.length > 1
        ? breadcrumbItems[breadcrumbItems.length - 2]?.onClick
        : undefined);

    const centered = centerOnMobile && isMobile;

    return (
        <div className={cn('mt-1', centered ? 'mb-3' : 'mb-5')}>
            {backAction && (
                <Button variant="link" size="sm" onClick={backAction} className="mb-1 h-auto p-0 font-medium">
                    <IconArrowLeft size={14} />
                    Volver
                </Button>
            )}

            <div className={cn(
                'flex w-full flex-wrap justify-between',
                centered ? 'gap-3' : 'gap-2',
                shouldStack ? 'flex-col items-stretch' : 'flex-row items-end'
            )}>
                <div className={cn('min-w-0', centered && 'text-center')}>
                    <h2 className={cn('m-0 font-bold tracking-tight text-foreground', isMobile ? 'text-xl' : 'text-2xl')}>
                        {title}
                    </h2>
                    {subtitle && (
                        <p className={cn('text-muted-foreground', isMobile && 'text-xs')}>
                            {subtitle}
                        </p>
                    )}
                </div>

                <div className={cn(
                    'flex shrink-0 flex-wrap items-center gap-2',
                    centered ? 'justify-center' : shouldStack ? 'justify-start' : 'justify-end'
                )}>
                    {rightSection}
                </div>
            </div>
        </div>
    );
};
