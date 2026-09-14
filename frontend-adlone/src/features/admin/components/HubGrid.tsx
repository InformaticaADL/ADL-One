import React, { useState } from 'react';
import { Card, Typography } from 'antd';

const { Text } = Typography;

export interface HubOption {
    id: string;
    label: string;
    icon: React.ReactNode;
    color: string;
    bg: string;
    description: string;
    badge?: React.ReactNode;
}

interface HubGridProps {
    options: HubOption[];
    onNavigate: (id: string) => void;
    emptyText?: string;
}

export function HubGrid({ options, onNavigate, emptyText = 'No tiene permisos para acceder a las funcionalidades de este módulo.' }: HubGridProps) {
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, marginTop: 32 }}>
            {options.map((opt) => (
                <div
                    key={opt.id}
                    onClick={() => onNavigate(opt.id)}
                    onMouseEnter={() => setHoveredId(opt.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{ cursor: 'pointer' }}
                >
                    <Card
                        style={{
                            height: '100%',
                            transition: 'all 0.2s ease',
                            transform: hoveredId === opt.id ? 'translateY(-5px)' : 'none',
                            boxShadow: hoveredId === opt.id ? '0 8px 20px rgba(0,0,0,0.08)' : undefined,
                            borderColor: hoveredId === opt.id ? opt.color : undefined,
                        }}
                    >
                        <div style={{
                            width: 60, height: 60, borderRadius: 8, backgroundColor: opt.bg, color: opt.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
                        }}>
                            {opt.icon}
                        </div>

                        <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 4 }}>
                            {opt.label}
                            {opt.badge}
                        </Text>

                        <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.5 }}>
                            {opt.description}
                        </Text>
                    </Card>
                </div>
            ))}

            {options.length === 0 && (
                <Card style={{ backgroundColor: 'var(--app-hover-bg)' }}>
                    <Text type="secondary" style={{ textAlign: 'center', display: 'block' }}>{emptyText}</Text>
                </Card>
            )}
        </div>
    );
}
