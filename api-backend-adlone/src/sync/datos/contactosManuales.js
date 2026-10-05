// Contactos habilitados cuyo id_empresa (689-694) no existe en mae_empresa (llega a 688) y con servicio 0.
// Enlazados por evidencia: dominio del correo (bajatrout → BAJA TROUT, glaciarsur → GLACIARSUR, multi-xsalmon → Multiexport)
// y por compartir el mismo id_empresa erróneo (3223 con 3222). 3220 (gmail) y 3228 (sealand) quedan sin cargar.
// contacto (id legado) → servicio (id legado). Lo usan el cargador y el motor de sincronización.
export const CONTACTO_MANUAL = new Map([[3203, 684], [3204, 684], [3205, 684], [3221, 688], [3222, 685], [3223, 685]]);
