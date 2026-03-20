import React from 'react';
import { Paper, Text, Group, ThemeIcon } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';

interface SelectionCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    onClick: () => void;
    color?: string; // Color de acento
}

export const SelectionCard: React.FC<SelectionCardProps> = ({
    title,
    description,
    icon,
    onClick,
    color = '#1565c0'
}) => {
    return (
        <Paper
            withBorder
            p="xl"
            radius="lg"
            onClick={onClick}
            style={{ 
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                borderTop: `4px solid ${color}`,
                display: 'flex',
                flexDirection: 'column',
                height: '100%'
            }}
            className="selection-card-mantine"
        >
            <ThemeIcon 
                size={50} 
                radius="md" 
                variant="light" 
                color={color} 
                mb="lg"
                style={{ fontSize: '1.5rem', backgroundColor: `${color}15` }}
            >
                {icon}
            </ThemeIcon>
            
            <Text fw={700} size="lg" mb="xs" c="dark.4">{title}</Text>
            <Text size="sm" c="dimmed" style={{ flex: 1, lineHeight: 1.6 }}>{description}</Text>
            
            <Group justify="flex-end" mt="md" className="card-arrow-mantine" style={{ color: color, opacity: 0, transition: 'all 0.3s ease' }}>
                <IconChevronRight size={20} />
            </Group>

            <style dangerouslySetInnerHTML={{ __html: `
                .selection-card-mantine:hover {
                    transform: translateY(-8px);
                    box-shadow: var(--mantine-shadow-lg);
                }
                .selection-card-mantine:hover .card-arrow-mantine {
                    opacity: 1;
                    transform: translateX(5px);
                }
            `}} />
        </Paper>
    );
};
