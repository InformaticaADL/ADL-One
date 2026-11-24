import React from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useNavStore } from '../../../store/navStore';
import { DashboardQA } from '../components/quejas-apelaciones/DashboardQA';

/** G. Calidad → Calidad → Dashboard de quejas y apelaciones (datos de la base de ADLWeb). */
export const GcQaDashboardPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { setActiveSubmodule, setPendingQaCasoId } = useNavStore();
    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Dashboard · Quejas y Apelaciones"
                subtitle="Plazos, tendencias, causas y carga de trabajo del área de Medioambiente (NCh-ISO/IEC 17025 cl. 7.9 y 8.9)."
                onBack={onBack}
                breadcrumbItems={[{ label: 'Calidad', onClick: () => setActiveSubmodule('gc-hub-cal') }, { label: 'Dashboard' }]}
            />
            <DashboardQA onAbrirCaso={(p) => {
                setPendingQaCasoId(p.id);
                setActiveSubmodule(p.tipo === 'apelacion' ? 'gc-apelaciones' : 'gc-quejas');
            }} />
        </div>
    );
};
