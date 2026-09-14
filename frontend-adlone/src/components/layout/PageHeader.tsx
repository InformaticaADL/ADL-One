import React from 'react';
import { Button, Breadcrumb, Typography, Space } from 'antd';
import { IconInfoCircle } from '@tabler/icons-react';
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

    // Sin botón "volver": la navegación hacia atrás es solo por breadcrumb.
    // Si una página pasa onBack sin breadcrumbItems, se arma uno mínimo para
    // que nunca quede sin forma de volver.
    const crumbs = breadcrumbItems && breadcrumbItems.length > 0
        ? breadcrumbItems
        : onBack
            ? [{ label: 'Volver', onClick: onBack }, { label: title }]
            : [];

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
            {crumbs.length > 0 && (
                <Breadcrumb
                    style={{ marginBottom: 8, fontSize: 12 }}
                    items={crumbs.map((item) => ({
                        title: item.label,
                        href: item.href,
                        onClick: item.onClick,
                        className: item.onClick ? 'cursor-pointer' : undefined,
                    }))}
                />
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
