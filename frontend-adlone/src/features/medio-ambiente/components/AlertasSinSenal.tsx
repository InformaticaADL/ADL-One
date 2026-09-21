import { useEffect, useState } from 'react';
import { IconAlertTriangle } from '@tabler/icons-react';
import type { JornadaHoy } from '../services/tracking.service';
import { estaSinSenal } from '../utils/fichaHoyHelpers';

interface AlertasSinSenalProps {
    jornadas: JornadaHoy[];
}

export function AlertasSinSenal({ jornadas }: AlertasSinSenalProps) {
    // Fuerza un re-render cada 15s para que la alerta aparezca/desaparezca
    // en vivo al cruzar el umbral, aunque no llegue ningún evento nuevo por
    // socket (mismo patrón que FlotaPanel.tsx y DetalleJornadaDrawer.tsx).
    const [, forceTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => forceTick((t) => t + 1), 15_000);
        return () => clearInterval(id);
    }, []);

    const afectados = jornadas.filter(estaSinSenal);
    if (afectados.length === 0) return null;

    const nombres = afectados.map((j) => j.nombre_muestreador).join(', ');

    return (
        <div className="shadcn-scope m-3 flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/10 p-3">
            <IconAlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
            <div>
                <p className="m-0 text-sm font-semibold text-foreground">
                    {afectados.length === 1 ? 'Sin señal' : `${afectados.length} muestreadores sin señal`}
                </p>
                <p className="m-0 mt-0.5 text-[13px] text-muted-foreground">
                    {nombres} {afectados.length === 1 ? 'lleva' : 'llevan'} más de 10 minutos en ruta sin reportar
                    ubicación. Puede ser mala señal en la zona, batería agotada, o que cerró la app sin pausar/terminar
                    la jornada.
                </p>
            </div>
        </div>
    );
}
