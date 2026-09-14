import React from 'react';
import { Card, Typography, Tag } from 'antd';
import {
    IconFileText,
    IconUpload,
    IconArrowRight,
} from '@tabler/icons-react';
import { PageHeader } from '../../../components/layout/PageHeader';

const { Title, Text } = Typography;

interface Props {
    onManual: () => void;
    onBulk: () => void;
    onBack: () => void;
}

const OPTIONS = [
    {
        key: 'manual', icon: IconFileText, accent: 'var(--app-accent-text)', accentBg: 'var(--app-accent-bg)',
        title: 'Creación Manual',
        description: 'Formulario paso a paso para ingresar antecedentes, análisis y observaciones de una sola ficha.',
        cta: 'Iniciar formulario', badge: null,
    },
    {
        key: 'bulk', icon: IconUpload, accent: '#9c36b5', accentBg: 'rgba(190,75,219,0.12)',
        title: 'Carga Masiva (PDF / Excel)',
        description: 'Suba hasta 1000 archivos (PDF o Excel). El sistema extraerá los datos, los validará y creará las fichas automáticamente.',
        cta: 'Cargar archivos', badge: 'MASIVO',
    },
];

export const FichaCreateChoice: React.FC<Props> = ({ onManual, onBulk, onBack }) => {
    const handlers: Record<string, () => void> = { manual: onManual, bulk: onBulk };

    return (
        <div>
            <PageHeader
                title="Nueva Ficha de Ingreso"
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBack },
                    { label: 'Crear Ficha' }
                ]}
            />

            <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <Title level={3} style={{ margin: 0 }}>¿Cómo desea crear la ficha?</Title>
                <Text type="secondary" style={{ maxWidth: 480, display: 'block', margin: '6px auto 0' }}>
                    Seleccione el método de ingreso: manual, o cargando múltiples archivos a la vez.
                </Text>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 16,
                maxWidth: 760,
                margin: '0 auto',
            }}>
                {OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                        <Card
                            key={opt.key}
                            hoverable
                            onClick={handlers[opt.key]}
                            styles={{ body: { padding: 28, position: 'relative', textAlign: 'center' } }}
                        >
                            {opt.badge && (
                                <Tag color="purple" style={{ position: 'absolute', top: 12, right: 12 }}>{opt.badge}</Tag>
                            )}
                            <div style={{
                                width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                backgroundColor: opt.accentBg, color: opt.accent,
                            }}>
                                <Icon size={32} />
                            </div>
                            <Text strong style={{ fontSize: 16, display: 'block' }}>{opt.title}</Text>
                            <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 6 }}>
                                {opt.description}
                            </Text>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 16, color: opt.accent, fontWeight: 600, fontSize: 13 }}>
                                {opt.cta} <IconArrowRight size={16} />
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};
