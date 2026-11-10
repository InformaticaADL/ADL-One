import {
    IconChevronRight,
    IconInfoCircle,
    IconBulb,
    IconBook2,
    IconMail,
    IconMessageCircle
} from '@tabler/icons-react';
import { useNavStore } from '../../store/navStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Círculo de ícono liviano — reemplaza al ThemeIcon de Mantine, usado por
// todo este panel para las viñetas de "paso a paso" y consejos.
function IconCircle({ children, color, size = 24 }: { children: React.ReactNode; color: string; size?: number }) {
    return (
        <div style={{
            flexShrink: 0, width: size, height: size, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: `${color}1a`, color,
        }}>
            {children}
        </div>
    );
}

interface HelpCenterProps {
    opened: boolean;
    onClose: () => void;
}

interface HelpContent {
    title: string;
    queEs: string;
    queHace: string;
    comoFunciona: string[];
    tips?: string[];
}

const getContextHelp = (
    activeModule: string,
    activeSubmodule: string,
    fichasMode: string,
    isGlobal: boolean = false
): HelpContent | null => {

    if (isGlobal) {
        return {
            title: 'Bienvenido a ADL ONE',
            queEs: 'Sistema integral de gestión operativa y control de servicios para ADL.',
            queHace: 'Centraliza la coordinación, asignación y seguimiento en tiempo real de los servicios en terreno y laboratorio.',
            comoFunciona: [
                'Usa el menú lateral izquierdo para navegar por los distintos módulos disponibles según tu perfil.',
                'En la parte superior derecha encontrarás tu menú de usuario donde puedes gestionar tu perfil, firma y foto.',
                'Las notificaciones importantes aparecerán en la campana de alertas superior.',
                'En caso de problemas, comunícate con el área de soporte informático.'
            ],
            tips: [
                'Mantén actualizado tu perfil con foto y firma digital para que el sistema los use correctamente en documentos e informes.',
                'Si tienes dudas o encuentras un error, comunícate con informatica@adldiagnostic.cl o usa el módulo de Solicitudes (URS).'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: FICHAS DE INGRESO (Medio Ambiente) — según fichasMode
    // ─────────────────────────────────────────────────────────────────────────
    if (activeSubmodule === 'ma-fichas-ingreso') {
        switch (fichasMode) {
            case 'create_choice':
                return {
                    title: 'Selección de Tipo de Creación',
                    queEs: 'Pantalla de elección inicial al crear una nueva ficha.',
                    queHace: 'Te permite elegir si deseas crear la ficha de forma manual (una a una) o de forma masiva (cargando un archivo Excel con múltiples fichas).',
                    comoFunciona: [
                        'Haz clic en «Crear Ficha Manual» para ingresar los datos de una sola ficha de muestreo.',
                        'Haz clic en «Carga Masiva» si necesitas ingresar varias fichas a la vez usando una plantilla Excel.',
                        'Si te equivocas, usa el botón «Atrás» para volver al menú principal de Fichas de Ingreso.'
                    ],
                    tips: [
                        'Usa la Carga Masiva cuando tengas más de 5 fichas del mismo cliente para ingresar simultáneamente.'
                    ]
                };
            case 'create_manual':
                return {
                    title: 'Ficha de Ingreso: Creación Manual',
                    queEs: 'Formulario de registro individual de fichas de muestreo y servicios técnicos.',
                    queHace: 'Permite registrar un nuevo servicio en el sistema especificando el cliente, centro de cultivo, tipo de ficha y los análisis requeridos.',
                    comoFunciona: [
                        '1. Selecciona el «Cliente» desde el menú desplegable (puedes buscar por nombre).',
                        '2. Elige el «Centro de Cultivo» asociado al cliente seleccionado.',
                        '3. Define el «Tipo de Ficha» (ej. Autocontrol, Patología, Fisicoquímica, etc.).',
                        '4. Selecciona el o los «Parámetros» a medir y el tipo de muestra (agua, sedimento, etc.).',
                        '5. Ingresa la «Fecha de Solicitud» y cualquier observación relevante.',
                        '6. Presiona «Guardar Ficha» al final del formulario para registrar la ficha e iniciar el flujo de validación.',
                        '7. Si hay campos con error, el formulario los marcará en rojo indicando qué corregir.'
                    ],
                    tips: [
                        'Todos los campos marcados con (*) son obligatorios.',
                        'El sistema asignará automáticamente un número de correlativo único (ej. ADL-2026-XXXX) al guardar.'
                    ]
                };
            case 'create_bulk':
                return {
                    title: 'Ficha de Ingreso: Carga Masiva',
                    queEs: 'Módulo de importación en lote de fichas de muestreo mediante Excel.',
                    queHace: 'Permite ingresar decenas de fichas simultáneamente sin tener que crear cada una manualmente, reduciendo el tiempo de ingreso masivamente.',
                    comoFunciona: [
                        '1. Haz clic en «Descargar Plantilla» para obtener el archivo Excel oficial con el formato correcto.',
                        '2. Abre el archivo Excel y rellena cada fila con los datos de una ficha (cliente, centro, tipo, parámetros, etc.).',
                        '3. NO modifiques los encabezados de las columnas ni el formato de las celdas.',
                        '4. Guarda el archivo Excel en tu computador.',
                        '5. Regresa a la pantalla de Carga Masiva y arrastra el archivo al recuadro de carga, o haz clic en él para buscarlo.',
                        '6. Presiona «Cargar Archivo» para iniciar el proceso de importación.',
                        '7. Revisa el reporte de resultados: las filas procesadas exitosamente y las que tuvieron errores con su descripción.'
                    ],
                    tips: [
                        'Si una fila tiene error, corrígela en el Excel y vuelve a intentar solo con las filas fallidas.',
                        'El archivo no debe superar los 5 MB de tamaño.'
                    ]
                };
            case 'list_fichas':
                return {
                    title: 'Explorador y Validación de Fichas',
                    queEs: 'Bandeja de control de calidad y revisión de ingresos registrados.',
                    queHace: 'Permite a los coordinadores buscar, revisar, validar y gestionar todas las fichas de muestreo ingresadas en el sistema.',
                    comoFunciona: [
                        '1. Usa los filtros superiores (fecha, cliente, estado, correlativo) para buscar fichas específicas.',
                        '2. La tabla muestra todas las fichas con su estado actual (Pendiente, Validada, Asignada, etc.).',
                        '3. Haz clic en el botón «Ver» de una fila para abrir el detalle completo de esa ficha.',
                        '4. El color del estado te indica el avance: Gris=Sin estado, Amarillo=Pendiente Técnica, Azul=Pendiente Coordinación, Verde=Vigente/Aprobada, Rojo=Rechazada/Cancelada.',
                        '5. Puedes filtrar por estado para ver solo las fichas que requieren tu atención (ej. las «Pendientes»).',
                        '6. La columna «Correlativo» muestra el código único de la ficha generado por el sistema.'
                    ],
                    tips: [
                        'Usa el filtro de «Fecha Desde/Hasta» para encontrar fichas dentro de un rango específico.',
                        'Puedes exportar el listado filtrado haciendo clic en «Exportar» si tienes el permiso correspondiente.'
                    ]
                };
            case 'detail_ficha':
                return {
                    title: 'Detalle de Ficha de Ingreso',
                    queEs: 'Vista detallada de una ficha de muestreo individual: antecedentes, análisis solicitados e historial de validaciones.',
                    queHace: 'Permite revisar toda la información registrada de una ficha específica y ejecutar las acciones de validación según el rol del usuario (Técnica, Coordinación o edición Comercial).',
                    comoFunciona: [
                        '1. CABECERA: Muestra el número de ficha, estado actual (con color), y los botones de acción disponibles para tu rol.',
                        '2. PESTAÑA «ANTECEDENTES»: Muestra todos los datos de identificación ingresados al crear la ficha: Monitoreo, Base de Operaciones, Cliente, Empresa de Servicio, Fuente Emisora, Contacto, Objetivo, Tabla/Glosa, Componente, Tipo Muestreo, Tipo Muestra, Actividad, Responsable, Cargo, Instrumento, Frecuencia y Programación. Si la ficha tiene coordenadas GPS, se muestra un mapa integrado con la ubicación.',
                        '3. PESTAÑA «ANÁLISIS»: Lista todos los parámetros analíticos solicitados con su normativa, tabla de referencia, tipo de muestra, límites min/max, laboratorio principal y secundario. Los usuarios con permiso «FI_EXP_VER_UF» también verán la columna de UF (Unidades Fiscalizables).',
                        '4. PESTAÑA «VALIDACIÓN E HISTORIAL»: Muestra el timeline completo de observaciones y cambios de estado de la ficha. Aquí también aparecen los paneles de acción según tu rol:',
                        '   — Si eres Área Técnica (FI_APROBAR_TEC / FI_RECHAZAR_TEC): verás un panel azul para ingresar observaciones y luego «Aprobar Técnica» o «Pedir Corrección Comercial». Debes visitar las 3 pestañas antes de poder aprobar.',
                        '   — Si eres Coordinación (FI_APROBAR_COO / FI_RECHAZAR_COO): verás un panel violeta para ingresar observaciones y luego «Aprobar Coordinación» o «Devolver a Comercial».',
                        '5. BOTÓN «EDITAR COMERCIAL»: Visible solo si tienes permiso FI_EDITAR y la ficha aún no ha avanzado en el flujo. Activa el modo edición de Antecedentes y Análisis.',
                        '6. BOTÓN «EXPORTAR PDF»: Descarga la ficha en formato PDF. Si la ficha fue rechazada, el botón aparece en rojo como advertencia.',
                        '7. Si la ficha es un REMUESTREO, aparece un banner informativo azul al inicio indicando el número de la ficha original.'
                    ],
                    tips: [
                        'Debes visitar las 3 pestañas (Antecedentes, Análisis e Historial) antes de poder aprobar técnicamente — esto garantiza una revisión completa.',
                        'Al editar comercialmente, ingresa siempre una observación explicando el cambio; queda registrada en el historial.',
                        'El estado de la ficha está mapeado por colores: Amarillo=Pendiente Técnica, Azul=Pendiente Coordinación, Verde=Aprobada/Vigente, Rojo=Rechazada, Gris=Sin estado.'
                    ]
                };
            case 'list_assign':
                return {
                    title: 'Planificación y Asignación — Listado',
                    queEs: 'Bandeja de fichas aprobadas listas para ser asignadas a muestreadores y programadas en terreno.',
                    queHace: 'Permite seleccionar fichas en estado «Aprobada Coordinación» y abrir el panel de asignación detallada para definir fechas y responsables.',
                    comoFunciona: [
                        '1. La tabla muestra las fichas pendientes de asignación, ordenadas por fecha de solicitud.',
                        '2. Usa los filtros superiores (cliente, fecha, correlativo) para encontrar fichas específicas.',
                        '3. Haz clic en «Ver» en una fila para abrir el panel de Asignación de Recursos de esa ficha.',
                        '4. En el panel de asignación podrás definir fechas, muestreadores y calcular automáticamente la programación.',
                        '5. Una vez guardada la asignación, la ficha cambia de estado y queda visible para el muestreador en su app.'
                    ],
                    tips: [
                        'Filtra por «Estado» para ver solo las fichas pendientes de asignación.',
                        'Verifica la disponibilidad del muestreador en el Calendario antes de asignar para evitar sobrecargas.'
                    ]
                };
            case 'detail_assign':
                return {
                    title: 'Asignación de Recursos — Detalle de Ficha',
                    queEs: 'Panel de gestión de la planificación operativa de una ficha específica: fechas, muestreadores y correlativos.',
                    queHace: 'Permite definir o actualizar las fechas de instalación/retiro y los muestreadores responsables para cada correlativo (visita) de la ficha seleccionada.',
                    comoFunciona: [
                        '1. CABECERA CON MÉTRICAS: Muestra la frecuencia, periodo, factor, cantidad de servicios activos y duración del muestreo (en horas).',
                        '2. AUTO-CALCULAR FECHAS: Ingresa una «Fecha Referencia» (fecha del primer muestreo) y presiona «Auto-Calcular». El sistema distribuirá automáticamente las fechas de instalación y retiro para todos los correlativos según la frecuencia y duración programada en la ficha.',
                        '3. ASIGNACIÓN MASIVA DE MUESTREADOR: Usa los selectores «M. Instalación (Todos)» y «M. Retiro (Todos)» para asignar el mismo muestreador a todos los correlativos a la vez.',
                        '4. TABLA DE CORRELATIVOS: Cada fila es un correlativo (visita individual). Puedes editar la fecha de instalación, fecha de retiro y los muestreadores de instalación y retiro de forma independiente por fila.',
                        '5. Si la ficha es un REMUESTREO, aparece un banner azul con el muestreador original. Asignar otro muestreador requiere confirmación y puede generar conflictos de equipamiento.',
                        '6. Botón «Guardar Planificación»: guarda todos los cambios. Si no todos los correlativos tienen datos completos, el sistema pregunta si deseas guardar parcialmente.',
                        '7. Los correlativos con estado CANCELADO o ANULADO aparecen atenuados y no se pueden editar.'
                    ],
                    tips: [
                        'Si el muestreo dura 24h o más, la fecha de instalación y la de retiro no pueden ser el mismo día.',
                        'La fecha de instalación nunca puede ser posterior a la fecha de retiro.',
                        'Para fichas de remuestreo: si asignas al muestreador original verás el indicador «H. ✓» en la fila, confirmando que es el mismo que realizó el muestreo inicial.',
                        'No puedes asignar fechas anteriores a hoy — el sistema bloqueará el guardado si lo detecta.'
                    ]
                };
            case 'calendar':
                return {
                    title: 'Calendario de Terreno',
                    queEs: 'Planificador mensual interactivo de visitas a terreno.',
                    queHace: 'Muestra de forma visual la distribución de todas las visitas en terreno asignadas a cada muestreador a lo largo del mes, facilitando la planificación.',
                    comoFunciona: [
                        '1. El calendario despliega una vista mensual con todos los eventos de terreno del mes actual.',
                        '2. Cada evento (visita asignada) aparece en un color diferente según el muestreador responsable.',
                        '3. Haz clic en cualquier evento para ver el detalle: cliente, centro, ficha asociada y muestreador.',
                        '4. Para re-agendar una visita, arrastra el evento (Drag & Drop) a otro día del mes.',
                        '5. Usa las flechas de navegación para moverte entre meses y ver planificaciones futuras o pasadas.',
                        '6. El botón «Hoy» te vuelve rápidamente al mes actual.'
                    ],
                    tips: [
                        'Un muestreador con muchos eventos en un día puede indicar sobrecarga. Reorganiza si es necesario.'
                    ]
                };
            case 'list_ejecutados':
                return {
                    title: 'Muestreos Completados',
                    queEs: 'Bandeja de auditoría y recepción de trabajo realizado en terreno.',
                    queHace: 'Centraliza los resultados enviados por los muestreadores desde terreno para su revisión técnica por parte de los coordinadores de laboratorio.',
                    comoFunciona: [
                        '1. La lista muestra todas las fichas que el muestreador marcó como «Completadas» desde su dispositivo en terreno.',
                        '2. Haz clic en una fila para revisar el detalle completo del muestreo ejecutado.',
                        '3. En el detalle podrás ver: fotos de la muestra, coordenadas GPS de recolección, hora exacta y parámetros medidos in situ (temperatura, pH, etc.).',
                        '4. Comprueba que los datos recolectados sean coherentes con lo solicitado en la ficha original.',
                        '5. Usa los filtros superiores para buscar por muestreador, fecha o cliente.',
                        '6. Si detectas una inconsistencia, puedes solicitar un remuestreo directamente desde el detalle de la ficha.'
                    ],
                    tips: [
                        'Las coordenadas GPS te permiten verificar que el muestreador estuvo físicamente en el centro de cultivo correcto.'
                    ]
                };
            case 'route_planner':
            case 'route_planner_map':
                return {
                    title: 'Planificador de Rutas',
                    queEs: 'Optimizador logístico cartográfico para rutas de terreno.',
                    queHace: 'Permite trazar rutas eficientes en un mapa interactivo geolocalizando múltiples centros de cultivo en un solo viaje, minimizando tiempos y costos de traslado.',
                    comoFunciona: [
                        '1. En el panel lateral verás la lista de centros de cultivo asignados al muestreador seleccionado.',
                        '2. Marca los centros que el muestreador debe visitar en ese viaje.',
                        '3. Haz clic en «Trazar Ruta» para calcular el recorrido óptimo. El mapa mostrará la ruta con distancias y tiempos estimados.',
                        '4. Puedes reordenar manualmente los puntos de parada arrastrándolos en la lista si prefieres un orden diferente.',
                        '5. Haz clic en «Guardar Ruta» para asignarle un nombre y asociarla a un grupo o muestreador.',
                        '6. Las rutas guardadas quedan disponibles para ser reutilizadas en próximas planificaciones.'
                    ],
                    tips: [
                        'Agrupa visitas a centros geográficamente cercanos en la misma ruta para optimizar combustible y tiempo.'
                    ]
                };
            case 'dashboard':
                return {
                    title: 'Dashboard Operativo',
                    queEs: 'Vista minimalista de la coordinación diaria, carga de trabajo y estados.',
                    queHace: 'Proporciona una radiografía instantánea de la operación: balances diarios, embudo de estados, top de clientes exigentes y ranking de muestreadores.',
                    comoFunciona: [
                        '1. Observa el balance general de Muestreos Iniciados vs Finalizados para medir la eficiencia de la jornada.',
                        '2. Usa el filtro rápido (15 Días, 30 Días, etc.) arriba a la derecha para acercar o alejar la línea de tiempo.',
                        '3. Revisa el «Embudo de Estados» para detectar cuellos de botella al instante.',
                        '4. Identifica qué muestreadores y clientes tienen la mayor carga operativa actual.',
                        '5. Haz clic en el ícono de «Información (i)» en cualquier gráfico para ver cómo se procesan esos datos.'
                    ],
                    tips: [
                        'Mantén esta vista abierta durante tu jornada para monitorear el flujo de trabajo en tiempo real sin distracciones.'
                    ]
                };
            case 'manage_empresas':
                return {
                    title: 'Empresas de Servicio',
                    queEs: 'Catálogo maestro de empresas externas que prestan servicios de muestreo y terreno para ADL.',
                    queHace: 'Permite registrar, editar y gestionar las empresas de servicio (subcontratistas, laboratorios externos, empresas de logística) que se usan como referencia al crear fichas de ingreso.',
                    comoFunciona: [
                        '1. La pantalla muestra el formulario de creación/edición de una empresa de servicio.',
                        '2. DATOS PRINCIPALES: Ingresa el nombre de la empresa, RUT, dirección y teléfono de contacto.',
                        '3. CONTACTO: Ingresa el nombre del contacto principal, su email y teléfono directo.',
                        '4. Una vez guardada, la empresa quedará disponible en el selector «Empresa de Servicio» al crear nuevas fichas de ingreso.',
                        '5. Para ver el listado de empresas existentes, usa el botón «← Atrás» para volver al explorador.',
                        '6. Para editar una empresa existente, búscala en el listado y haz clic en el ícono de lápiz de su fila.'
                    ],
                    tips: [
                        'El nombre de la empresa debe ser único en el sistema — si ya existe un registro con el mismo nombre, el sistema te avisará.',
                        'Los contactos y emails ingresados aquí aparecerán pre-rellenados al seleccionar la empresa en el formulario de nueva ficha.'
                    ]
                };
            default: // 'menu' o cualquier otro
                return {
                    title: 'Fichas de Ingreso — Menú Principal',
                    queEs: 'Módulo central de gestión de muestreos medioambientales.',
                    queHace: 'Centraliza todas las herramientas del ciclo de vida de una ficha: registro, validación, asignación, ejecución en terreno, planificación de rutas y análisis estadístico.',
                    comoFunciona: [
                        '1. Haz clic en «Nueva Ficha» para registrar un nuevo servicio de muestreo de forma individual.',
                        '2. Usa «Carga Masiva» para ingresar muchas fichas a la vez desde un archivo Excel.',
                        '3. Accede a «Explorador de Fichas» para buscar, validar y gestionar fichas existentes.',
                        '4. Entra a «Asignación» para asignar fichas validadas a los muestreadores de terreno.',
                        '5. Usa el «Calendario» para ver la planificación mensual de visitas.',
                        '6. Accede a «Muestreos Completados» para revisar los resultados del trabajo en terreno.',
                        '7. El «Dashboard Operativo» te muestra la radiografía en tiempo real de la coordinación y carga de trabajo.'
                    ]
                };
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: HUB DE MEDIO AMBIENTE (Admin)
    // ─────────────────────────────────────────────────────────────────────────
    if (activeSubmodule === 'medio_ambiente') {
        return {
            title: 'Hub de Administración — Medio Ambiente',
            queEs: 'Panel de acceso a todas las herramientas del área Medio Ambiente.',
            queHace: 'Agrupa los accesos directos a Fichas de Ingreso, Muestreadores, Equipos e informes del área Medio Ambiente.',
            comoFunciona: [
                '1. Haz clic en la tarjeta «Fichas de Ingreso» para gestionar el ciclo completo de muestreos.',
                '2. Accede a «Muestreadores» para administrar el personal de terreno del área.',
                '3. Entra a «Equipos» para controlar el estado de calibración del instrumental.',
                '4. Navega entre las secciones usando el menú lateral o las tarjetas de acceso rápido.',
                '5. Para volver al menú principal de Administración, usa el botón «Atrás».'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: HUB DE GESTIÓN DE CALIDAD (Admin)
    // ─────────────────────────────────────────────────────────────────────────
    if (activeSubmodule === 'gestion_calidad') {
        return {
            title: 'Hub de Administración — Gestión de Calidad',
            queEs: 'Panel de acceso a las herramientas del área de Gestión de Calidad.',
            queHace: 'Centraliza el control de los equipos de medición: inventario, indicadores, vencimientos y verificaciones de temperatura.',
            comoFunciona: [
                '1. «Gestión de Equipos»: inventario, edición, historial y carga desde Excel.',
                '2. «Dashboard de Equipos»: indicadores y gráficos del estado del inventario.',
                '3. «Calendario de Vencimientos»: en qué día vence la revisión de cada equipo.',
                '4. «Verificación de Temperatura»: fichas OI-FoGe-39 con lecturas, cálculo y firma.',
                '5. Para volver al menú principal de Administración, usa «Volver».'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: GEM — Muestreos Completados
    // ─────────────────────────────────────────────────────────────────────────
    if (activeSubmodule === 'gem-muestreos-completados') {
        return {
            title: 'Muestreos Completados (GEM)',
            queEs: 'Bandeja de recepción de muestras patológicas del módulo GEM (Gestión de Estudios de Mar).',
            queHace: 'Permite visualizar y controlar las muestras ingresadas por el laboratorio biológico, con flujos y filtros adaptados a análisis de patología acuática.',
            comoFunciona: [
                '1. La tabla muestra todas las muestras GEM recibidas con su estado de análisis.',
                '2. Usa los filtros superiores para buscar por diagnóstico, especie, fecha o estado.',
                '3. Haz clic en una fila para abrir el detalle clínico completo de la muestra.',
                '4. En el detalle verás el diagnóstico preliminar, imágenes histológicas y análisis de laboratorio.',
                '5. El área técnica puede agregar resultados y cambiar el estado de análisis desde la vista de detalle.',
                '6. Usa el botón «Exportar» para generar informes en formato PDF o Excel.'
            ],
            tips: [
                'Los estados de análisis siguen el flujo: Recibida → En Análisis → Con Resultado → Entregada al Cliente.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: REMUESTREO
    // ─────────────────────────────────────────────────────────────────────────
    if (activeSubmodule === 'ma-remuestreo') {
        return {
            title: 'Solicitud de Remuestreo',
            queEs: 'Módulo para solicitar la repetición de un muestreo que presentó inconvenientes o resultados insatisfactorios.',
            queHace: 'Genera una nueva ficha vinculada a la ficha original, indicando el motivo del remuestreo y las condiciones a corregir.',
            comoFunciona: [
                '1. El remuestreo se solicita desde el detalle de una ficha ya completada.',
                '2. Selecciona el motivo del remuestreo (Muestra deteriorada, Error de procedimiento, etc.).',
                '3. Indica los parámetros específicos que deben re-medirse.',
                '4. Agrega las observaciones técnicas que el muestreador debe tomar en cuenta.',
                '5. Presiona «Confirmar Remuestreo» para generar la nueva ficha vinculada.',
                '6. La nueva ficha aparecerá en el Explorador de Fichas con referencia a la ficha original.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: CALENDARIO RÉPLICA
    // ─────────────────────────────────────────────────────────────────────────
    if (activeSubmodule === 'ma-calendario-replica') {
        return {
            title: 'Calendario de Terreno — Vista Extendida',
            queEs: 'Vista de calendario en pantalla completa con funcionalidades avanzadas de planificación.',
            queHace: 'Proporciona una vista ampliada del calendario de terreno con opciones adicionales de filtrado y gestión de eventos.',
            comoFunciona: [
                '1. Navega entre los meses usando las flechas de navegación.',
                '2. Filtra los eventos por muestreador usando el selector superior.',
                '3. Haz clic en un evento para ver el detalle de la asignación.',
                '4. Arrastra y suelta eventos para reagendar visitas (Drag & Drop).',
                '5. Usa el botón «Hoy» para volver rápidamente a la fecha actual.'
            ]
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: DETALLE DE EJECUCIÓN (Muestreos Completados)
    // ─────────────────────────────────────────────────────────────────────────
    if (activeSubmodule === 'ma-ficha-detalle') {
        return {
            title: 'Detalle de Ejecución del Muestreo',
            queEs: 'Vista completa del registro técnico de un muestreo ejecutado en terreno.',
            queHace: 'Muestra toda la información recopilada por el muestreador durante la visita: equipos usados, datos de campo, análisis de laboratorio, fotografías, firmas y documentos generados.',
            comoFunciona: [
                '1. CABECERA: Muestra el número de caso (ID), correlativo, empresa, centro, coordenadas GPS y fechas de inicio/término del muestreo.',
                '2. PESTAÑA «DATOS INGRESADOS»: Contiene 5 sub-pestañas con toda la información técnica del muestreo:',
                '   — EQUIPOS: Lista los instrumentos de medición usados en la Instalación y en el Retiro, junto con las condiciones (flujo laminar, velocidad uniforme) y observaciones técnicas.',
                '   — DATOS: Muestra los valores medidos en campo divididos en Instalación (fecha, hora, temperatura, pH, totalizador de inicio) y Retiro (mismas variables al cierre). Para muestreos Compuestos incluye también los Datos Compuestos y el VDD (m³/h).',
                '   — ANÁLISIS: Separados en «Análisis de Terreno» (parámetros medidos in situ como pH, temperatura, O₂) y «Análisis de Laboratorio» (parámetros que se analizan en laboratorio externo, con el laboratorio asignado).',
                '   — FOTOS: Galería de fotografías tomadas durante el muestreo. Haz clic en una imagen para verla ampliada.',
                '   — FIRMAS: Registros digitales de firma del muestreador y del representante del cliente que aceptó la visita.',
                '3. PESTAÑA «DOCUMENTOS»: Lista los documentos oficiales generados (actas, informes, certificados). Cada documento puede reenviarse por email usando el ícono de sobre (✉), ingresando el destinatario y un CC opcional.',
                '4. BOTÓN «EXPORTAR PDF»: Descarga la ficha completa en formato PDF oficial con todos los datos del muestreo.',
                '5. BOTÓN «REMUESTREO»: Visible para usuarios con permiso MA_COMERCIAL_REMUESTREAR. Inicia el proceso de solicitar un nuevo muestreo para el mismo punto.',
                '6. BOTÓN «INFORMACIÓN»: Abre esta ventana de ayuda contextual.',
                '7. BOTÓN «← Atrás»: Vuelve al listado de Muestreos Completados sin perder los filtros.'
            ],
            tips: [
                'Los valores de la columna UF (Unidades Fiscalizables) en las tablas de análisis solo son visibles para usuarios con permiso especial «FI_EXP_VER_UF».',
                'Para reenviar un documento por email, haz clic en el ícono ✉ del documento, ingresa el correo destino y opcionalmente un CC. El sistema enviará el documento desde la dirección oficial de ADL.',
                'Si el estado de la ficha aparece como RECHAZADA, el botón «Exportar PDF» se volverá rojo como advertencia visual.',
                'Los usuarios GEM con permiso «GEM_REALIZADO» verán un interruptor adicional en la cabecera para marcar el muestreo como «Realizado por GEM». Esta acción es irreversible y queda registrada con nombre y fecha.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: GESTIÓN DE EQUIPOS (Calidad)
    // ─────────────────────────────────────────────────────────────────────────
    if (activeSubmodule === 'admin-equipos-gestion') {
        return {
            title: 'Gestión de Equipos de Medición',
            queEs: 'Inventario y control de vigencia del instrumental de terreno y laboratorio (inventario OI-FoGe-21).',
            queHace: 'Permite registrar, editar, activar/desactivar y supervisar los equipos de medición, cargar el inventario y el resumen de temperaturas desde Excel, y llevar el historial de versiones de cada equipo con su documento de revisión.',
            comoFunciona: [
                '1. FILTROS RÁPIDOS sobre la tabla (cada uno muestra cuántos equipos cumplen):',
                '   • Por vencer: equipos activos cuya siguiente revisión vence en los próximos 30 días.',
                '   • Vencidos: equipos cuya siguiente revisión ya pasó y siguen siendo del parque (no dados de baja ni fuera de servicio).',
                '   • Muestreador inactivo: equipos asignados a un muestreador que está inhabilitado.',
                '   • Activos: solo los equipos habilitados.',
                '2. FILTROS Y ORDEN: filtra por Tipo, Sede, Estado y Responsable, y ordena por vencimiento (próximo primero), nombre, activos primero o últimas modificaciones. «Limpiar todo» quita los filtros.',
                '3. COLUMNA ALERTA (⚠️): el equipo tiene una solicitud ACEPTADA lista para ejecutarse (traspaso, baja, extensión de vigencia…). Haz clic en el ícono para abrirla.',
                '4. NUEVO EQUIPO: botón de la cabecera. El formulario tiene Información General, Configuración Técnica, Verificación y Estado, Datos del Inventario (marca, modelo, N° de serie, influencia significativa y justificación), Compra y Baja, y el documento de la revisión.',
                '5. ACCIONES de cada fila (menú ⋮): Ver documento, Editar y Activar/Desactivar. Cada edición guarda una versión en el historial, que se puede comparar o restaurar desde el formulario.',
                '6. SUBIR Y ANALIZAR EXCEL: sube el Inventario (OI-FoGe-21) o el Resumen de verificaciones T°; el sistema detecta cuál es y lo compara con lo registrado. Verás cuáles coinciden, cuáles difieren y cuáles no existen, con una vista dividida para revisar cada uno y actualizarlo o crearlo. Las fechas del Excel tienen prioridad, aunque sean más antiguas.',
                '7. EXPORTAR: descarga el inventario filtrado en Excel con una hoja de reportes.',
                '8. OBSERVACIÓN: al salir del campo, las líneas con fecha (00.00.0000, 00-00-0000, 00/00/0000 o «16 de octubre de 2023») se ordenan de la más antigua a la más nueva.'
            ],
            tips: [
                'Todos los días el sistema inactiva los equipos cuya siguiente revisión venció y vuelve a activar los que se renovaron con una fecha válida (siguiente revisión de hoy en adelante).',
                'Gestión de Calidad recibe avisos en Notificaciones cuando un equipo está a 30 días y a 7 días de vencer; al tocar el aviso se abre el Calendario de Vencimientos.',
                'Si ves la etiqueta roja «Inactivo» junto al responsable, asigna el equipo a otro muestreador activo lo antes posible.',
                'Un equipo inactivo no puede asignarse a muestreos. Actívalo solo cuando su revisión esté vigente.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: DASHBOARD DE EQUIPOS (Calidad)
    // ─────────────────────────────────────────────────────────────────────────
    if (activeSubmodule === 'gc-dashboard-equipos') {
        return {
            title: 'Dashboard de Equipos',
            queEs: 'Resumen gráfico del estado del inventario de equipos de medición.',
            queHace: 'Muestra en un solo panel cuántos equipos hay, cuáles están vencidos o por vencer, cómo se reparten por tipo y sede, y la calidad de sus verificaciones (errores y factor de corrección). Los datos vienen calculados desde el servidor.',
            comoFunciona: [
                '1. INDICADORES superiores: Total Equipos, Activos, Vencidos, Por Vencer (30 días) y Sin Asignar.',
                '2. ESTADO GENERAL y ESTADO DE VIGENCIA: reparto entre vigente, por vencer, vencido, sin fecha y retirado (dados de baja o fuera de servicio).',
                '3. VENCIMIENTOS POR MES y PRÓXIMOS A VENCER: qué viene en los próximos meses, sin contar los retirados.',
                '4. VENCIDOS POR TIPO, SIN ASIGNAR POR SEDE, EQUIPOS POR TIPO y POR SEDE: dónde se concentran los problemas.',
                '5. FACTOR DE CORRECCIÓN, ERROR PROMEDIO POR TIPO y TRAZABILIDAD FC: resultados de las verificaciones de temperatura.',
                '6. EQUIPOS POR AÑO DE COMPRA y CICLO DE VERIFICACIÓN: antigüedad del parque y frecuencia de revisión.'
            ],
            tips: [
                'Para corregir un equipo, entra a Gestión de Equipos; este panel es solo de consulta.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: CALENDARIO DE VENCIMIENTOS (Calidad)
    // ─────────────────────────────────────────────────────────────────────────
    if (activeSubmodule === 'gc-calendario-vencimientos') {
        return {
            title: 'Calendario de Vencimientos',
            queEs: 'Calendario con la fecha en que vence la revisión de cada equipo.',
            queHace: 'Ubica cada equipo en el día de su siguiente revisión y lo colorea según su estado, para planificar las verificaciones y calibraciones del mes.',
            comoFunciona: [
                '1. Cada equipo aparece en el día en que vence su siguiente revisión.',
                '2. Colores: Vencido, Por vencer (30 días o menos), Vigente y Sin fecha. Los dados de baja y fuera de servicio no se muestran.',
                '3. Navega entre meses con las flechas.',
                '4. Haz clic en un día para ver sus equipos con tipo, ubicación, técnico, última verificación, plazo de vigencia y estado.'
            ],
            tips: [
                'Los avisos de vencimiento (30 y 7 días antes) que llegan a Notificaciones abren directamente este calendario.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: VERIFICACIÓN DE TEMPERATURA (Calidad) — OI-FoGe-39
    // ─────────────────────────────────────────────────────────────────────────
    if (activeSubmodule === 'gc-verificacion-temperatura') {
        return {
            title: 'Verificación de Temperatura (OI-FoGe-39)',
            queEs: 'Formulario digital OI-FoGe-39 de verificación intermedia de temperatura de los equipos que miden temperatura.',
            queHace: 'Reemplaza la planilla Excel: crea una ficha por equipo y periodo, registra las 15 lecturas contra el termómetro patrón, calcula el error y si cumple (±0,5 °C), y al firmar guarda el PDF en el equipo y actualiza su revisión.',
            comoFunciona: [
                '1. CREAR FICHAS: elige periodo y sede y marca los equipos. Los dados de baja aparecen al final con la etiqueta «Dado de baja».',
                '2. LLENAR: abre una ficha con «Llenar». Para llenar varios equipos a la vez, marca sus casillas en la lista y presiona «Llenar a la vez»: se abren lado a lado (hasta 6).',
                '3. ANTECEDENTES: el patrón se elige solo según la sede y trae marca, modelo, N° de serie, fecha de calibración y empresa. La máxima división es siempre 5 y no se modifica.',
                '4. LECTURAS: escribe la temperatura del patrón (TP) y presiona Enter. En ese momento se marca la hora y la TP queda bloqueada (🔒); Enter salta a la siguiente TP. Luego anota la TC (temperatura del equipo). Si te equivocas en una TP, bórrala con la × y escríbela de nuevo.',
                '5. OBSERVACIÓN: al completar las 15 lecturas se agrega la fecha («- dd/mm/aaaa»), que no se puede borrar, y hay que escribir la observación a continuación. Es obligatoria.',
                '6. FIRMAR: cada ficha tiene su botón «Firmar» (celular por QR, firma en pantalla o firma registrada). Al firmar, esa ficha queda «Firmada» y bloqueada; las demás de la mesa siguen abiertas.',
                '7. DESCARTAR: «Descartar cambios» vuelve a lo último guardado; «Eliminar» borra una ficha en borrador sin dejar registro. Una ficha enviada a firma se anula con motivo.',
                '8. RESUMEN Y ESTADÍSTICA: la pestaña muestra cada equipo con su última verificación (error y factor de corrección a 0/15/30 °C, resultado y estado de la ficha del periodo), igual que la hoja «Resumen» de la planilla. Los gráficos (avance, resultado por sede, antigüedad, distribución del error, mayor error e historial) filtran la tabla al hacer clic, y «Exportar Excel» descarga lo que se ve.',
                '9. ERRORES DE PATRÓN: la pestaña junto a «Resumen y estadística» muestra por año la calibración y los errores de cada termómetro patrón. Solo el año vigente de cada patrón se puede corregir (lápiz); los años pasados quedan bloqueados (candado) y ningún registro se elimina. Con «Nuevo año» se carga el certificado siguiente, que viene con los datos del año anterior para corregir solo lo que cambió.'
            ],
            tips: [
                'El año más reciente de cada patrón («Vigente») es el que usan las fichas nuevas: al guardarlo, sus errores pasan al termómetro patrón.',
                'En el resumen, «dato del equipo» indica que ese equipo aún no tiene ficha en el sistema y se muestra lo registrado en su inventario.',
                'Cada TP se guarda sola al registrarla, así que no se pierde aunque cierres la ventana.',
                'Usa «Vista previa PDF» para revisar el formulario antes de firmar.',
                'Al firmar, el equipo toma los nuevos errores 0/15/30 °C, su factor de corrección y la siguiente revisión a 3 meses.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: BIOLOGÍA MOLECULAR
    // ─────────────────────────────────────────────────────────────────────────
    if (activeSubmodule === 'bm-consulta') {
        return {
            title: 'Biología Molecular',
            queEs: 'Consulta de muestras y resultados del área de Biología Molecular.',
            queHace: 'Muestra las muestras y sus resultados dentro de un rango de fechas de muestreo, con filtros por lugar de análisis, resultado y centro.',
            comoFunciona: [
                '1. Al entrar se muestran los últimos 30 días.',
                '2. Cambia el rango con «Fecha desde» y «Fecha hasta» (fecha de muestreo) y filtra por lugar de análisis, resultado y centro.',
                '3. «Limpiar filtros» vuelve a la consulta inicial; «Volver a consultar» trae los datos de nuevo.'
            ],
            tips: [
                'Los resultados se guardan 10 minutos y se comparten entre usuarios: si alguien acaba de consultar el mismo rango, la respuesta es inmediata. Un rango más corto también responde más rápido.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: HOY EN VIVO (Medio Ambiente)
    // ─────────────────────────────────────────────────────────────────────────
    if (activeSubmodule === 'ma-hoy-en-vivo') {
        return {
            title: 'Hoy en Vivo',
            queEs: 'Seguimiento en tiempo real de los muestreadores en terreno.',
            queHace: 'Muestra en el mapa la última posición que envía la app de cada muestreador con jornada iniciada y cuántos están en terreno, en pausa, finalizados o sin señal.',
            comoFunciona: [
                '1. La vista «Hoy» muestra los indicadores En terreno, En pausa, Finalizados y Sin señal, y el mapa con la última posición de cada muestreador.',
                '2. Las posiciones se actualizan solas mientras la app del muestreador esté enviando su ubicación; «Sin señal» indica que dejó de enviarla.',
                '3. Selecciona un muestreador para ubicarlo en el mapa.',
                '4. La vista «Historial» muestra las jornadas de días anteriores.'
            ],
            tips: [
                'El historial de posiciones GPS se conserva 30 días y luego se elimina automáticamente.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: SOLICITUDES DE CLIENTES (portal ADL WEB GO)
    // ─────────────────────────────────────────────────────────────────────────
    if (activeSubmodule === 'solicitudes-clientes' || activeModule === 'solicitudes-clientes') {
        return {
            title: 'Solicitudes de Clientes',
            queEs: 'Bandeja de lo que los clientes piden desde su portal (ADL WEB GO).',
            queHace: 'Reúne las solicitudes de las empresas que tienes asignadas para que las tomes, converses con el cliente y les des seguimiento. La bandeja se actualiza sola.',
            comoFunciona: [
                '1. Usa los filtros rápidos «Por atender» (pendientes) y «Sin tomar» (aún sin responsable), y filtra por empresa, área, estado o busca por texto.',
                '2. Selecciona una solicitud para ver la conversación con el cliente.',
                '3. «Tomar» la deja a tu cargo, para que el resto sepa quién la atiende.',
                '4. Escribe tu respuesta y envíala con el botón o con Ctrl + Enter.'
            ],
            tips: [
                'Solo ves las empresas que tienes asignadas. Las asignaciones se configuran en Informática → Solicitudes de clientes.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: GESTIÓN DE MUESTREADORES (Calidad)
    // ─────────────────────────────────────────────────────────────────────────
    if (activeSubmodule === 'admin-muestreadores') {
        return {
            title: 'Gestión de Muestreadores',
            queEs: 'Control de acreditaciones, licencias y perfiles del personal de terreno.',
            queHace: 'Verifica y resguarda las credenciales técnicas, licencias y documentación obligatoria de todos los muestreadores activos.',
            comoFunciona: [
                '1. La tabla muestra todos los muestreadores registrados con sus licencias y estado de acreditación.',
                '2. Haz clic en un muestreador para ver su perfil completo: cursos aprobados, certificados, firma digital y datos de contacto.',
                '3. Para agregar o renovar una licencia, entra al perfil y usa el botón «Agregar Certificado».',
                '4. Sube el archivo PDF del certificado arrastrándolo al recuadro o buscándolo en el PC.',
                '5. Presiona «Nuevo Muestreador» para crear un nuevo perfil: ingresa nombre, RUT, correo electrónico de acceso y cargo.',
                '6. Asigna al nuevo muestreador un rol de sistema desde el módulo de Usuarios para que pueda iniciar sesión.',
                '7. Descarga la firma digital del muestreador para usarla en informes si es necesario.'
            ],
            tips: [
                'Mantén actualizados los documentos del personal para evitar que un muestreador quede bloqueado por acreditación vencida.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: ADMINISTRACIÓN — USUARIOS
    // ─────────────────────────────────────────────────────────────────────────
    if (activeModule === 'admin_informacion' && activeSubmodule === 'admin-users') {
        return {
            title: 'Administración de Usuarios',
            queEs: 'Panel de control de cuentas de acceso del personal al sistema.',
            queHace: 'Permite crear nuevos usuarios, asignarles roles, gestionar estados activos/inactivos y administrar credenciales de acceso.',
            comoFunciona: [
                '1. La tabla muestra todos los usuarios del sistema con su nombre, correo, rol y estado.',
                '2. Usa el buscador o filtros para encontrar un usuario específico.',
                '3. Para crear un usuario: haz clic en «Nuevo Usuario» e ingresa Nombre, Apellido, Correo y Rol.',
                '4. CONTRASEÑA: al crear el usuario escribes su contraseña inicial en el formulario. Entrégasela por un medio seguro y pídele que la cambie desde Mi Perfil.',
                '5. Para editar un usuario existente, haz clic en el ícono de «Lápiz» en su fila.',
                '6. Para desactivar un usuario que ya no trabaja en la empresa, cambia su estado a «Inactivo» usando el switch de estado.',
                '7. IMPORTANTE: No modificar contraseñas ni correos de los usuarios del área informática: «vremolcoy», «frehbein» y «rdiaz».'
            ],
            tips: [
                'Un usuario inactivo no puede iniciar sesión pero conserva su historial de actividad.',
                'Asegúrate de asignar el rol correcto al crear el usuario para que tenga acceso a los módulos correspondientes.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: ADMINISTRACIÓN — ROLES
    // ─────────────────────────────────────────────────────────────────────────
    if (activeModule === 'admin_informacion' && activeSubmodule === 'admin-roles') {
        return {
            title: 'Gestión de Roles y Permisos',
            queEs: 'Configurador de privilegios y perfiles de seguridad del sistema.',
            queHace: 'Define qué acciones puede realizar cada tipo de usuario (rol) en el sistema, controlando el acceso a módulos, datos y funcionalidades.',
            comoFunciona: [
                '1. La lista muestra todos los roles disponibles (ej. Coordinador MA, Muestreador, Administrador, etc.).',
                '2. Haz clic en un rol para ver el listado completo de permisos asociados.',
                '3. Marca o desmarca casillas para activar o desactivar permisos específicos de ese rol.',
                '4. Presiona «Guardar Cambios» para aplicar las modificaciones.',
                '5. Para crear un nuevo rol personalizado, usa el botón «Nuevo Rol» e ingresa su nombre y permisos.',
                '6. Para asignar un rol a un usuario, ve al módulo de Usuarios y edita el usuario correspondiente.'
            ],
            tips: [
                'Sé conservador al asignar permisos: otorga solo lo que el rol realmente necesita para operar.',
                'Cambiar los permisos de un rol afecta a TODOS los usuarios que tengan ese rol asignado.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: ADMINISTRACIÓN — NOTIFICACIONES ADMIN
    // ─────────────────────────────────────────────────────────────────────────
    if (activeModule === 'admin_informacion' && activeSubmodule === 'admin-notifications') {
        return {
            title: 'Administración de Notificaciones',
            queEs: 'Panel de configuración del sistema de notificaciones automáticas.',
            queHace: 'Permite configurar qué eventos del sistema generan notificaciones, a quiénes se envían y por qué canales (en plataforma, correo electrónico).',
            comoFunciona: [
                '1. La lista muestra todos los tipos de notificaciones configurables del sistema.',
                '2. Para cada tipo, puedes activar/desactivar el canal: en plataforma o correo electrónico.',
                '3. Define los destinatarios de cada notificación (por rol, área o usuario específico).',
                '4. Guarda los cambios con el botón «Actualizar Configuración».',
                '5. Los cambios se aplican de forma inmediata para los próximos eventos generados.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: ADMINISTRACIÓN — URS ADMIN
    // ─────────────────────────────────────────────────────────────────────────
    if (activeModule === 'admin_informacion' && activeSubmodule === 'admin-urs') {
        return {
            title: 'Administración de Solicitudes (URS)',
            queEs: 'Panel de configuración y supervisión del módulo de solicitudes Universal (URS).',
            queHace: 'Permite administrar las categorías, tipos y flujos de solicitudes, y supervisar el estado global de todas las solicitudes del sistema.',
            comoFunciona: [
                '1. Revisa el resumen de todas las solicitudes del sistema agrupadas por estado.',
                '2. Configura las categorías y tipos de solicitud disponibles para los usuarios.',
                '3. Asigna responsables de respuesta por tipo de solicitud.',
                '4. Establece los plazos de respuesta (SLA) para cada categoría.',
                '5. Exporta reportes de cumplimiento y tiempos de atención.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: ADMINISTRACIÓN — MENÚ WEB
    // ─────────────────────────────────────────────────────────────────────────
    if (activeModule === 'admin_informacion' && activeSubmodule === 'admin-menu-web') {
        return {
            title: 'Administración del Menú Web',
            queEs: 'Editor de la estructura de navegación del sistema.',
            queHace: 'Permite personalizar los ítems del menú lateral: crear nuevos módulos dinámicos, reordenarlos, activarlos/desactivarlos o asignarlos a roles específicos.',
            comoFunciona: [
                '1. La lista muestra todos los ítems del menú lateral activos y sus configuraciones.',
                '2. Para agregar un nuevo ítem de menú, haz clic en «Nuevo Ítem» e ingresa nombre, ícono y módulo asociado.',
                '3. Para reordenar, arrastra los ítems usando el ícono de «Mango» (líneas horizontales) a su posición deseada.',
                '4. Para ocultar un ítem de menú sin eliminarlo, desactiva el switch de estado.',
                '5. Asigna a qué roles o usuarios es visible cada ítem de menú.',
                '6. Guarda los cambios con el botón «Guardar Estructura».'
            ],
            tips: [
                'Los cambios en el menú se reflejan de forma inmediata para los usuarios que inicien sesión nuevamente.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: ADMINISTRACIÓN — MAESTROS
    // ─────────────────────────────────────────────────────────────────────────
    if (activeModule === 'admin_informacion' && activeSubmodule === 'admin-maestros') {
        return {
            title: 'Administración de Maestros',
            queEs: 'Tablas maestras y catálogos de configuración del sistema.',
            queHace: 'Administra las listas de valores base que se usan en todo el sistema: tipos de ficha, parámetros de análisis, clientes, centros de cultivo, especies, etc.',
            comoFunciona: [
                '1. Selecciona la categoría de maestro que deseas administrar (ej. Clientes, Parámetros, Tipos de Ficha).',
                '2. La tabla muestra todos los valores registrados en esa categoría.',
                '3. Haz clic en «Nuevo» para agregar un valor al catálogo, completando los campos requeridos.',
                '4. Para editar, usa el ícono de «Lápiz» en la fila correspondiente.',
                '5. Para desactivar un valor sin eliminarlo (para mantener historial), cambia su estado a «Inactivo».',
                '6. Los cambios en maestros afectan los desplegables y opciones disponibles en todo el sistema.'
            ],
            tips: [
                'NUNCA elimines un valor maestro que ya esté siendo usado en fichas existentes. Usa la desactivación en su lugar.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: ADMINISTRACIÓN — Revisión de duplicados
    // ─────────────────────────────────────────────────────────────────────────
    if (activeSubmodule === 'admin-revision-duplicados') {
        return {
            title: 'Revisión de Duplicados',
            queEs: 'Lista de empresas, servicios y centros que podrían estar repetidos en la base nueva.',
            queHace: 'Propone posibles duplicados para que decidas si se unen o se mantienen separados. Nada se fusiona sin tu decisión.',
            comoFunciona: [
                '1. Revisa cada par sugerido y compara sus datos (nombre, coordenadas, etc.). Puedes filtrar por criterio y por estado (pendientes, fusionados, separados).',
                '2. Si son el mismo, fusiónalos eligiendo cuál se mantiene. Si no, marca «Son distintos» y no volverán a aparecer como pendientes.',
                '3. Puedes seleccionar varios pares y resolverlos juntos. El sistema pide confirmación y una observación opcional antes de aplicar.'
            ],
            tips: [
                'Ante la duda, no fusiones: un registro unido por error afecta las fichas e informes que lo usan.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: ADMINISTRACIÓN — Solicitudes de clientes (empresas asignadas)
    // ─────────────────────────────────────────────────────────────────────────
    if (activeSubmodule === 'admin-solicitudes-clientes') {
        return {
            title: 'Solicitudes de Clientes — Asignaciones',
            queEs: 'Configuración de quién atiende las solicitudes de cada empresa cliente.',
            queHace: 'Asigna, por empresa y por área, la persona que recibe y atiende lo que esa empresa pide desde su portal.',
            comoFunciona: [
                '1. La lista muestra cada empresa con las personas asignadas por área.',
                '2. Agrega una asignación eligiendo empresa, área y persona.',
                '3. Quita una asignación con el ícono de papelera; se pide confirmación.'
            ],
            tips: [
                'Cada persona ve en su bandeja de Solicitudes de clientes solo las empresas que tiene asignadas.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: ADMINISTRACIÓN — Verificadores de solicitudes
    // ─────────────────────────────────────────────────────────────────────────
    if (activeSubmodule === 'admin-verificadores-solicitudes') {
        return {
            title: 'Verificadores de Solicitudes',
            queEs: 'Usuarios que reciben copia de todas las solicitudes de clientes.',
            queHace: 'Agrega o quita verificadores: personas que quedan informadas de todas las solicitudes, sin importar la empresa. No aprueban ni bloquean nada.',
            comoFunciona: [
                '1. La lista muestra los verificadores actuales.',
                '2. Agrega uno eligiendo el usuario.',
                '3. Quítalo con el ícono de papelera; se pide confirmación.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: USUARIOS GEM
    // ─────────────────────────────────────────────────────────────────────────
    if (activeSubmodule === 'admin-usuarios-gem') {
        return {
            title: 'Usuarios GEM',
            queEs: 'Administración de las cuentas del área GEM MaM.',
            queHace: 'Permite al jefe técnico crear y editar las cuentas de su área y definir qué empresas tiene a cargo cada una.',
            comoFunciona: [
                '1. La lista muestra las cuentas GEM con sus empresas a cargo.',
                '2. Crea o edita una cuenta con sus datos personales y su contraseña.',
                '3. Marca las empresas que esa persona atiende.',
                '4. Activa o desactiva cuentas; se pide confirmación.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: ADMINISTRACIÓN — Hub Informática
    // ─────────────────────────────────────────────────────────────────────────
    if (activeModule === 'admin_informacion' && activeSubmodule === 'informatica') {
        return {
            title: 'Hub de Informática',
            queEs: 'Centro de control técnico de la plataforma ADL One.',
            queHace: 'Proporciona accesos directos a todas las herramientas de configuración técnica del sistema: roles, usuarios, notificaciones, menús y tablas maestras.',
            comoFunciona: [
                '1. Haz clic en «Usuarios» para administrar cuentas de acceso y credenciales.',
                '2. Accede a «Roles y Permisos» para configurar los privilegios del sistema.',
                '3. Entra a «Notificaciones» para configurar qué eventos generan alertas automáticas.',
                '4. Usa «Menú Web» para personalizar la estructura de navegación de la plataforma.',
                '5. Accede a «Maestros» para administrar las listas y catálogos base del sistema.',
                '6. Estas herramientas son de uso exclusivo del área de Informática.'
            ],
            tips: [
                'Los cambios en este hub afectan el funcionamiento global de la plataforma para todos los usuarios. Actúa con cuidado.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: ADMINISTRACIÓN — Hub General (sin submodule específico)
    // ─────────────────────────────────────────────────────────────────────────
    if (activeModule === 'admin_informacion') {
        return {
            title: 'Administración e Información',
            queEs: 'Panel gerencial de configuración y supervisión del sistema.',
            queHace: 'Centraliza el acceso a las herramientas de administración de las áreas de Informática, Medio Ambiente y Gestión de Calidad.',
            comoFunciona: [
                '1. Haz clic en «Informática» para acceder a la gestión de usuarios, roles y configuración del sistema.',
                '2. Selecciona «Medio Ambiente» para administrar muestreadores y equipos del área MA.',
                '3. Entra a «Gestión de Calidad» para supervisar acreditaciones y calibraciones.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: SOLICITUDES (URS) — Nueva Solicitud
    // ─────────────────────────────────────────────────────────────────────────
    if (activeSubmodule === 'urs-new-request') {
        return {
            title: 'Crear Nueva Solicitud (URS)',
            queEs: 'Formulario de creación de una nueva solicitud de servicio o soporte.',
            queHace: 'Permite enviar requerimientos de soporte técnico, incidencias operacionales o consultas al equipo correspondiente de forma estructurada.',
            comoFunciona: [
                '1. Selecciona el «Área» destinataria de la solicitud (ej. Informática, Medio Ambiente, Calidad).',
                '2. Elige el «Tipo de Solicitud» (Incidencia, Consulta, Requerimiento de Cambio, etc.).',
                '3. Escribe un «Asunto» claro y descriptivo del problema o requerimiento.',
                '4. Detalla la situación en el campo «Descripción»: indica qué ocurrió, cuándo, en qué pantalla y cómo reproducirlo.',
                '5. Adjunta archivos relevantes (capturas de pantalla, documentos) usando el botón de adjuntos.',
                '6. Define la «Prioridad» de la solicitud (Normal, Urgente, Crítica).',
                '7. Presiona «Enviar Solicitud» para registrarla. Recibirás un número de ticket de seguimiento.'
            ],
            tips: [
                'Una descripción detallada del problema permite resolverlo más rápidamente.',
                'Para solicitudes urgentes que bloquean operaciones, contáctanos directamente por WhatsApp además de crear el ticket.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: SOLICITUDES (URS)
    // ─────────────────────────────────────────────────────────────────────────
    if (activeModule === 'solicitudes') {
        return {
            title: 'Bandeja Universal de Solicitudes (URS)',
            queEs: 'Bandeja centralizada de requerimientos, incidencias y soporte.',
            queHace: 'Recibe y procesa solicitudes entre áreas de la empresa: soporte técnico, consultas operacionales, requerimientos de cambio y coordinación entre equipos.',
            comoFunciona: [
                '1. La bandeja tiene dos pestañas: «Recibidas» (solicitudes que te enviaron) y «Enviadas» (las que tú creaste).',
                '2. Cada solicitud muestra su estado: Abierta, En Proceso, Resuelta o Cerrada.',
                '3. Haz clic en una solicitud para ver su detalle, conversación y adjuntos.',
                '4. Desde el detalle, puedes responder, cambiar el estado o escalar la solicitud.',
                '5. Para crear una nueva solicitud, presiona el botón «Nueva Solicitud» en la parte superior.',
                '6. Filtra por área, tipo o estado para encontrar solicitudes específicas.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: FACTURACIÓN
    // ─────────────────────────────────────────────────────────────────────────
    if (activeModule === 'facturacion') {
        return {
            title: 'Facturación',
            queEs: 'Módulo para preparar la facturación de los servicios de ADL.',
            queHace: 'Agrupa lo facturable en pre-facturas, arma y envía cotizaciones a los clientes, registra sus órdenes de compra y muestra el estado de cuenta de cada empresa.',
            comoFunciona: [
                '1. DASHBOARD: resumen de lo pendiente por facturar y accesos directos.',
                '2. PROCESAR: genera las pre-facturas a partir de los servicios realizados.',
                '3. PRE-FACTURAS: revisa cada pre-factura, su PDF resumen y la orden de compra asociada.',
                '4. COTIZACIONES: arma una cotización con cliente, centro y servicios del convenio. «Enviar» genera el PDF y se lo entrega al cliente en su portal (ADL WEB GO).',
                '5. ÓRDENES DE COMPRA: registra las OC que envían los clientes y revisa las que llegan desde el portal para confirmarlas o descartarlas.',
                '6. ESTADO DE CUENTA: lo facturado y pendiente por empresa.',
                '7. CONFIGURACIÓN: valores como la UF (solo administradores).'
            ],
            tips: [
                'Cada pestaña aparece solo si tu rol tiene el permiso correspondiente.',
                'Si una cotización avisa «Este centro no tiene convenio cargado» o «Hay ítems sin tarifa», completa el convenio antes de enviarla.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: CHAT
    // ─────────────────────────────────────────────────────────────────────────
    if (activeModule === 'chat') {
        return {
            title: 'Chat Interno — ADL One',
            queEs: 'Sistema de mensajería interna en tiempo real para el equipo ADL.',
            queHace: 'Facilita la comunicación directa e instantánea entre coordinadores, muestreadores, administradores y personal de laboratorio sin salir del sistema.',
            comoFunciona: [
                '1. En el panel lateral izquierdo verás tu lista de contactos disponibles (personal del sistema).',
                '2. Busca un contacto escribiendo su nombre en el buscador superior del panel de contactos.',
                '3. Haz clic en un contacto para abrir la conversación con él/ella.',
                '4. Escribe tu mensaje en la caja de texto inferior y presiona «Enviar» o la tecla Enter.',
                '5. Puedes adjuntar archivos o imágenes haciendo clic en el ícono de clip (📎) junto al campo de texto.',
                '6. Las conversaciones no leídas aparecen resaltadas en el panel de contactos.',
                '7. Puedes abrir el chat desde cualquier parte del sistema usando el ícono de chat del menú lateral.'
            ],
            tips: [
                'Usa el chat para comunicaciones rápidas. Para requerimientos formales, usa el módulo de Solicitudes (URS).'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: NOTIFICACIONES
    // ─────────────────────────────────────────────────────────────────────────
    if (activeModule === 'notificaciones') {
        return {
            title: 'Centro de Notificaciones',
            queEs: 'Historial completo de alertas y avisos automáticos del sistema.',
            queHace: 'Registra todos los avisos generados por eventos del sistema: nuevas asignaciones de fichas, validaciones, calibraciones de equipos por vencer, respuestas a solicitudes, etc.',
            comoFunciona: [
                '1. La lista muestra tus notificaciones ordenadas de más reciente a más antigua.',
                '2. Las notificaciones no leídas aparecen destacadas con un punto naranja.',
                '3. Haz clic en una notificación para ver el evento detallado y ser llevado directamente a la sección relacionada.',
                '4. Marca notificaciones como leídas haciendo clic en el check o usando «Marcar todo como leído».',
                '5. Usa los filtros por tipo para ver solo las notificaciones de una categoría.',
                '6. Las notificaciones llegan al instante, sin recargar la página.'
            ],
            tips: [
                'Gestión de Calidad recibe «Equipos por vencer (30 días)» y «Equipos por vencer (7 días)» con la lista de equipos; al tocarlas se abre el Calendario de Vencimientos.',
                'Revisa la campana regularmente para no perderte alertas importantes.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÓDULO: PERFIL
    // ─────────────────────────────────────────────────────────────────────────
    if (activeModule === 'perfil') {
        return {
            title: 'Mi Perfil de Usuario',
            queEs: 'Panel de configuración de tu cuenta personal en ADL One.',
            queHace: 'Permite actualizar tus datos de perfil, subir o cambiar tu foto de usuario, registrar tu firma digital y cambiar tu contraseña de acceso.',
            comoFunciona: [
                '1. En la sección «Datos Personales» puedes editar tu nombre, cargo y datos de contacto.',
                '2. Para cambiar tu foto de perfil, haz clic sobre la imagen actual y selecciona un archivo desde tu PC.',
                '3. Para registrar o actualizar tu firma digital, sube el archivo de imagen de tu firma en la sección correspondiente.',
                '4. Para cambiar tu contraseña: haz clic en «Cambiar Contraseña», ingresa la contraseña actual y luego la nueva (mínimo 8 caracteres).',
                '5. Presiona «Guardar Cambios» para que las modificaciones queden registradas.',
                '6. Tu foto y nombre actualizados aparecerán en el menú lateral y en los documentos generados por el sistema.'
            ],
            tips: [
                'Usa una contraseña segura: combina letras mayúsculas, minúsculas, números y símbolos.',
                'Tu firma digital debe ser una imagen clara con fondo blanco o transparente en formato PNG.'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DEFAULT: Pantalla principal / Dashboard General
    // ─────────────────────────────────────────────────────────────────────────
    return {
        title: 'ADL ONE — Portal de Gestión Integrado',
        queEs: 'Plataforma integrada de gestión de muestreos ambientales, servicios biológicos y control de calidad para ADL Diagnostic.',
        queHace: 'Centraliza en un solo sistema los módulos de Medio Ambiente (MA), GEM, Gestión de Calidad, Solicitudes (URS), Comunicación Interna y Administración del sistema.',
        comoFunciona: [
            '1. Usa la barra de navegación lateral izquierda para desplazarte entre los módulos disponibles según tu rol.',
            '2. El ícono de campana (🔔) en el menú lateral muestra tus notificaciones pendientes. Haz clic para verlas.',
            '3. El ícono de chat te permite comunicarte con otros miembros del equipo en tiempo real.',
            '4. Haz clic en tu foto de perfil (esquina inferior izquierda) para acceder a tu perfil, a la Ayuda general o cerrar sesión.',
            '5. Para recibir ayuda sobre la pantalla en la que te encuentras, presiona el botón «Información» en la cabecera de cada sección.',
            '6. Si el menú lateral está muy angosto, haz clic en el ícono de hamburguesa (☰) para expandirlo.'
        ],
        tips: [
            'Mantén actualizado tu perfil con foto y firma digital para que el sistema los use correctamente en documentos e informes.',
            'Si tienes dudas o encuentras un error, usa el módulo de Solicitudes (URS) para reportarlo al área de Informática.'
        ]
    };
};

export const HelpCenter = ({ opened, onClose }: HelpCenterProps) => {
    const { activeModule, activeSubmodule, fichasMode, helpCenterIsGlobal } = useNavStore();
    const help = getContextHelp(activeModule, activeSubmodule, fichasMode, helpCenterIsGlobal);

    return (
        <Dialog open={opened} onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="max-w-[720px] rounded-3xl">
                <DialogHeader>
                    <div className="flex items-center gap-4">
                        <IconCircle color="#1c7ed6" size={48}>
                            <IconBook2 size={24} stroke={1.5} />
                        </IconCircle>
                        <div>
                            <DialogTitle className="text-lg font-extrabold tracking-tight">
                                Centro de Ayuda
                            </DialogTitle>
                            <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                ADL ONE — Manual de Usuario
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="max-h-[72vh] overflow-y-auto pb-2 pt-2">
                    {help ? (
                        <div className="flex flex-col gap-4">

                            {/* ── Header de sección ── */}
                            <div className="flex flex-nowrap items-center gap-4">
                                <IconCircle color="#1c7ed6" size={56}>
                                    <IconInfoCircle size={28} stroke={2} />
                                </IconCircle>
                                <div className="flex-1">
                                    <span className="block text-[11px] font-extrabold uppercase tracking-wide text-primary">
                                        Módulo Activo
                                    </span>
                                    <h3 className="mt-1 text-xl font-extrabold tracking-tight text-foreground">
                                        {help.title}
                                    </h3>
                                </div>
                            </div>

                            {/* ── ¿Qué es? y ¿Qué hace? ── */}
                            <div className="mt-2 flex flex-col gap-5">
                                <div>
                                    <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-primary">
                                        ¿Qué es?
                                    </span>
                                    <p className="text-[13.5px] leading-relaxed text-foreground">{help.queEs}</p>
                                </div>

                                <div>
                                    <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-primary">
                                        ¿Qué hace?
                                    </span>
                                    <p className="text-[13.5px] leading-relaxed text-foreground">{help.queHace}</p>
                                </div>
                            </div>

                            {/* ── Paso a Paso ── */}
                            <div className="mt-2">
                                <span className="mb-3 block text-[11px] font-extrabold uppercase tracking-wide text-warning">
                                    Paso a Paso — ¿Cómo funciona?
                                </span>
                                <div className="flex flex-col gap-2">
                                    {help.comoFunciona.map((item, index) => (
                                        <div key={index} className="flex flex-nowrap items-start gap-3 rounded-2xl border border-border bg-muted/40 p-3">
                                            <IconCircle color="#e8590c" size={24}>
                                                <IconChevronRight size={14} stroke={2.5} />
                                            </IconCircle>
                                            <p className="mt-0.5 flex-1 text-[13.5px] leading-snug text-foreground">{item}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ── Consejos ── */}
                            {help.tips && help.tips.length > 0 && (
                                <div className="mt-2">
                                    <span className="mb-3 block text-[11px] font-extrabold uppercase tracking-wide text-success">
                                        Consejos útiles
                                    </span>
                                    <div className="flex flex-col gap-2">
                                        {help.tips.map((tip, index) => (
                                            <div key={index} className="flex flex-nowrap items-start gap-3 rounded-2xl border border-success/25 bg-success/10 p-3">
                                                <IconCircle color="#2f9e44" size={24}>
                                                    <IconBulb size={14} />
                                                </IconCircle>
                                                <p className="mt-0.5 flex-1 text-[13.5px] italic leading-snug text-foreground">{tip}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── Tarjetas de Contacto TI (Solo Global) ── */}
                            {helpCenterIsGlobal && (
                                <div className="mt-6">
                                    <div className="mb-4 flex items-center gap-3">
                                        <div className="h-px flex-1 bg-border" />
                                        <span className="text-[11px] font-semibold text-muted-foreground">CONTACTO SOPORTE</span>
                                        <div className="h-px flex-1 bg-border" />
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex-1 rounded-[20px] border border-border bg-muted/40 p-4 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <IconCircle color="#1c7ed6" size={40}><IconMail size={20} /></IconCircle>
                                                <div>
                                                    <span className="block text-sm font-semibold text-foreground">Correo Soporte</span>
                                                    <span className="text-[11px] text-muted-foreground">informatica@adldiagnostic.cl</span>
                                                </div>
                                                <Button variant="ghost" size="sm" className="w-full text-primary hover:text-primary" asChild>
                                                    <a href="mailto:informatica@adldiagnostic.cl">Enviar</a>
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="flex-1 rounded-[20px] border border-border bg-muted/40 p-4 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <IconCircle color="#2f9e44" size={40}><IconMessageCircle size={20} /></IconCircle>
                                                <div>
                                                    <span className="block text-sm font-semibold text-foreground">WhatsApp</span>
                                                    <span className="text-[11px] text-muted-foreground">+56 9 5721 8268</span>
                                                </div>
                                                <Button variant="ghost" size="sm" className="w-full text-success hover:text-success" asChild>
                                                    <a href="https://wa.me/56957218268" target="_blank" rel="noreferrer">Chat</a>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    ) : (
                        <div className="rounded-xl border border-border p-8 text-center">
                            <IconCircle color="#868e96" size={48}>
                                <IconBook2 size={24} />
                            </IconCircle>
                            <p className="mt-3 text-sm text-muted-foreground">
                                No hay contenido de ayuda disponible para esta sección.
                            </p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
