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
    const shouldStack = useMediaQuery('(max-width: 1250px)');
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
        <div style={{ marginBottom: 16, marginTop: 8 }}>
            {breadcrumbItems && breadcrumbItems.length > 0 && (
                <Breadcrumb
                    style={{ marginBottom: 10, fontSize: 12 }}
                    items={breadcrumbItems.map((item) => ({
                        title: item.label,
                        href: item.href,
                        onClick: item.onClick,
                    }))}
                />
            )}

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: shouldStack ? 'auto 1fr' : '1fr auto 1fr',
                    alignItems: 'center',
                    width: '100%',
                    position: 'relative',
                    gap: 16,
                }}
            >
                {/* Left Section: Back Button */}
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    {onBack && (
                        <Button
                            type="text"
                            shape="circle"
                            size="large"
                            icon={<IconArrowLeft size={20} stroke={2} />}
                            onClick={onBack}
                        />
                    )}
                </div>

                {/* Center Section: Title & Subtitle */}
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '100%' }}>
                    <Title level={2} style={{ margin: 0, fontSize: isMobile ? 20 : 24, lineHeight: 1.1 }}>
                        {title}
                    </Title>
                    {subtitle && (
                        <Text type="secondary" style={{ fontSize: isMobile ? 12 : 13 }}>
                            {subtitle}
                        </Text>
                    )}
                </div>

                {/* Right Section: Actions + Help Button (Desktop) */}
                {!shouldStack && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Space size={8} wrap={false}>
                            {rightSection}
                            {helpButton}
                        </Space>
                    </div>
                )}
            </div>

            {/* Actions + Help Button (Mobile / Stacked) */}
            {shouldStack && (
                <div
                    className="page-header-actions-stacked"
                    style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginTop: 16 }}
                >
                    {rightSection}
                    {helpButton}
                </div>
            )}
        </div>
    );
};
