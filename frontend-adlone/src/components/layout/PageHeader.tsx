import React, { useEffect } from 'react';
import { IconInfoCircle, IconArrowLeft } from '@tabler/icons-react';
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
}

export const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    subtitle,
    onBack,
    breadcrumbItems,
    rightSection
}) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const shouldStack = useMediaQuery('(max-width: 900px)');
    const { setHelpCenterOpen, setPageBreadcrumb } = useNavStore();

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

    return (
        <div className="mb-5 mt-1">
            {backAction && (
                <Button variant="link" size="sm" onClick={backAction} className="mb-1 h-auto p-0 font-medium">
                    <IconArrowLeft size={14} />
                    Volver
                </Button>
            )}

            <div className={cn('flex w-full gap-4', shouldStack ? 'flex-col items-stretch' : 'flex-row items-start justify-between')}>
                <div className="min-w-0">
                    <h2 className={cn('m-0 font-bold leading-tight text-foreground', isMobile ? 'text-xl' : 'text-2xl')}>
                        {title}
                    </h2>
                    {subtitle && (
                        <p className={cn('mt-0.5 text-muted-foreground', isMobile ? 'text-xs' : 'text-[13px]')}>
                            {subtitle}
                        </p>
                    )}
                </div>

                <div className={cn('flex shrink-0 flex-wrap items-center gap-2', shouldStack ? 'justify-start' : 'justify-end')}>
                    {rightSection}
                    <Button variant="ghost" size="sm" className="bg-primary/10 font-semibold text-primary hover:bg-primary/15 hover:text-primary" onClick={() => setHelpCenterOpen(true)}>
                        <IconInfoCircle size={14} stroke={2} />
                        Información
                    </Button>
                </div>
            </div>
        </div>
    );
};
