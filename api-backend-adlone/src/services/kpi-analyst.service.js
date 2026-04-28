import { getConnection } from '../config/database.js';
import ExcelJS from 'exceljs';
import kpiAnalystConfig from '../config/kpi-analyst.config.js';
import logger from '../utils/logger.js';
import { analyzeExcelBufferAdvanced } from './excel-analyst.service.js';

const cache = {
    snapshot: null,
    lastRunAt: null,
    running: false,
    lastError: null,
    lastEvent: null,
    history: [],
};

const FALLBACK_CLIENTS = [
    'Salmones del Sur',
    'Industria Costera',
    'Aqua Norte',
    'Pesquera Austral',
    'Alimentos Pacifico',
];

const FALLBACK_STATUS = [
    'Pendiente Programar',
    'En Proceso',
    'Ejecutado',
    'Ejecutado',
    'En Proceso',
    'Cancelado',
];

const FALLBACK_OBJECTIVES = [
    'Cumplimiento RCA',
    'Autocontrol',
    'Fiscalizacion',
    'Seguimiento operacional',
];

const FALLBACK_SUBAREAS = [
    'Riles',
    'Aguas',
    'Emisiones',
    'Residuos',
];

const FALLBACK_ANALYSIS_TYPES = ['Laboratorio', 'Terreno', 'Mixto'];

const normalize = (value) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

const round = (value, digits = 1) => {
    if (!Number.isFinite(value)) {
        return 0;
    }
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

const safeDate = (value) => {
    if (!value) {
        return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed;
};

const getMonthKey = (value) => {
    const date = safeDate(value);
    if (!date) {
        return null;
    }

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthLabel = (monthKey) => {
    if (!monthKey) {
        return '';
    }

    const [year, month] = monthKey.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('es-CL', {
        month: 'short',
        year: '2-digit',
    });
};

const getSeverity = (score) => {
    if (score >= kpiAnalystConfig.priorities.criticalThreshold) {
        return 'critical';
    }
    if (score >= kpiAnalystConfig.priorities.warningThreshold) {
        return 'warning';
    }
    return 'normal';
};

const toCard = (id, title, value, helper, tone = 'blue') => ({
    id,
    title,
    value,
    helper,
    tone,
});

const withHelp = (widget, what, why) => ({
    ...widget,
    help: {
        what,
        why,
    },
});

const buildFallbackDataset = (windowDays) => {
    const now = new Date();
    const rows = [];

    for (let index = 0; index < 72; index += 1) {
        const offsetDays = Math.floor((windowDays / 72) * index);
        const fecha = new Date(now.getTime() - offsetDays * 24 * 60 * 60 * 1000);
        const estado = FALLBACK_STATUS[index % FALLBACK_STATUS.length];
        const cliente = FALLBACK_CLIENTS[index % FALLBACK_CLIENTS.length];
        const tipoAnalisis = FALLBACK_ANALYSIS_TYPES[index % FALLBACK_ANALYSIS_TYPES.length];
        const objetivo = FALLBACK_OBJECTIVES[index % FALLBACK_OBJECTIVES.length];
        const subarea = FALLBACK_SUBAREAS[index % FALLBACK_SUBAREAS.length];
        const isEtfa = index % 3 === 0;
        const consumo = 45 + (index % 12) * 8;
        const emisiones = 18 + (index % 10) * 4 + (estado === 'Cancelado' ? 12 : 0);
        const errors = estado === 'Cancelado' ? 2 : estado === 'En Proceso' ? 1 : 0;

        rows.push({
            id_ficha: 1000 + index,
            frecuencia_correlativo: `FB-${1000 + index}-${index + 1}`,
            fecha_servicio: fecha.toISOString(),
            fecha_creacion: new Date(fecha.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            frecuencia: 1 + (index % 4),
            estado_operacion: estado,
            estado_ficha: estado === 'Cancelado' ? 'CANCELADA' : estado === 'Ejecutado' ? 'CERRADA' : 'VIGENTE',
            id_validaciontecnica: estado === 'Ejecutado' ? 5 : estado === 'Cancelado' ? 6 : 3,
            cliente,
            empresa_servicio: cliente,
            centro: `Centro ${1 + (index % 9)}`,
            objetivo,
            subarea,
            lugar_analisis: index % 2 === 0 ? 'Laboratorio' : 'Terreno',
            muestreador: `Muestreador ${1 + (index % 7)}`,
            tipo_analisis: tipoAnalisis,
            tipo_muestra: index % 2 === 0 ? 'Liquido' : 'Solido',
            laboratorio: isEtfa ? 'ETFA Externo' : 'Laboratorio ADL',
            es_etfa: isEtfa ? 'S' : 'N',
            consumo_indice: consumo,
            emisiones_indice: emisiones,
            error_count: errors,
            total_analisis: tipoAnalisis === 'Mixto' ? 3 : 2,
        });
    }

    return rows;
};

const fetchDataset = async (windowDays) => {
    const pool = await getConnection();
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const query = `
        SELECT
            f.id_fichaingresoservicio AS id_ficha,
            f.fecha_fichacomercial AS fecha_creacion,
            a.frecuencia_correlativo,
            a.frecuencia,
            COALESCE(a.fecha_muestreo, a.ma_muestreo_fechai, f.fecha_fichacomercial) AS fecha_servicio,
            COALESCE(NULLIF(a.estado_caso, ''), f.estado_ficha, 'Pendiente Programar') AS estado_operacion,
            f.estado_ficha,
            f.id_validaciontecnica,
            COALESCE(cli.nombre_empresa, 'Sin cliente') AS cliente,
            COALESCE(es.nombre_empresaservicios, cli.nombre_empresa, 'Sin empresa servicio') AS empresa_servicio,
            COALESCE(c.nombre_centro, 'Sin centro') AS centro,
            COALESCE(o.nombre_objetivomuestreo_ma, 'Sin objetivo') AS objetivo,
            COALESCE(s.nombre_subarea, 'Sin subarea') AS subarea,
            COALESCE(la.nombre_lugaranalisis, 'Sin lugar analisis') AS lugar_analisis,
            COALESCE(m.nombre_muestreador, 'Sin muestreador') AS muestreador,
            COALESCE(det.tipo_analisis, 'Sin clasificar') AS tipo_analisis,
            COALESCE(tm.nombre_tipomuestra_ma, 'Sin tipo') AS tipo_muestra,
            COALESCE(l.nombre_laboratorioensayo, 'Sin laboratorio') AS laboratorio,
            CASE WHEN f.etfa = 'S' THEN 'S' ELSE 'N' END AS es_etfa,
            CAST(COALESCE(NULLIF(a.totalizador_final, 0), a.totalizador_inicio, 0) AS FLOAT) AS consumo_indice,
            CAST(COALESCE(a.vdd, 0) AS FLOAT) AS emisiones_indice,
            CASE
                WHEN COALESCE(NULLIF(a.estado_caso, ''), '') IN ('CANCELADO', 'ANULADA') THEN 2
                WHEN f.id_validaciontecnica IN (1, 3, 6) THEN 1
                ELSE 0
            END AS error_count,
            COUNT(det.id_fichaingresoservicio) OVER (PARTITION BY f.id_fichaingresoservicio) AS total_analisis
        FROM App_Ma_FichaIngresoServicio_ENC f
        LEFT JOIN App_Ma_Agenda_MUESTREOS a
            ON a.id_fichaingresoservicio = f.id_fichaingresoservicio
        LEFT JOIN mae_empresa cli
            ON cli.id_empresa = f.id_empresa
        LEFT JOIN mae_empresaservicios es
            ON es.id_empresaservicio = f.id_empresaservicio
        LEFT JOIN mae_centro c
            ON c.id_centro = f.id_centro
        LEFT JOIN mae_objetivomuestreo_ma o
            ON o.id_objetivomuestreo_ma = f.id_objetivomuestreo_ma
        LEFT JOIN mae_subarea s
            ON s.id_subarea = f.id_subarea
        LEFT JOIN mae_lugaranalisis la
            ON la.id_lugaranalisis = f.id_lugaranalisis
        LEFT JOIN mae_muestreador m
            ON m.id_muestreador = a.id_muestreador
        LEFT JOIN App_Ma_FichaIngresoServicio_DET det
            ON det.id_fichaingresoservicio = f.id_fichaingresoservicio
            AND det.activo = 1
        LEFT JOIN mae_tipomuestra_ma tm
            ON tm.id_tipomuestra_ma = f.id_tipomuestra_ma
        LEFT JOIN mae_laboratorioensayo l
            ON l.id_laboratorioensayo = det.id_laboratorioensayo
        WHERE COALESCE(a.fecha_muestreo, a.ma_muestreo_fechai, f.fecha_fichacomercial) >= @since
    `;

    const result = await pool.request().input('since', since).query(query);
    return result.recordset || [];
};

const countBy = (rows, selector) => {
    const counts = new Map();
    rows.forEach((row) => {
        const key = selector(row);
        counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
};

const topEntries = (counts, limit = 6) =>
    [...counts.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((left, right) => right.value - left.value)
        .slice(0, limit);

const topPairs = (rows, leftKey, rightKey, leftFallback, rightFallback, limit = 10) => {
    const counts = new Map();
    rows.forEach((row) => {
        const left = row[leftKey] || leftFallback;
        const right = row[rightKey] || rightFallback;
        const pairKey = `${left}|||${right}`;
        counts.set(pairKey, (counts.get(pairKey) || 0) + 1);
    });

    return [...counts.entries()]
        .map(([pairKey, value]) => {
            const [left, right] = pairKey.split('|||');
            return {
                left,
                right,
                name: `${left} / ${right}`,
                value,
            };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);
};

const groupByMonth = (rows, mapper) => {
    const groups = new Map();
    rows.forEach((row) => {
        const key = getMonthKey(row.fecha_servicio);
        if (!key) {
            return;
        }
        if (!groups.has(key)) {
            groups.set(key, mapper(undefined, row, true));
        } else {
            groups.set(key, mapper(groups.get(key), row, false));
        }
    });

    return [...groups.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([month, value]) => ({
            month,
            label: getMonthLabel(month),
            ...value,
        }));
};

const buildMonthlyTrend = (rows) => {
    const counts = new Map();
    rows.forEach((row) => {
        const key = getMonthKey(row.fecha_servicio);
        if (!key) {
            return;
        }
        counts.set(key, (counts.get(key) || 0) + 1);
    });

    return [...counts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([month, value]) => ({
            month,
            label: getMonthLabel(month),
            value,
        }));
};

const getPreviousComparison = (trend) => {
    if (trend.length < 2) {
        return {
            current: trend[trend.length - 1]?.value || 0,
            previous: 0,
            changePct: 0,
        };
    }

    const current = trend[trend.length - 1].value;
    const previous = trend[trend.length - 2].value;
    const changePct = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;

    return { current, previous, changePct: round(changePct, 1) };
};

const buildInsights = ({ rows, completionRate, cancellationRate, topClient, topSubarea, trendComparison, criticalAlerts }) => {
    const insights = [];

    insights.push({
        level: getSeverity(Math.abs(trendComparison.changePct)),
        title: 'Tendencia operacional',
        narrative:
            trendComparison.changePct >= 0
                ? `El volumen del ultimo mes crecio ${trendComparison.changePct}% frente al periodo anterior.`
                : `El volumen del ultimo mes cayo ${Math.abs(trendComparison.changePct)}% frente al periodo anterior.`,
        recommendation:
            trendComparison.changePct >= 15
                ? 'Reforzar capacidad de agenda y laboratorio para absorber la demanda.'
                : 'Revisar pipeline comercial y tasa de conversion de fichas.',
    });

    insights.push({
        level: getSeverity(100 - completionRate),
        title: 'Cumplimiento de ejecucion',
        narrative: `La tasa de ejecucion consolidada es ${completionRate}% con una cancelacion de ${cancellationRate}%.`,
        recommendation:
            completionRate < 70
                ? 'Priorizar reprogramacion y seguimiento de fichas pendientes.'
                : 'Mantener la disciplina operativa y automatizar alertas por atraso.',
    });

    insights.push({
        level: getSeverity(topClient?.value ? Math.min(100, topClient.value * 4) : 20),
        title: 'Concentracion de cartera',
        narrative: topClient
            ? `${topClient.name} concentra ${topClient.value} servicios dentro de la ventana analizada.`
            : 'No se detectaron clientes dominantes en la ventana analizada.',
        recommendation: topClient
            ? 'Asegurar SLA y diversificar carga entre cuentas medianas.'
            : 'Monitorear crecimiento por segmento para detectar cuentas clave.',
    });

    insights.push({
        level: getSeverity(topSubarea?.value ? Math.min(100, topSubarea.value * 5) : 10),
        title: 'Foco ambiental',
        narrative: topSubarea
            ? `La subarea ${topSubarea.name} lidera la carga y requiere seguimiento de capacidad.`
            : 'La carga ambiental se distribuye sin un foco dominante.',
        recommendation: 'Balancear muestreadores y laboratorios segun la mezcla de subareas.',
    });

    if (criticalAlerts.length > 0) {
        insights.push({
            level: 'critical',
            title: 'Riesgos activos',
            narrative: `Se detectaron ${criticalAlerts.length} alertas criticas que impactan el dashboard.`,
            recommendation: 'Escalar revision diaria hasta normalizar backlog, cancelaciones y capacidad.',
        });
    }

    return insights;
};

const buildAlerts = ({ overdueCount, cancellationRate, etfaRatio, backlogRate, trendComparison }) => {
    const alerts = [];

    if (overdueCount > 0) {
        alerts.push({
            level: overdueCount > 8 ? 'critical' : 'warning',
            title: 'Pendientes envejecidos',
            message: `${overdueCount} servicios siguen abiertos por mas de 7 dias.`,
        });
    }

    if (cancellationRate >= 12) {
        alerts.push({
            level: cancellationRate >= 18 ? 'critical' : 'warning',
            title: 'Cancelaciones elevadas',
            message: `La tasa de cancelacion llego a ${cancellationRate}%.`,
        });
    }

    if (etfaRatio >= 45) {
        alerts.push({
            level: etfaRatio >= 60 ? 'critical' : 'warning',
            title: 'Dependencia externa',
            message: `${etfaRatio}% de los servicios dependen de ETFA o laboratorio externo.`,
        });
    }

    if (backlogRate >= 35) {
        alerts.push({
            level: backlogRate >= 50 ? 'critical' : 'warning',
            title: 'Backlog de calidad',
            message: `${backlogRate}% del universo sigue pendiente de validacion.`,
        });
    }

    if (trendComparison.changePct <= -25) {
        alerts.push({
            level: 'warning',
            title: 'Caida de actividad',
            message: `El volumen mensual bajo ${Math.abs(trendComparison.changePct)}% versus el mes anterior.`,
        });
    }

    return alerts;
};

const buildDashboards = (context) => {
    const {
        rows,
        completionRate,
        cancellationRate,
        backlogRate,
        etfaRatio,
        topClients,
        topObjectives,
        topSubareas,
        topStates,
        monthlyTrend,
        trendComparison,
        alerts,
        insights,
        topCenters,
        topLabs,
        topAnalysisTypes,
        topServiceCompanies,
        topSampleTypes,
        topAnalysisPlaces,
        monthlyOperationalMix,
        monthlyImpactTrend,
        objectiveSubareaMatrix,
        clientSubareaMatrix,
        samplerLoad,
        alertLevelDistribution,
        etfaMix,
        stateByAnalysisType,
    } = context;

    const totalRows = rows.length;
    const uniqueClients = new Set(rows.map((row) => row.cliente)).size;
    const uniqueCenters = new Set(rows.map((row) => row.centro)).size;
    const uniqueSamplers = new Set(rows.map((row) => row.muestreador)).size;
    const consumoPromedio = round(
        rows.reduce((acc, row) => acc + Number(row.consumo_indice || 0), 0) / (rows.length || 1),
        1,
    );
    const emisionesPromedio = round(
        rows.reduce((acc, row) => acc + Number(row.emisiones_indice || 0), 0) / (rows.length || 1),
        1,
    );
    const frecuenciaPromedio = round(
        rows.reduce((acc, row) => acc + Number(row.frecuencia || 0), 0) / (rows.length || 1),
        1,
    );

    return [
        {
            key: 'medioambiente',
            title: 'Medioambiente',
            description: 'Indicadores de impacto, mezcla operativa y relaciones ambientales reales tomadas desde fichas, agenda y analisis.',
            kpis: [
                toCard('ma-total', 'Servicios monitoreados', totalRows, 'Base analizada del agente', 'green'),
                toCard('ma-consumo', 'Indice de consumo', consumoPromedio, 'Promedio estimado por servicio', 'teal'),
                toCard('ma-emisiones', 'Indice de emisiones', emisionesPromedio, 'Promedio estimado por servicio', 'lime'),
                toCard('ma-frecuencia', 'Frecuencia promedio', frecuenciaPromedio, 'Ciclo medio de agenda', 'blue'),
            ],
            widgets: [
                withHelp({
                    id: 'ma-trend',
                    type: 'area',
                    title: 'Tendencia de volumen ambiental',
                    data: monthlyTrend,
                    xKey: 'label',
                    yKeys: ['value'],
                }, 'Muestra cuántos servicios ambientales se generaron por periodo.', 'Sirve para detectar crecimiento, estacionalidad y caídas de demanda.' ),
                withHelp({
                    id: 'ma-subareas',
                    type: 'bar',
                    title: 'Carga por subarea',
                    data: topSubareas,
                    xKey: 'name',
                    yKeys: ['value'],
                }, 'Compara el volumen de servicios entre subáreas ambientales.', 'Ayuda a saber dónde se concentra la operación y dónde reforzar capacidad.'),
                withHelp({
                    id: 'ma-objectives',
                    type: 'donut',
                    title: 'Objetivos de muestreo',
                    data: topObjectives,
                    xKey: 'name',
                    yKeys: ['value'],
                }, 'Distribuye la demanda según el objetivo de muestreo registrado en la ficha.', 'Permite distinguir si la operación está orientada a cumplimiento, autocontrol, fiscalización u otros fines.'),
                withHelp({
                    id: 'ma-centers',
                    type: 'bar',
                    title: 'Centros con mayor actividad',
                    data: topCenters,
                    xKey: 'name',
                    yKeys: ['value'],
                }, 'Ordena los centros de muestreo por volumen de servicios.', 'Sirve para identificar puntos críticos, concentración geográfica y necesidades logísticas.'),
                withHelp({
                    id: 'ma-operational-mix',
                    type: 'stacked-bar',
                    title: 'Mix operativo mensual',
                    data: monthlyOperationalMix,
                    xKey: 'label',
                    yKeys: ['servicios', 'externos'],
                }, 'Resume por mes el volumen, consumo, emisiones y servicios externos.', 'Entrega una lectura rápida del comportamiento ambiental y operacional en conjunto.'),
                withHelp({
                    id: 'ma-impact-trend',
                    type: 'multi-bar',
                    title: 'Consumo y emisiones por mes',
                    data: monthlyImpactTrend,
                    xKey: 'label',
                    yKeys: ['consumo', 'emisiones'],
                }, 'Compara el comportamiento mensual del consumo y las emisiones estimadas.', 'Sirve para identificar meses con mayor presión ambiental o cambios bruscos.'),
                withHelp({
                    id: 'ma-objective-subarea-matrix',
                    type: 'bar',
                    title: 'Cruce subarea vs objetivo',
                    data: objectiveSubareaMatrix,
                    xKey: 'name',
                    yKeys: ['value'],
                }, 'Cruza subáreas ambientales con objetivos de muestreo.', 'Sirve para entender qué tipo de trabajo domina en cada línea ambiental.'),
                withHelp({
                    id: 'ma-etfa-mix',
                    type: 'donut',
                    title: 'ETFA vs laboratorio interno',
                    data: etfaMix,
                    xKey: 'name',
                    yKeys: ['value'],
                }, 'Distribuye los servicios entre ejecución externa ETFA e interna.', 'Ayuda a entender dependencia operativa y capacidad propia.'),
                withHelp({
                    id: 'ma-alert-levels',
                    type: 'donut',
                    title: 'Alertas por severidad',
                    data: alertLevelDistribution,
                    xKey: 'name',
                    yKeys: ['value'],
                }, 'Lista desviaciones, riesgos o comportamientos fuera de rango detectados por el agente.', 'Ayuda a priorizar acciones antes de revisar detalle operativo.'),
            ],
            filters: ['periodo', 'cliente', 'subarea', 'estado'],
            insights: insights.filter((item) => item.title === 'Foco ambiental' || item.title === 'Riesgos activos'),
        },
        {
            key: 'calidad',
            title: 'Calidad',
            description: 'Cumplimiento de estandares, backlog y desviaciones por ejecucion.',
            kpis: [
                toCard('gc-cumplimiento', 'Cumplimiento', `${completionRate}%`, 'Tasa de ejecucion total', 'blue'),
                toCard('gc-backlog', 'Backlog', `${backlogRate}%`, 'Pendiente de validacion o cierre', 'orange'),
                toCard('gc-cancelacion', 'Cancelacion', `${cancellationRate}%`, 'Servicios cancelados/anulados', 'red'),
                toCard('gc-externo', 'ETFA externo', `${etfaRatio}%`, 'Dependencia de terceros', 'violet'),
            ],
            widgets: [
                withHelp({
                    id: 'gc-state-mix',
                    type: 'donut',
                    title: 'Estados del proceso',
                    data: topStates,
                    xKey: 'name',
                    yKeys: ['value'],
                }, 'Muestra cómo se reparte el universo entre estados operativos.', 'Sirve para detectar acumulación en pendientes, ejecución o cancelaciones.'),
                withHelp({
                    id: 'gc-trend',
                    type: 'line',
                    title: 'Variacion mensual',
                    data: monthlyTrend.map((row) => ({
                        ...row,
                        variation: row.value,
                    })),
                    xKey: 'label',
                    yKeys: ['variation'],
                }, 'Representa el volumen procesado por mes.', 'Ayuda a comparar la carga de calidad entre periodos y anticipar backlog.'),
                withHelp({
                    id: 'gc-analysis-type',
                    type: 'bar',
                    title: 'Tipo de analisis',
                    data: topAnalysisTypes,
                    xKey: 'name',
                    yKeys: ['value'],
                }, 'Compara la carga entre analisis de laboratorio, terreno u otras clasificaciones.', 'Permite distribuir mejor capacidad técnica y tiempos de respuesta.'),
                withHelp({
                    id: 'gc-labs',
                    type: 'bar',
                    title: 'Laboratorios mas utilizados',
                    data: topLabs,
                    xKey: 'name',
                    yKeys: ['value'],
                }, 'Muestra los laboratorios con mayor participación en los servicios.', 'Sirve para vigilar dependencia, cuellos de botella y necesidad de respaldo.'),
                withHelp({
                    id: 'gc-state-by-type',
                    type: 'stacked-bar',
                    title: 'Estados por tipo de analisis',
                    data: stateByAnalysisType,
                    xKey: 'name',
                    yKeys: ['ejecutados', 'pendientes', 'cancelados'],
                }, 'Cruza el tipo de análisis con su estado operativo.', 'Permite ver qué líneas técnicas están generando más backlog o cancelación.'),
                withHelp({
                    id: 'gc-alert-levels',
                    type: 'donut',
                    title: 'Desviaciones por severidad',
                    data: alertLevelDistribution,
                    xKey: 'name',
                    yKeys: ['value'],
                }, 'Lista los hallazgos que afectan cumplimiento o continuidad operativa.', 'Ayuda a ordenar la revisión de calidad y gestión de desviaciones.'),
            ],
            filters: ['periodo', 'estado', 'tipoAnalisis'],
            insights: insights.filter((item) => item.title === 'Cumplimiento de ejecucion'),
        },
        {
            key: 'clientes',
            title: 'Clientes',
            description: 'Comportamiento, segmentacion y uso de los servicios monitoreados.',
            kpis: [
                toCard('cl-clientes', 'Clientes activos', uniqueClients, 'Con actividad en la ventana', 'cyan'),
                toCard('cl-centros', 'Centros cubiertos', uniqueCenters, 'Cobertura operacional', 'indigo'),
                toCard('cl-top', 'Cliente lider', topClients[0]?.name || 'N/A', `${topClients[0]?.value || 0} servicios`, 'pink'),
                toCard('cl-top-objetivo', 'Objetivo lider', topObjectives[0]?.name || 'N/A', `${topObjectives[0]?.value || 0} servicios`, 'grape'),
            ],
            widgets: [
                withHelp({
                    id: 'cl-clientes-top',
                    type: 'bar',
                    title: 'Top clientes',
                    data: topClients,
                    xKey: 'name',
                    yKeys: ['value'],
                }, 'Ordena a los clientes por cantidad de servicios en la ventana analizada.', 'Sirve para identificar cuentas clave y concentración de la demanda.'),
                withHelp({
                    id: 'cl-objetivos',
                    type: 'donut',
                    title: 'Objetivos de muestreo',
                    data: topObjectives,
                    xKey: 'name',
                    yKeys: ['value'],
                }, 'Distribuye la actividad por objetivo de muestreo.', 'Ayuda a entender qué motivación de servicio predomina en la cartera.'),
                withHelp({
                    id: 'cl-service-companies',
                    type: 'bar',
                    title: 'Empresas de servicio',
                    data: topServiceCompanies,
                    xKey: 'name',
                    yKeys: ['value'],
                }, 'Muestra qué empresas de servicio concentran la operación en terreno.', 'Permite evaluar dependencia de terceros y balance de carga por proveedor.'),
                withHelp({
                    id: 'cl-client-subarea',
                    type: 'bar',
                    title: 'Clientes vs subareas',
                    data: clientSubareaMatrix,
                    xKey: 'name',
                    yKeys: ['value'],
                }, 'Cruza clientes con subáreas para mostrar en qué línea ambiental operan más.', 'Sirve para segmentar cuentas por tipo de servicio y diseñar foco comercial.'),
                withHelp({
                    id: 'cl-centers',
                    type: 'bar',
                    title: 'Centros mas atendidos',
                    data: topCenters,
                    xKey: 'name',
                    yKeys: ['value'],
                }, 'Muestra los centros con mayor volumen dentro de la cartera.', 'Ayuda a entender la cobertura real y la concentración territorial.'),
                withHelp({
                    id: 'cl-usage',
                    type: 'metric-list',
                    title: 'Metricas de uso',
                    data: [
                        { label: 'Promedio mensual', value: round(totalRows / Math.max(monthlyTrend.length, 1), 1) },
                        { label: 'Cobertura por cliente', value: round(totalRows / Math.max(uniqueClients, 1), 1) },
                        { label: 'Muestreadores activos', value: uniqueSamplers },
                    ],
                }, 'Resume tres indicadores rápidos de uso y cobertura.', 'Permite entender escala media, densidad por cliente y capacidad operativa activa.'),
            ],
            filters: ['periodo', 'cliente', 'centro'],
            insights: insights.filter((item) => item.title === 'Concentracion de cartera'),
        },
        {
            key: 'gerencial',
            title: 'Gerencial',
            description: 'Resumen ejecutivo con KPIs globales, riesgos e insights automaticos.',
            executiveSummary: {
                headline: 'Resumen ejecutivo automatizado',
                body: `El agente analista proceso ${totalRows} registros, con ${completionRate}% de ejecucion y ${alerts.length} alertas activas.`,
                trend: trendComparison,
            },
            kpis: [
                toCard('ge-universo', 'Universo analizado', totalRows, 'Servicios evaluados', 'dark'),
                toCard('ge-ejecucion', 'Ejecucion', `${completionRate}%`, 'Tasa consolidada', 'green'),
                toCard('ge-alertas', 'Alertas', alerts.length, 'Criticas y preventivas', 'red'),
                toCard('ge-capacidad', 'Capacidad activa', uniqueSamplers, 'Muestreadores con actividad', 'yellow'),
            ],
            widgets: [
                withHelp({
                    id: 'ge-summary',
                    type: 'summary',
                    title: 'Resumen ejecutivo',
                    data: insights.slice(0, 4),
                }, 'Condensa los hallazgos automáticos más importantes generados por el analista.', 'Sirve para leer rápidamente el estado general sin revisar todos los gráficos.'),
                withHelp({
                    id: 'ge-trend',
                    type: 'area',
                    title: 'Evolucion global',
                    data: monthlyTrend,
                    xKey: 'label',
                    yKeys: ['value'],
                }, 'Muestra la trayectoria completa del volumen procesado.', 'Ayuda a detectar si el negocio o la operación viene creciendo o desacelerando.'),
                withHelp({
                    id: 'ge-sampler-load',
                    type: 'bar',
                    title: 'Carga por muestreador',
                    data: samplerLoad,
                    xKey: 'name',
                    yKeys: ['value'],
                }, 'Compara el volumen asignado o ejecutado por muestreador.', 'Sirve para balancear capacidad, detectar sobrecarga y gestionar reemplazos.'),
                withHelp({
                    id: 'ge-analysis-place',
                    type: 'donut',
                    title: 'Lugar de analisis',
                    data: topAnalysisPlaces,
                    xKey: 'name',
                    yKeys: ['value'],
                }, 'Distribuye los servicios por lugar de análisis registrado.', 'Permite entender cuánto trabajo se resuelve en terreno, laboratorio u otros contextos.'),
                withHelp({
                    id: 'ge-sample-type',
                    type: 'bar',
                    title: 'Tipos de muestra',
                    data: topSampleTypes,
                    xKey: 'name',
                    yKeys: ['value'],
                }, 'Muestra qué tipos de muestra predominan en la base analizada.', 'Ayuda a planificar insumos, logística y especialización técnica.'),
                withHelp({
                    id: 'ge-risk-levels',
                    type: 'donut',
                    title: 'Mapa de riesgos',
                    data: alertLevelDistribution,
                    xKey: 'name',
                    yKeys: ['value'],
                }, 'Resume los riesgos activos por nivel de severidad.', 'Sirve para que gerencia dimensione rápidamente la presión operativa.'),
                withHelp({
                    id: 'ge-etfa-mix',
                    type: 'donut',
                    title: 'Dependencia externa',
                    data: etfaMix,
                    xKey: 'name',
                    yKeys: ['value'],
                }, 'Presenta los riesgos operativos y de calidad que requieren atención.', 'Sirve para priorizar acciones gerenciales y seguimiento.'),
            ],
            filters: ['periodo'],
            insights,
        },
    ];
};

const buildSnapshot = (rows, options = {}) => {
    const monthlyTrend = buildMonthlyTrend(rows);
    const trendComparison = getPreviousComparison(monthlyTrend);
    const completedRows = rows.filter((row) => normalize(row.estado_operacion).includes('ejecut'));
    const cancelledRows = rows.filter((row) => {
        const status = normalize(row.estado_operacion);
        return status.includes('cancel') || status.includes('anulad');
    });
    const backlogRows = rows.filter((row) => [1, 3, 6].includes(Number(row.id_validaciontecnica)));
    const overdueRows = rows.filter((row) => {
        const status = normalize(row.estado_operacion);
        if (status.includes('ejecut') || status.includes('cancel') || status.includes('anulad')) {
            return false;
        }

        const serviceDate = safeDate(row.fecha_servicio) || safeDate(row.fecha_creacion);
        if (!serviceDate) {
            return false;
        }

        return Date.now() - serviceDate.getTime() > 7 * 24 * 60 * 60 * 1000;
    });
    const externalRows = rows.filter((row) => row.es_etfa === 'S' || normalize(row.laboratorio).includes('extern'));

    const completionRate = round((completedRows.length / Math.max(rows.length, 1)) * 100, 1);
    const cancellationRate = round((cancelledRows.length / Math.max(rows.length, 1)) * 100, 1);
    const backlogRate = round((backlogRows.length / Math.max(rows.length, 1)) * 100, 1);
    const etfaRatio = round((externalRows.length / Math.max(rows.length, 1)) * 100, 1);

    const topClients = topEntries(countBy(rows, (row) => row.cliente || 'Sin cliente'));
    const topObjectives = topEntries(countBy(rows, (row) => row.objetivo || 'Sin objetivo'));
    const topSubareas = topEntries(countBy(rows, (row) => row.subarea || 'Sin subarea'));
    const topStates = topEntries(countBy(rows, (row) => row.estado_operacion || 'Sin estado'));
    const topCenters = topEntries(countBy(rows, (row) => row.centro || 'Sin centro'));
    const topLabs = topEntries(countBy(rows, (row) => row.laboratorio || 'Sin laboratorio'));
    const topAnalysisTypes = topEntries(countBy(rows, (row) => row.tipo_analisis || 'Sin clasificar'));
    const topServiceCompanies = topEntries(countBy(rows, (row) => row.empresa_servicio || 'Sin empresa servicio'));
    const topSampleTypes = topEntries(countBy(rows, (row) => row.tipo_muestra || 'Sin tipo'));
    const topAnalysisPlaces = topEntries(countBy(rows, (row) => row.lugar_analisis || 'Sin lugar'));
    const samplerLoad = topEntries(countBy(rows, (row) => row.muestreador || 'Sin muestreador'), 8);
    const alerts = buildAlerts({
        overdueCount: overdueRows.length,
        cancellationRate,
        etfaRatio,
        backlogRate,
        trendComparison,
    });

    const alertLevelDistribution = topEntries(countBy(alerts, (row) => row.level || 'normal'), 5);
    const etfaMix = [
        { name: 'Interno', value: rows.filter((row) => row.es_etfa !== 'S').length },
        { name: 'ETFA', value: rows.filter((row) => row.es_etfa === 'S').length },
    ];
    const monthlyOperationalMix = monthlyTrend.map((monthRow) => {
        const monthRows = rows.filter((row) => getMonthLabel(getMonthKey(row.fecha_servicio)) === monthRow.label);
        return {
            label: monthRow.label,
            servicios: monthRows.length,
            externos: monthRows.filter((row) => row.es_etfa === 'S').length,
        };
    });
    const monthlyImpactTrend = monthlyTrend.map((monthRow) => {
        const monthRows = rows.filter((row) => getMonthLabel(getMonthKey(row.fecha_servicio)) === monthRow.label);
        return {
            label: monthRow.label,
            consumo: round(monthRows.reduce((acc, row) => acc + Number(row.consumo_indice || 0), 0), 1),
            emisiones: round(monthRows.reduce((acc, row) => acc + Number(row.emisiones_indice || 0), 0), 1),
        };
    });
    const objectiveSubareaMatrix = topPairs(rows, 'subarea', 'objetivo', 'Sin subarea', 'Sin objetivo', 10);
    const clientSubareaMatrix = topPairs(rows, 'cliente', 'subarea', 'Sin cliente', 'Sin subarea', 10);
    const stateByAnalysisType = topAnalysisTypes.map((type) => {
        const typeRows = rows.filter((row) => (row.tipo_analisis || 'Sin clasificar') === type.name);
        return {
            name: type.name,
            ejecutados: typeRows.filter((row) => normalize(row.estado_operacion).includes('ejecut')).length,
            pendientes: typeRows.filter((row) => {
                const status = normalize(row.estado_operacion);
                return !status.includes('ejecut') && !status.includes('cancel') && !status.includes('anulad');
            }).length,
            cancelados: typeRows.filter((row) => {
                const status = normalize(row.estado_operacion);
                return status.includes('cancel') || status.includes('anulad');
            }).length,
        };
    });

    const insights = buildInsights({
        rows,
        completionRate,
        cancellationRate,
        topClient: topClients[0],
        topSubarea: topSubareas[0],
        trendComparison,
        criticalAlerts: alerts.filter((item) => item.level === 'critical'),
    });


    return {
        generatedAt: new Date().toISOString(),
        execution: {
            mode: options.mode || 'manual',
            source: options.source || 'database',
            usedFallback: options.usedFallback || false,
        },
        configuration: {
            orchestration: kpiAnalystConfig.orchestration,
            agent: kpiAnalystConfig.agent,
            domains: kpiAnalystConfig.domains,
            sources: kpiAnalystConfig.sources,
        },
        dataProfile: {
            totalRows: rows.length,
            uniqueClients: new Set(rows.map((row) => row.cliente)).size,
            uniqueCenters: new Set(rows.map((row) => row.centro)).size,
            uniqueSamplers: new Set(rows.map((row) => row.muestreador)).size,
            coveredMonths: monthlyTrend.length,
        },
        automation: {
            steps: [
                { id: 'ingesta', title: 'Ingesta de datos', status: 'completed' },
                { id: 'clasificacion', title: 'Clasificacion automatica', status: 'completed' },
                { id: 'analisis', title: 'Analisis de KPIs y anomalias', status: 'completed' },
                { id: 'dashboard', title: 'Generacion de dashboards', status: 'completed' },
                { id: 'api', title: 'Publicacion para frontend', status: 'completed' },
            ],
            triggers: {
                interval: `${Math.floor(kpiAnalystConfig.orchestration.refreshIntervalMs / 60000)} minutos`,
                event: 'POST /api/analysis/dashboard-kpis/events',
                manual: 'POST /api/analysis/dashboard-kpis/execute',
            },
        },
        alerts,
        insights,
        dashboards: buildDashboards({
            rows,
            completionRate,
            cancellationRate,
            backlogRate,
            etfaRatio,
            topClients,
            topObjectives,
            topSubareas,
            topStates,
            topCenters,
            topLabs,
            topAnalysisTypes,
            topServiceCompanies,
            topSampleTypes,
            topAnalysisPlaces,
            monthlyOperationalMix,
            monthlyImpactTrend,
            objectiveSubareaMatrix,
            clientSubareaMatrix,
            samplerLoad,
            alertLevelDistribution,
            etfaMix,
            stateByAnalysisType,
            monthlyTrend,
            trendComparison,
            alerts,
            insights,
        }),
    };
};

export const runAnalysis = async ({ mode = 'manual', windowDays, event } = {}) => {
    if (cache.running) {
        return cache.snapshot;
    }

    cache.running = true;
    cache.lastError = null;

    try {
        const effectiveWindow = Number(windowDays) || kpiAnalystConfig.orchestration.defaultWindowDays;
        let rows = [];
        let usedFallback = false;

        try {
            rows = await fetchDataset(effectiveWindow);
        } catch (error) {
            usedFallback = true;
            logger.warn(`KPI Analyst fallback activated: ${error.message}`);
            rows = buildFallbackDataset(effectiveWindow);
        }

        if (!rows.length) {
            usedFallback = true;
            rows = buildFallbackDataset(effectiveWindow);
        }

        const snapshot = buildSnapshot(rows, {
            mode,
            source: usedFallback ? 'fallback' : 'database',
            usedFallback,
        });

        cache.snapshot = snapshot;
        cache.lastRunAt = snapshot.generatedAt;
        cache.lastEvent = event || null;
        cache.history = [
            {
                generatedAt: snapshot.generatedAt,
                mode,
                totalRows: snapshot.dataProfile.totalRows,
                usedFallback,
            },
            ...cache.history,
        ].slice(0, 10);

        logger.info(`KPI Analyst executed in ${mode} mode with ${snapshot.dataProfile.totalRows} rows`);
        return snapshot;
    } catch (error) {
        cache.lastError = error.message;
        logger.error('KPI Analyst execution failed:', error);
        throw error;
    } finally {
        cache.running = false;
    }
};

export const getSnapshot = async (options = {}) => {
    if (!cache.snapshot || options.forceRefresh) {
        return runAnalysis({ mode: options.forceRefresh ? 'manual' : 'startup' });
    }

    return cache.snapshot;
};

export const notifyEvent = async (event = {}) => {
    cache.lastEvent = {
        type: event.type || 'data_changed',
        source: event.source || 'api',
        receivedAt: new Date().toISOString(),
    };

    return runAnalysis({
        mode: 'event',
        event: cache.lastEvent,
    });
};

export const getAgentStatus = () => ({
    agent: kpiAnalystConfig.agent,
    orchestration: kpiAnalystConfig.orchestration,
    running: cache.running,
    lastRunAt: cache.lastRunAt,
    lastError: cache.lastError,
    lastEvent: cache.lastEvent,
    history: cache.history,
    hasSnapshot: Boolean(cache.snapshot),
});

export const getAgentConfiguration = () => kpiAnalystConfig;

const isNumericValue = (value) => {
    if (value === null || value === undefined || value === '') {
        return false;
    }
    return Number.isFinite(Number(value));
};

const looksLikeDate = (value) => {
    if (!value) {
        return false;
    }
    if (value instanceof Date) {
        return !Number.isNaN(value.getTime());
    }
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime());
};

const inferColumnTypes = (rows) => {
    const entries = Object.entries(rows[0] || {});

    return entries.map(([key]) => {
        let numeric = 0;
        let dates = 0;
        let filled = 0;

        rows.forEach((row) => {
            const value = row[key];
            if (value === null || value === undefined || value === '') {
                return;
            }
            filled += 1;
            if (isNumericValue(value)) {
                numeric += 1;
            }
            if (looksLikeDate(value)) {
                dates += 1;
            }
        });

        const numericRatio = filled ? numeric / filled : 0;
        const dateRatio = filled ? dates / filled : 0;

        let type = 'category';
        if (dateRatio >= 0.7) {
            type = 'date';
        } else if (numericRatio >= 0.7) {
            type = 'number';
        }

        return { key, type };
    });
};

const summarizeNumericColumns = (rows, numericColumns) =>
    numericColumns.map((column) => {
        const values = rows
            .map((row) => Number(row[column.key]))
            .filter((value) => Number.isFinite(value));
        const total = values.reduce((acc, value) => acc + value, 0);
        const avg = total / (values.length || 1);
        const max = values.length ? Math.max(...values) : 0;
        const min = values.length ? Math.min(...values) : 0;

        return {
            column: column.key,
            total: round(total, 2),
            average: round(avg, 2),
            max: round(max, 2),
            min: round(min, 2),
        };
    });

const summarizeCategoryColumns = (rows, categoryColumns) =>
    categoryColumns.map((column) => ({
        column: column.key,
        topValues: topEntries(countBy(rows, (row) => String(row[column.key] || 'Sin dato')), 8),
    }));

const buildExcelTrend = (rows, dateColumn, numericColumn) => {
    if (!dateColumn) {
        return [];
    }

    const grouped = new Map();
    rows.forEach((row) => {
        const rawDate = row[dateColumn.key];
        const key = getMonthKey(rawDate);
        if (!key) {
            return;
        }
        const current = grouped.get(key) || { count: 0, sum: 0 };
        current.count += 1;
        if (numericColumn && isNumericValue(row[numericColumn.key])) {
            current.sum += Number(row[numericColumn.key]);
        }
        grouped.set(key, current);
    });

    return [...grouped.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([month, value]) => ({
            month,
            label: getMonthLabel(month),
            registros: value.count,
            total: round(value.sum, 2),
        }));
};

const getWorksheetHeaders = (worksheet) => {
    const headers = [];
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value || `columna_${colNumber}`).trim();
    });
    return headers;
};

const getWorksheetRows = (worksheet, headers) => {
    const rows = [];

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
            return;
        }

        const record = {};
        headers.forEach((header, index) => {
            const cell = row.getCell(index + 1);
            const value = cell.value && typeof cell.value === 'object' && 'text' in cell.value
                ? cell.value.text
                : cell.value;
            record[header] = value ?? null;
        });

        const hasSomeValue = Object.values(record).some((value) => value !== null && value !== '');
        if (hasSomeValue) {
            rows.push(record);
        }
    });

    return rows;
};

const analyzeWorksheet = (worksheet) => {
    const headers = getWorksheetHeaders(worksheet);
    const rows = getWorksheetRows(worksheet, headers);

    if (!rows.length) {
        return null;
    }

    const columns = inferColumnTypes(rows);
    const numericColumns = columns.filter((column) => column.type === 'number');
    const dateColumns = columns.filter((column) => column.type === 'date');
    const categoryColumns = columns.filter((column) => column.type === 'category');

    const numericSummary = summarizeNumericColumns(rows, numericColumns);
    const categorySummary = summarizeCategoryColumns(rows, categoryColumns.slice(0, 3));
    const primaryNumeric = numericColumns[0];
    const primaryDate = dateColumns[0];
    const primaryCategory = categorySummary[0];
    const trend = buildExcelTrend(rows, primaryDate, primaryNumeric);
    const trendComparison = getPreviousComparison(trend.map((item) => ({ value: item.total || item.registros })));

    const nullRatio = round(
        (rows.reduce((acc, row) => {
            const emptyInRow = Object.values(row).filter((value) => value === null || value === '').length;
            return acc + emptyInRow;
        }, 0) / (rows.length * Math.max(headers.length, 1))) * 100,
        1,
    );

    const insights = [
        {
            level: getSeverity(nullRatio),
            title: 'Calidad de la hoja',
            narrative: `La hoja ${worksheet.name} contiene ${rows.length} filas, ${headers.length} columnas y ${nullRatio}% de celdas vacias.`,
            recommendation: nullRatio > 20 ? 'Revisar celdas vacias antes de usar esta hoja como fuente principal.' : 'La hoja tiene una estructura consistente para analisis automatico.',
        },
    ];

    if (primaryNumeric) {
        const summary = numericSummary[0];
        insights.push({
            level: 'normal',
            title: `Comportamiento de ${primaryNumeric.key}`,
            narrative: `Promedio ${summary.average}, maximo ${summary.max} y minimo ${summary.min}.`,
            recommendation: 'Usar esta columna como metrica base si representa volumen, monto o consumo.',
        });
    }

    if (primaryCategory?.topValues?.length) {
        insights.push({
            level: 'normal',
            title: `Segmentacion por ${primaryCategory.column}`,
            narrative: `${primaryCategory.topValues[0].name} lidera con ${primaryCategory.topValues[0].value} registros dentro de ${worksheet.name}.`,
            recommendation: 'Comparar categorias principales con las minoritarias para detectar concentracion.',
        });
    }

    if (trend.length) {
        insights.push({
            level: getSeverity(Math.abs(trendComparison.changePct)),
            title: 'Tendencia temporal',
            narrative:
                trendComparison.changePct >= 0
                    ? `El ultimo periodo subio ${trendComparison.changePct}% en ${worksheet.name}.`
                    : `El ultimo periodo bajo ${Math.abs(trendComparison.changePct)}% en ${worksheet.name}.`,
            recommendation: 'Usar la serie temporal de esta hoja para seguimiento y alertas.',
        });
    }

    return {
        sheetName: worksheet.name,
        profile: {
            rows: rows.length,
            columns: headers.length,
            numericColumns: numericColumns.map((column) => column.key),
            dateColumns: dateColumns.map((column) => column.key),
            categoryColumns: categoryColumns.map((column) => column.key),
        },
        kpis: [
            toCard(`sheet-${worksheet.name}-rows`, 'Filas analizadas', rows.length, 'Registros utiles detectados', 'blue'),
            toCard(`sheet-${worksheet.name}-columns`, 'Columnas detectadas', headers.length, 'Estructura de la hoja', 'teal'),
            toCard(`sheet-${worksheet.name}-null-ratio`, 'Celdas vacias', `${nullRatio}%`, 'Calidad de la hoja', 'orange'),
            toCard(
                `sheet-${worksheet.name}-main-metric`,
                'Metrica principal',
                primaryNumeric?.key || 'Sin numericas',
                primaryNumeric ? 'Variable sugerida para seguimiento' : 'No se detectaron columnas numericas',
                'grape',
            ),
        ],
        widgets: [
            primaryCategory ? withHelp({
                id: `sheet-${worksheet.name}-category-top`,
                type: 'bar',
                title: `Distribucion por ${primaryCategory.column}`,
                data: primaryCategory.topValues,
                xKey: 'name',
                yKeys: ['value'],
            }, `Agrupa la hoja ${worksheet.name} por la categoria ${primaryCategory.column}.`, 'Sirve para identificar los grupos dominantes dentro de esta hoja.') : null,
            trend.length ? withHelp({
                id: `sheet-${worksheet.name}-trend`,
                type: 'area',
                title: primaryNumeric ? `Tendencia de ${primaryNumeric.key}` : 'Tendencia de registros',
                data: trend.map((item) => ({
                    label: item.label,
                    value: primaryNumeric ? item.total : item.registros,
                })),
                xKey: 'label',
                yKeys: ['value'],
            }, 'Muestra la evolucion temporal de la metrica principal o del conteo de registros.', 'Ayuda a detectar crecimiento, caidas o estacionalidad dentro de la hoja.') : null,
            withHelp({
                id: `sheet-${worksheet.name}-numeric-table`,
                type: 'table',
                title: 'Resumen numerico',
                columns: ['column', 'total', 'average', 'max', 'min'],
                data: numericSummary,
            }, 'Resume las columnas numericas detectadas en la hoja.', 'Permite entender rapidamente magnitud, promedio y rango de los valores.'),
        ].filter(Boolean),
        insights,
    };
};

export const analyzeExcelBuffer = async (buffer, fileName = 'dataset.xlsx') => {
    return analyzeExcelBufferAdvanced(buffer, fileName);
};
