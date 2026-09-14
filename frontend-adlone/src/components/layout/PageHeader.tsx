import React from 'react';
import { Button, Breadcrumb, Typography, Space } from 'antd';
import { IconArrowLeft, IconInfoCircle } from '@tabler/icons-react';
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

    const helpButton = (
        <Button
            type="text"
            size="small"
            icon={<IconInfoCircle size={14} stroke={2} />}
            onClick={() => setHelpCenterOpen(true)}
            style={{ fontWeight: 600, color: '#0062a8', backgroundColor: '#e6f0fa' }}
        >
            Información
        </Button>
    );

    return (
        <div style={{ marginBottom: 20, marginTop: 4 }}>
            {breadcrumbItems && breadcrumbItems.length > 0 && (
                <Breadcrumb
                    style={{ marginBottom: 8, fontSize: 12 }}
                    items={breadcrumbItems.map((item) => ({
                        title: item.label,
                        href: item.href,
                        onClick: item.onClick,
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
                {/* Left: back button (optional) + título/subtítulo, siempre alineados a la izquierda */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
                    {onBack && (
                        <Button
                            type="text"
                            shape="circle"
                            size="large"
                            icon={<IconArrowLeft size={20} stroke={2} />}
                            onClick={onBack}
                            style={{ flexShrink: 0, marginTop: -4 }}
                        />
                    )}
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
                </div>

                {/* Right: acciones de la página + botón de ayuda, minimalistas y a la derecha */}
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
