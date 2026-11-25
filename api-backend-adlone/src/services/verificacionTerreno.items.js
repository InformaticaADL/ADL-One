// Los ítems que trae impresos cada formulario, en su orden. El frontend los pide por API para no tener
// una segunda copia que se desincronice.

/** OI-FoGe-26 · tres equipos, cada uno con su lista (cumple / no cumple / no aplica). */
export const ITEMS_VERIF_EQUIPOS = {
    ph: [
        ['bateria', 'Estado batería'],
        ['electrodo', 'Limpieza electrodo y tapa de protección'],
        ['cartridge', 'Estado de Cartridge'],
        ['solucion', 'Solución de mantención de electrodos'],
        ['teclado', 'Estado teclado de programación de equipo'],
        ['exterior', 'Limpieza exterior'],
    ],
    oxigeno: [
        ['bateria', 'Estado batería'],
        ['limpieza', 'Limpieza general del equipo'],
        ['membrana', 'Estado de Membrana'],
        ['electrolito', 'Verificación de electrolito'],
        ['teclado', 'Estado teclado de programación de equipo'],
        ['soluciones', 'Soluciones de mantención y calibración'],
    ],
    cloro: [
        ['bateria', 'Estado batería'],
        ['limpieza', 'Limpieza general del equipo'],
        ['frascos', 'Estado de Frascos'],
        ['teclado', 'Estado teclado equipo'],
        ['dpd', 'Reactivo DPD'],
        ['estandar', 'Estándar de verificación'],
    ],
};

/** Buffers de pH del OI-FoGe-26, con la desviación que admite el formato. */
export const BUFFERS_PH = [
    ['4,0', '3,90 - 4,10 (0,1 U pH)'],
    ['7,0', '6,90 - 7,10 (0,1 U pH)'],
    ['10,0', '9,90 - 10,10 (0,1 U pH)'],
];

/** OI-FoMa-03 · parámetros del muestreador automático, agrupados como en el formato. */
export const ITEMS_MAU = [
    { grupo: 'Sistema controlador', items: [
        ['puertos', 'Puertos de Conexión'],
        ['humedad', 'Indicador de Humedad'],
    ] },
    { grupo: 'Sistema de bombeo peristáltico', items: [
        ['manguera_bomba', 'Manguera de bomba peristáltica'],
        ['manguera_succion', 'Manguera o línea de succión'],
        ['rodillos', 'Rodillos de la bomba peristáltica'],
        ['broches', 'Broches de unión de la línea de succión'],
        ['filtro', 'Filtro o Boquilla de succión'],
        ['botellas', 'Botellas recolectoras de muestras'],
        ['base_retenedora', 'Estado Base Retenedora'],
    ] },
    { grupo: 'Sistema de distribución', items: [
        ['brazo', 'Estado brazo distribuidor y sistema de sujeción'],
        ['silicona', 'Estado manguera de silicona del brazo distribuidor'],
        ['retenedor', 'Estado retenedor de botellas'],
        ['bateria', 'Carga de la Batería'],
        ['escaner', 'Escáner del software de funcionamiento'],
        ['memoria', 'Memoria de almacenamiento'],
        ['func_brazo', 'Funcionamiento del brazo distribuidor'],
        ['succion', 'Fuerza de succión del sistema de bombeo'],
        ['volumen', 'Correcta recolección del volumen'],
        ['estado_equipo', 'Estado Equipo'],
    ] },
];

/** OI-FoMa-19 · lo que se lleva a terreno, en las tres columnas del formato. */
export const ITEMS_MATERIALES = [
    { grupo: 'SEGURIDAD', items: [
        ['zapato', 'Zapato de seguridad'],
        ['casco', 'Casco de seguridad'],
        ['mascarilla_gases', 'Mascarilla filtro gases y/o polvo'],
        ['chaleco_reflectante', 'Chaleco Reflectante'],
        ['chaleco_salvavidas', 'Chaleco salvavidas'],
        ['arnes', 'Arnés de seguridad'],
        ['tapones', 'Protección acústica (tapones)'],
        ['parka', 'Parka'],
        ['botas', 'Botas PVC (blancas y negras)'],
        ['crema_uv', 'Crema con protección UV'],
        ['antiparras', 'Antiparras con protección UV'],
        ['cuerda_vida', 'Cuerda de vida'],
    ] },
    { grupo: 'RILES', items: [
        ['envases', 'Set de envases de recambio'],
        ['balde', 'Balde'],
        ['bidon', 'Bidón con 20 L de agua'],
        ['cuchillo', 'Cuchillo, corta cartón'],
        ['probeta', 'Probeta y jarro para muestra'],
        ['regleta', 'Regleta'],
        ['herramientas', 'Set herramientas'],
        ['huincha', 'Huincha de Medición'],
        ['atornillador', 'Atornillador, cruz y paleta'],
        ['guantes_cuero', 'Guantes cuero'],
        ['cadena', 'Cadena y sellos para equipo'],
        ['guantes_goma', 'Guantes goma o PVC'],
    ] },
    { grupo: 'IMPLEMENTOS GENERALES MUESTREO', items: [
        ['planillas', 'Planillas de muestreo OI-FoMa-01'],
        ['alcohol', 'Alcohol 70% o alcohol gel'],
        ['delantal', 'Delantal'],
        ['buzo', 'Buzo / overol'],
        ['buzo_termico', 'Buzo Térmico'],
        ['traje_pvc', 'Traje para agua, PVC'],
        ['hielo', 'Hielo o ice pack gel pack'],
        ['nevera', 'Nevera(s)'],
        ['cofia', 'Cofia y mascarilla'],
        ['buffer', 'Buffer pH 4,0; 7,0 y 10,0'],
        ['guantes_quirurgicos', 'Guantes quirúrgicos'],
        ['otro', 'Otro'],
    ] },
];

export const CARACTERISTICAS = [
    ['AS', 'Aguas servidas A.S.'],
    ['RIL', 'RIL'],
    ['MAR', 'Agua de mar'],
    ['SUPERFICIAL', 'Superficial'],
    ['OTROS', 'Otros'],
];

export default { ITEMS_VERIF_EQUIPOS, BUFFERS_PH, ITEMS_MAU, ITEMS_MATERIALES, CARACTERISTICAS };
