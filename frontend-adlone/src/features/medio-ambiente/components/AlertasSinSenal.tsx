import { useEffect, useState } from 'react';
import { Alert, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import type { JornadaHoy } from '../services/tracking.service';

// Mismo umbral que ya usa FlotaPanel.tsx para el badge "Sin señal" — acá se
// eleva a una alerta visible arriba de la lista/mapa en vez de quedar
// enterrada en una fila, porque es la situación que más le importa detectar
// rápido a un supervisor (¿le pasó algo, se quedó sin batería, o solo hay
// mala señal en esa zona?).
const UMBRAL_SIN_SENAL_MS = 10 * 60 * 1000;

// Solo alerta jornadas 'en_ruta': una pausada o finalizada NO reporta
// posición a propósito (el GPS está apagado), así que aplicar el mismo
// umbral ahí generaría una alerta falsa cada vez que alguien pausa o
// termina su día.
function estaSinSenal(jornada: JornadaHoy): boolean {
    if (jornada.estado !== 'en_ruta') return false;
    // Sin ninguna posición todavía (recién tocó "Iniciar Ruta", el primer
    // ping GPS puede tardar hasta ~45s, o llegar más tarde si quedó
    // encolado offline): medir contra CUÁNDO empezó el tramo, no disparar
    // la alerta de inmediato — antes esto era `return true` sin medir
    // tiempo, mostrando el banner a los 30s de iniciar la ruta.
    const referencia = jornada.ultima_posicion?.timestamp_reporte
        ?? jornada.fecha_inicio_tramo_actual
        ?? jornada.fecha_inicio;
    return Date.now() - new Date(referencia).getTime() > UMBRAL_SIN_SENAL_MS;
}

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
        <Alert
            color="orange"
            variant="light"
            icon={<IconAlertTriangle size={16} />}
            title={afectados.length === 1 ? 'Sin señal' : `${afectados.length} muestreadores sin señal`}
            mx="sm"
            mt="sm"
        >
            <Text size="sm">
                {nombres} {afectados.length === 1 ? 'lleva' : 'llevan'} más de 10 minutos en ruta sin reportar
                ubicación. Puede ser mala señal en la zona, batería agotada, o que cerró la app sin pausar/terminar
                la jornada.
            </Text>
        </Alert>
    );
}
