import React from 'react';
import { Group, Stack, Title, Text, ActionIcon, Breadcrumbs, Anchor, rem, Box } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';

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

    return (
        <Box mb="md" mt="sm">
            {items && items.length > 0 && (
                <Breadcrumbs mb={10}>{items}</Breadcrumbs>
            )}
            
            <Group justify="space-between" align="center" wrap="nowrap">
                <Group gap="md">
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
                    <Stack gap={2}>
                        <Title 
                            order={2} 
                            style={{ 
                                fontSize: rem(24), 
                                lineHeight: 1.1 
                            }}
                        >
                            {title}
                        </Title>
                        {subtitle && (
                            <Text c="dimmed" size="sm">
                                {subtitle}
                            </Text>
                        )}
                    </Stack>
                </Group>
                
                {rightSection && (
                    <Box>
                        {rightSection}
                    </Box>
                )}
            </Group>
        </Box>
    );
};
