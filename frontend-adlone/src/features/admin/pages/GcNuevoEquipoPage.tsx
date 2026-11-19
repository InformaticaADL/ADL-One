import React, { useState } from 'react';
import { EquipoForm } from '../components/EquipoForm';
import { useToast } from '../../../contexts/ToastContext';

interface Props {
    onBack: () => void;
}

// Ingreso de un equipo al inventario, aparte de la lista de Equipos. Es un solo formulario: si el nombre del equipo
// está en el catálogo, el código sale con el correlativo siguiente; si no está, se puede marcar «Registrar como tipo
// nuevo» y el mismo formulario pasa a definir el tipo (sigla, qué mide, control de fechas) con su propio estilo.
// Al guardar, el equipo queda en el Inventario de Equipos (y el tipo nuevo, en el catálogo).
export const GcNuevoEquipoPage: React.FC<Props> = ({ onBack }) => {
    const { showToast } = useToast();
    // Cambia al guardar, para empezar otro equipo con el formulario en blanco.
    const [version, setVersion] = useState(0);

    return (
        <div className="shadcn-scope h-full min-h-0 overflow-y-auto">
            <div style={{ padding: 24, width: '100%' }}>
                <EquipoForm
                    key={version}
                    onCancel={onBack}
                    onSave={() => {
                        showToast({ type: 'success', message: 'Equipo ingresado: ya está en el Inventario de Equipos' });
                        setVersion((v) => v + 1);
                    }}
                />
            </div>
        </div>
    );
};

export default GcNuevoEquipoPage;
