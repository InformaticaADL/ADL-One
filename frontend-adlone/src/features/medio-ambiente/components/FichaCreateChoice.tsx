import React from 'react';
import {
    IconFileText,
    IconUpload,
    IconArrowRight,
} from '@tabler/icons-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Props {
    onManual: () => void;
    onBulk: () => void;
    onBack: () => void;
}

const OPTIONS = [
    {
        key: 'manual', icon: IconFileText,
        title: 'Creación Manual',
        description: 'Formulario paso a paso para ingresar antecedentes, análisis y observaciones de una sola ficha.',
        cta: 'Iniciar formulario', badge: null,
    },
    {
        key: 'bulk', icon: IconUpload,
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

            <div className="mb-7 text-center">
                <h3 className="m-0 text-lg font-semibold text-foreground">¿Cómo desea crear la ficha?</h3>
                <p className="mx-auto mt-1.5 max-w-[480px] text-sm text-muted-foreground">
                    Seleccione el método de ingreso: manual, o cargando múltiples archivos a la vez.
                </p>
            </div>

            <div
                className="mx-auto grid max-w-[760px] gap-4"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}
            >
                {OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                        <Card
                            key={opt.key}
                            onClick={handlers[opt.key]}
                            className="relative cursor-pointer p-7 text-center transition-all hover:-translate-y-1 hover:border-primary"
                        >
                            {opt.badge && (
                                <Badge variant="secondary" className="absolute right-3 top-3">{opt.badge}</Badge>
                            )}
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Icon size={32} />
                            </div>
                            <span className="block text-base font-semibold text-foreground">{opt.title}</span>
                            <p className="mt-1.5 text-[13px] text-muted-foreground">
                                {opt.description}
                            </p>
                            <div className="mt-4 flex items-center justify-center gap-1 text-[13px] font-semibold text-primary">
                                {opt.cta} <IconArrowRight size={16} />
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};
