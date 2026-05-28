import { Modal, Stack, Group, Text, ThemeIcon, Paper, Badge, Box, List, ScrollArea, Divider, Title, rem, Button } from '@mantine/core';
import { 
    IconChevronRight,
    IconInfoCircle,
    IconListCheck,
    IconBulb,
    IconBook2,
    IconMail,
    IconMessageCircle
} from '@tabler/icons-react';
import { useNavStore } from '../../store/navStore';

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
                'Si tienes dudas o encuentras un error, comunícate con soporte.it@adl.cl o usa el módulo de Solicitudes (URS).'
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
            case 'kpi_dashboard':
                return {
                    title: 'Dashboard Inteligente de Operaciones',
                    queEs: 'Panel de análisis gráfico de indicadores clave de rendimiento (KPIs).',
                    queHace: 'Muestra estadísticas en tiempo real del volumen de fichas registradas, estados de avance, tiempos de proceso y rendimiento por muestreador o cliente.',
                    comoFunciona: [
                        '1. Observa el gráfico de torta/barras con la distribución de fichas por estado (Pendiente, Validada, Asignada, Completada).',
                        '2. El panel de totales del mes muestra cuántas fichas se ingresaron, validaron y completaron.',
                        '3. Aplica los filtros de fecha (rango de mes) para analizar un período específico.',
                        '4. Filtra por cliente para ver el rendimiento de servicio asociado a una cuenta específica.',
                        '5. El ranking de muestreadores muestra quiénes completaron más visitas en el período seleccionado.',
                        '6. Exporta los gráficos o datos usando el botón de descarga disponible en cada tarjeta.'
                    ],
                    tips: [
                        'Revisa el Dashboard al inicio de cada semana para detectar fichas que llevan mucho tiempo sin avanzar de estado.'
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
                        '7. El «Dashboard» te muestra los KPIs y estadísticas del proceso completo.'
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
            queHace: 'Centraliza el acceso a Equipos de Medición y Muestreadores bajo la supervisión del área de calidad.',
            comoFunciona: [
                '1. Haz clic en «Gestión de Equipos» para revisar y actualizar el estado de calibración del instrumental.',
                '2. Accede a «Muestreadores» para verificar acreditaciones y licencias del personal.',
                '3. Para volver al menú principal de Administración, usa el botón «Atrás».'
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
            queEs: 'Inventario y control del estado de calibración del instrumental de terreno y laboratorio.',
            queHace: 'Permite registrar, editar, activar/desactivar y supervisar los equipos de medición. Incluye un sistema de alertas automáticas para detectar calibraciones próximas a vencer y solicitudes pendientes de acción.',
            comoFunciona: [
                '1. La tabla lista todos los equipos con columnas de: Alerta, Código, Nombre, Tipo, Sede, Estado, Vigencia y Responsable.',
                '2. COLUMNA ALERTA (⚠️): Aparece un ícono de triángulo naranja cuando el equipo tiene una solicitud ACEPTADA pendiente de ejecución (ej. traspaso, baja, recalibración aprobada). Haz clic en el ícono para abrir el panel de solicitudes y procesarla.',
                '3. COLUMNA ESTADO — semáforo de colores: 🟢 Verde (punto) = Equipo Activo con calibración vigente | 🔴 Rojo (punto) = Equipo Inactivo o fuera de servicio.',
                '4. COLUMNA VIGENCIA (fecha en naranja): Cuando la fecha de calibración vence en los próximos 30 días, el texto se vuelve naranja y negrita como advertencia visual.',
                '5. Al abrir la página, si hay equipos por vencer aparece un banner naranja en la parte superior indicando cuántos. Haz clic en «Ver equipos» para filtrarlos automáticamente.',
                '6. Los equipos con alertas activas se muestran primero en la tabla (ordenados por prioridad), seguidos de los que vencen más pronto.',
                '7. Para editar un equipo: haz clic en el ícono de «Lápiz» en la columna de Acciones y actualiza sus datos (vigencia, responsable, estado).',
                '8. Para crear un nuevo equipo: presiona «Nuevo Equipo» en la cabecera e ingresa Código, Nombre, Tipo, Sede, Responsable y Fecha de Vigencia.',
                '9. Para activar o desactivar un equipo: usa el ícono de encendido (⏻) en la columna de Acciones. Te pedirá confirmar y opcionalmente ingresar una observación.'
            ],
            tips: [
                'Revisa semanalmente la columna Vigencia con el filtro de fecha hasta los próximos 30 días para anticipar recalibraciones.',
                'Si ves el ícono ⚠️ en la columna Alerta, haz clic en él: hay una solicitud ya aprobada esperando que la ejecutes (ej. actualizar vigencia, dar de baja, traspasar).',
                'Un equipo en estado Inactivo NO puede ser asignado a muestreos. Actívalo solo cuando su calibración esté vigente.',
                'Usa los filtros de Sede, Tipo y Responsable para revisar el inventario de una sucursal o área específica.'
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
                '4. REGLA CLAVE: La contraseña inicial por defecto para nuevos usuarios es «123456». El usuario debe cambiarla en su primer inicio de sesión.',
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
                '5. Usa los filtros por tipo para ver solo las notificaciones de una categoría (ej. solo fichas, solo calibraciones).',
                '6. Las notificaciones antiguas leídas se archivan automáticamente después de 30 días.'
            ],
            tips: [
                'Revisa el ícono de campana en el menú lateral regularmente para no perderte alertas importantes.'
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
            '4. Haz clic en tu foto de perfil (esquina inferior izquierda) para acceder a tu perfil o cerrar sesión.',
            '5. Para recibir ayuda sobre la pantalla en la que te encuentras, presiona el botón naranja (!) flotante en la esquina inferior derecha.',
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
        <Modal
            opened={opened}
            onClose={onClose}
            title={
                <Group gap="sm" align="center">
                    <ThemeIcon
                        variant="gradient"
                        gradient={{ from: 'orange.6', to: 'orange.4', deg: 135 }}
                        size={rem(36)}
                        radius="md"
                        style={{ boxShadow: '0 4px 12px rgba(247,103,7,0.35)' }}
                    >
                        <IconBook2 size={20} stroke={1.8} />
                    </ThemeIcon>
                    <Stack gap={0}>
                        <Title order={5} style={{ fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.1 }}>
                            Centro de Ayuda
                        </Title>
                        <Text size="xs" c="dimmed" fw={500}>ADL ONE — Manual de Usuario</Text>
                    </Stack>
                </Group>
            }
            size="lg"
            radius="lg"
            zIndex={1000}
            overlayProps={{
                backgroundOpacity: 0.45,
                blur: 4,
                zIndex: 999,
            }}
            styles={{
                header: {
                    borderBottom: '1px solid var(--mantine-color-gray-2)',
                    paddingBottom: rem(12),
                    backgroundColor: 'rgba(255,255,255,0.85)',
                    backdropFilter: 'blur(8px)',
                },
                body: {
                    backgroundColor: 'var(--mantine-color-gray-0)',
                    padding: rem(16),
                },
                content: {
                    boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
                }
            }}
        >
            <ScrollArea.Autosize mah="78vh" scrollbarSize={6} offsetScrollbars>
                {help ? (
                    <Stack gap="md">

                        {/* ── Header de sección ── */}
                        <Paper
                            radius="md"
                            p="md"
                            style={{
                                background: 'linear-gradient(135deg, #0062a8 0%, #2574d8 100%)',
                                border: 'none',
                                boxShadow: '0 4px 16px rgba(0,98,168,0.25)',
                            }}
                        >
                            <Group gap="sm" align="flex-start">
                                <ThemeIcon
                                    variant="white"
                                    size={rem(40)}
                                    radius="md"
                                    color="adl-blue"
                                    style={{ flexShrink: 0 }}
                                >
                                    <IconInfoCircle size={22} stroke={1.8} />
                                </ThemeIcon>
                                <Stack gap={2} style={{ flex: 1 }}>
                                    <Badge
                                        variant="white"
                                        color="orange"
                                        size="xs"
                                        radius="sm"
                                        fw={700}
                                        style={{ width: 'fit-content' }}
                                    >
                                        Módulo activo
                                    </Badge>
                                    <Title order={4} style={{ color: '#ffffff', fontWeight: 800, letterSpacing: '-0.02em' }}>
                                        {help.title}
                                    </Title>
                                </Stack>
                            </Group>
                        </Paper>

                        {/* ── ¿Qué es? y ¿Qué hace? ── */}
                        <Paper withBorder radius="md" p="md" style={{ backgroundColor: '#ffffff' }}>
                            <Stack gap="md">
                                <Box>
                                    <Group gap="xs" mb={rem(6)}>
                                        <ThemeIcon variant="light" color="adl-blue" size="sm" radius="sm">
                                            <IconInfoCircle size={14} />
                                        </ThemeIcon>
                                        <Text fw={700} size="sm" c="adl-blue.7">¿Qué es?</Text>
                                    </Group>
                                    <Text size="sm" c="gray.7" lh={1.6} pl={rem(28)}>
                                        {help.queEs}
                                    </Text>
                                </Box>

                                <Divider color="gray.1" />

                                <Box>
                                    <Group gap="xs" mb={rem(6)}>
                                        <ThemeIcon variant="light" color="adl-blue" size="sm" radius="sm">
                                            <IconListCheck size={14} />
                                        </ThemeIcon>
                                        <Text fw={700} size="sm" c="adl-blue.7">¿Qué hace?</Text>
                                    </Group>
                                    <Text size="sm" c="gray.7" lh={1.6} pl={rem(28)}>
                                        {help.queHace}
                                    </Text>
                                </Box>
                            </Stack>
                        </Paper>

                        {/* ── Paso a Paso ── */}
                        <Paper withBorder radius="md" p="md" style={{ backgroundColor: '#ffffff' }}>
                            <Group gap="xs" mb="sm">
                                <ThemeIcon variant="light" color="orange" size="sm" radius="sm">
                                    <IconListCheck size={14} />
                                </ThemeIcon>
                                <Text fw={700} size="sm" c="orange.8">Paso a Paso — ¿Cómo funciona?</Text>
                            </Group>
                            <Stack gap={rem(6)} pl={rem(4)}>
                                {help.comoFunciona.map((item, index) => (
                                    <Group key={index} gap="xs" align="flex-start" wrap="nowrap">
                                        <ThemeIcon
                                            variant="gradient"
                                            gradient={{ from: 'orange.5', to: 'orange.3', deg: 135 }}
                                            size={rem(22)}
                                            radius="sm"
                                            style={{ flexShrink: 0, marginTop: rem(2) }}
                                        >
                                            <IconChevronRight size={12} stroke={2.5} />
                                        </ThemeIcon>
                                        <Text size="sm" c="gray.7" lh={1.55} style={{ flex: 1 }}>
                                            {item}
                                        </Text>
                                    </Group>
                                ))}
                            </Stack>
                        </Paper>

                        {/* ── Consejos ── */}
                        {help.tips && help.tips.length > 0 && (
                            <Paper
                                withBorder
                                radius="md"
                                p="md"
                                style={{
                                    backgroundColor: '#fffbf0',
                                    borderColor: 'var(--mantine-color-yellow-3)',
                                    borderLeft: `4px solid var(--mantine-color-orange-5)`,
                                }}
                            >
                                <Group gap="xs" mb="sm">
                                    <ThemeIcon variant="light" color="yellow" size="sm" radius="sm">
                                        <IconBulb size={14} />
                                    </ThemeIcon>
                                    <Text fw={700} size="sm" c="orange.8">Consejos útiles</Text>
                                </Group>
                                <List
                                    size="sm"
                                    c="gray.7"
                                    spacing={rem(6)}
                                    center
                                    icon={
                                        <ThemeIcon color="orange" size={rem(18)} radius="xl" variant="light">
                                            <IconBulb size={11} />
                                        </ThemeIcon>
                                    }
                                >
                                    {help.tips.map((tip, index) => (
                                        <List.Item key={index} style={{ fontStyle: 'italic', lineHeight: 1.55 }}>
                                            {tip}
                                        </List.Item>
                                    ))}
                                </List>
                            </Paper>
                        )}
                        
                        {/* ── Tarjetas de Contacto TI (Solo Global) ── */}
                        {helpCenterIsGlobal && (
                            <>
                                <Divider label="Contacto Soporte Informático" labelPosition="center" my="sm" />
                                <Group grow>
                                    <Paper withBorder p="md" radius="md" style={{ textAlign: 'center' }} shadow="sm">
                                        <Stack align="center" gap="xs">
                                            <ThemeIcon size={40} radius="xl" color="blue" variant="light">
                                                <IconMail size={24} />
                                            </ThemeIcon>
                                            <Text fw={600} size="sm">Correo Soporte</Text>
                                            <Text size="xs" c="dimmed">informatica@adldiagnostic.cl</Text>
                                            <Button variant="subtle" size="compact-xs" component="a" href="mailto:informatica@adldiagnostic.cl">
                                                Enviar Correo
                                            </Button>
                                        </Stack>
                                    </Paper>

                                    <Paper withBorder p="md" radius="md" style={{ textAlign: 'center' }} shadow="sm">
                                        <Stack align="center" gap="xs">
                                            <ThemeIcon size={40} radius="xl" color="green" variant="light">
                                                <IconMessageCircle size={24} />
                                            </ThemeIcon>
                                            <Text fw={600} size="sm">WhatsApp</Text>
                                            <Text size="xs" c="dimmed">+56 9 5721 8268</Text>
                                            <Button variant="subtle" size="compact-xs" color="green" component="a" href="https://wa.me/56957218268" target="_blank">
                                                Abrir Chat
                                            </Button>
                                        </Stack>
                                    </Paper>
                                </Group>
                            </>
                        )}

                    </Stack>
                ) : (
                    <Paper withBorder radius="md" p="xl" ta="center">
                        <ThemeIcon variant="light" color="gray" size="xl" radius="xl" mx="auto" mb="sm">
                            <IconBook2 size={24} />
                        </ThemeIcon>
                        <Text c="dimmed" size="sm">
                            No hay contenido de ayuda disponible para esta sección.
                        </Text>
                    </Paper>
                )}
            </ScrollArea.Autosize>
        </Modal>
    );
};
