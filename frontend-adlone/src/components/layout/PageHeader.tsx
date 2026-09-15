import React from 'react';
import { Button, Typography, Space } from 'antd';
import { IconInfoCircle, IconArrowLeft } from '@tabler/icons-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useNavStore } from '../../store/navStore';

const { Title, Text } = Typography;

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
    const { setHelpCenterOpen } = useNavStore();

    // La ruta global (Inicio / Módulo / Submódulo) ya vive en la barra de
    // ruta sobre el contenido (RouteBreadcrumb, ver TopBar.tsx) — este
    // encabezado ya no repite ese breadcrumb. Lo único que se conserva es un
    // botón "Volver" chico cuando la página necesita retroceder a una vista
    // interna anterior (ej. de "Detalle" a "Lista"): toma onBack si se pasó
    // directo, o si no, el onClick del penúltimo breadcrumbItem (el patrón
    // que ya usaban las páginas con navegación interna por sub-vistas).
    const backAction = onBack ?? (breadcrumbItems && breadcrumbItems.length > 1
        ? breadcrumbItems[breadcrumbItems.length - 2]?.onClick
        : undefined);

    const helpButton = (
        <Button
            type="text"
            size="small"
            icon={<IconInfoCircle size={14} stroke={2} />}
            onClick={() => setHelpCenterOpen(true)}
            style={{ fontWeight: 600, color: '#1677ff', backgroundColor: '#e6f4ff' }}
        >
            Información
        </Button>
    );

    return (
        <div style={{ marginBottom: 20, marginTop: 4 }}>
            {backAction && (
                <Button
                    type="link"
                    size="small"
                    icon={<IconArrowLeft size={14} />}
                    onClick={backAction}
                    style={{ padding: 0, marginBottom: 4, height: 'auto', fontWeight: 500 }}
                >
                    Volver
                </Button>
            )}

            <div
                style={{
                    display: 'flex',
                    flexDirection: shouldStack ? 'column' : 'row',
                    alignItems: shouldStack ? 'stretch' : 'flex-start',
                    justifyContent: 'space-between',
                    gap: shouldStack ? 12 : 16,
                    width: '100%',
                }}
            >
                <div style={{ minWidth: 0 }}>
                    <Title level={2} style={{ margin: 0, fontSize: isMobile ? 20 : 26, lineHeight: 1.2, fontWeight: 700 }}>
                        {title}
                    </Title>
                    {subtitle && (
                        <Text type="secondary" style={{ fontSize: isMobile ? 12 : 13, display: 'block', marginTop: 2 }}>
                            {subtitle}
                        </Text>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: shouldStack ? 'flex-start' : 'flex-end', flexShrink: 0 }}>
                    <Space size={8} wrap>
                        {rightSection}
                        {helpButton}
                    </Space>
                </div>
            </div>
        </div>
    );
};
