import React from 'react';
import { Group, Stack, Title, Text, ActionIcon, Breadcrumbs, Anchor, rem, Box, Button } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconArrowLeft, IconInfoCircle } from '@tabler/icons-react';
import { useNavStore } from '../../store/navStore';

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
    const { setHelpCenterOpen } = useNavStore();

    const items = breadcrumbItems?.map((item, index) => (
        <Anchor 
            key={index} 
            onClick={item.onClick} 
            href={item.href} 
            underline="hover" 
            size="xs" 
            c="dimmed"
        >
            {item.label}
        </Anchor>
    ));

    const helpButton = (
        <Button
            variant="light"
            color="adl-blue"
            size="xs"
            radius="md"
            leftSection={<IconInfoCircle size={14} stroke={2} />}
            onClick={() => setHelpCenterOpen(true)}
            styles={{
                root: {
                    fontWeight: 600,
                    border: '1px solid var(--mantine-color-adl-blue-2)',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                        backgroundColor: 'var(--mantine-color-adl-blue-1)',
                    }
                }
            }}
        >
            Información
        </Button>
    );

    return (
            <Box mb="md" mt="sm">
                {items && items.length > 0 && (
                    <Breadcrumbs mb={10}>{items}</Breadcrumbs>
                )}
                
                <Group wrap="nowrap" align="center" style={{ width: '100%', position: 'relative' }}>
                    
                    {/* Left Section: Back Button */}
                    <Box style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', minWidth: 0 }}>
                        {onBack && (
                            <ActionIcon 
                                variant="subtle" 
                                color="gray" 
                                size="lg" 
                                onClick={onBack}
                                radius="md"
                            >
                                <IconArrowLeft style={{ width: rem(20), height: rem(20) }} stroke={2} />
                            </ActionIcon>
                        )}
                    </Box>

                    {/* Center Section: Title & Subtitle */}
                    <Stack 
                        gap={2} 
                        style={{ 
                            flex: '0 1 auto', 
                            textAlign: 'center',
                            alignItems: 'center',
                            maxWidth: isMobile ? '80%' : '60%'
                        }}
                    >
                        <Title 
                            order={2} 
                            style={{ 
                                fontSize: isMobile ? rem(20) : rem(24), 
                                lineHeight: 1.1 
                            }}
                        >
                            {title}
                        </Title>
                        {subtitle && (
                            <Text c="dimmed" size={isMobile ? "xs" : "sm"}>
                                {subtitle}
                            </Text>
                        )}
                    </Stack>

                    {/* Right Section: Actions + Help Button (Desktop) */}
                    <Box style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>
                        {!isMobile && (
                            <Group gap="xs" wrap="nowrap">
                                {rightSection}
                                {helpButton}
                            </Group>
                        )}
                    </Box>

                </Group>
                
                {/* Actions + Help Button (Mobile) */}
                {isMobile && (
                    <Box mt="md" style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: rem(8), flexWrap: 'wrap' }}>
                        {rightSection}
                        {helpButton}
                    </Box>
                )}
            </Box>
    );
};
