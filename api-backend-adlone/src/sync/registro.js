// Registro de las tablas del legado que el motor sincroniza hacia el esquema nuevo.
//
//   tabla   nombre en el legado
//   modulo  módulo destino (se puede sincronizar uno solo con --modulo)
//   modo    'fila'  → la unidad de cambio es una fila (clave primaria `pk`)
//           'grupo' → tablas del legado SIN clave primaria: la unidad es un grupo de filas (`unidad`), p. ej. todas las
//                     filas de una ficha; si cambia cualquiera, se vuelve a copiar el grupo completo
//   orden   orden de dependencia: los padres tienen número menor. Las altas/cambios se aplican de menor a mayor y los
//           borrados de mayor a menor, para no violar claves foráneas.
export const REGISTRO = [
  // geo_ — geografía (catálogos planos; las comunas dependen de las regiones)
  { tabla: 'mae_region', modulo: 'geo', modo: 'fila', pk: ['id_region'], orden: 10 },
  { tabla: 'mae_comuna', modulo: 'geo', modo: 'fila', pk: ['id_comuna'], orden: 11 },
  { tabla: 'mae_zonas', modulo: 'geo', modo: 'fila', pk: ['id_zona'], orden: 12 },
  { tabla: 'mae_zonageografica', modulo: 'geo', modo: 'fila', pk: ['id_zonageografica'], orden: 13 },
  { tabla: 'mae_tipoagua', modulo: 'geo', modo: 'fila', pk: ['id_tipoagua'], orden: 14 },
  { tabla: 'mae_zonautm', modulo: 'geo', modo: 'fila', pk: ['id_zonautm'], orden: 15 },
  { tabla: 'mae_umedida', modulo: 'geo', modo: 'fila', pk: ['id_umedida'], orden: 16 },
  { tabla: 'mae_barrio', modulo: 'geo', modo: 'fila', pk: ['id_barrio'], orden: 17 },
  // cat_ — catálogo de servicios (técnicas de Medio Ambiente, normativas y límites)
  { tabla: 'mae_seccion', modulo: 'cat', modo: 'fila', pk: ['id_seccion'], orden: 190 },
  { tabla: 'mae_tecnica', modulo: 'cat', modo: 'fila', pk: ['id_tecnica'], orden: 200 },
  { tabla: 'mae_Normativa', modulo: 'cat', modo: 'fila', pk: ['id_normativa'], orden: 210 },
  { tabla: 'mae_NormativaReferencia', modulo: 'cat', modo: 'fila', pk: ['id_normativareferencia'], orden: 211 },
  { tabla: 'App_Ma_ReferenciaAnalisis', modulo: 'cat', modo: 'fila', pk: ['id_referenciaanalisis'], orden: 220 },

  // per_ — personal de terreno (cargos y competencias; personas desde muestreadores; inspectores/coordinadores/jefaturas son roles)
  { tabla: 'mae_cargo', modulo: 'per', modo: 'fila', pk: ['id_cargo'], orden: 30 },
  { tabla: 'mae_competencia', modulo: 'per', modo: 'fila', pk: ['id_competencia'], orden: 31 },
  { tabla: 'mae_muestreador', modulo: 'per', modo: 'fila', pk: ['id_muestreador'], orden: 40 },
  { tabla: 'mae_inspectorambiental', modulo: 'per', modo: 'fila', pk: ['id_inspectorambiental'], orden: 41 },
  { tabla: 'mae_coordinador', modulo: 'per', modo: 'fila', pk: ['id_coordinador'], orden: 42 },
  { tabla: 'mae_jefaturatecnica', modulo: 'per', modo: 'fila', pk: ['id_jefaturatecnica'], orden: 43 },
  // usr_ — usuarios, roles y permisos (PK compuesta en las dos tablas de relación)
  { tabla: 'mae_rol', modulo: 'usr', modo: 'fila', pk: ['id_rol'], orden: 300 },
  { tabla: 'mae_permiso', modulo: 'usr', modo: 'fila', pk: ['id_permiso'], orden: 301 },
  { tabla: 'rel_rol_permiso', modulo: 'usr', modo: 'fila', pk: ['id_rol', 'id_permiso'], orden: 310 },
  { tabla: 'mae_usuario', modulo: 'usr', modo: 'fila', pk: ['id_usuario'], orden: 320 },
  { tabla: 'rel_usuario_rol', modulo: 'usr', modo: 'fila', pk: ['id_usuario', 'id_rol'], orden: 330 },
  // eqp_ — equipos
  { tabla: 'mae_equipo_catalogo', modulo: 'eqp', modo: 'fila', pk: ['id_equipocatalogo'], orden: 400 },
  { tabla: 'mae_equipo', modulo: 'eqp', modo: 'fila', pk: ['id_equipo'], orden: 410 },
  { tabla: 'mae_equipo_historial', modulo: 'eqp', modo: 'fila', pk: ['id_historial'], orden: 420 },
  // cli_ — clientes: empresa → servicio → centro / contacto (los servicios y centros dependen de las empresas)
  { tabla: 'mae_empresa', modulo: 'cli', modo: 'fila', pk: ['id_empresa'], orden: 500 },
  { tabla: 'mae_empresaservicios', modulo: 'cli', modo: 'fila', pk: ['id_empresaservicio'], orden: 510 },
  { tabla: 'mae_centro', modulo: 'cli', modo: 'fila', pk: ['id_centro'], orden: 520 },
  { tabla: 'mae_contacto', modulo: 'cli', modo: 'fila', pk: ['id_contacto'], orden: 530 },
  // per_ — competencias y documentos de las personas (sin filas hoy)
  { tabla: 'mae_muestreador_competencia', modulo: 'per', modo: 'fila', pk: ['id_muestreador', 'id_competencia'], orden: 44 },
  { tabla: 'mae_muestreador_documento', modulo: 'per', modo: 'fila', pk: ['id_documento'], orden: 45 },
  // sol_ — hijas de las solicitudes (sin filas hoy): equipos, derivaciones, comentarios y adjuntos
  { tabla: 'mae_solicitud_equipo', modulo: 'sol', modo: 'fila', pk: ['id_solicitud'], orden: 140 },
  { tabla: 'mae_solicitud_derivacion', modulo: 'sol', modo: 'fila', pk: ['id_derivacion'], orden: 141 },
  { tabla: 'mae_solicitud_comentario', modulo: 'sol', modo: 'fila', pk: ['id_comentario'], orden: 142 },
  { tabla: 'mae_solicitud_adjunto', modulo: 'sol', modo: 'fila', pk: ['id_adjunto'], orden: 143 },
  // fic_ — catálogos de la ficha (antes que las fichas y los precios)
  { tabla: 'mae_lugaranalisis', modulo: 'fic', modo: 'fila', pk: ['id_lugaranalisis'], orden: 550 },
  { tabla: 'mae_objetivomuestreo_ma', modulo: 'fic', modo: 'fila', pk: ['id_objetivomuestreo_ma'], orden: 551 },
  { tabla: 'mae_instrumentoambiental', modulo: 'fic', modo: 'fila', pk: ['id'], orden: 552 },
  { tabla: 'mae_tipomuestreo', modulo: 'fic', modo: 'fila', pk: ['id_tipomuestreo'], orden: 553 },
  { tabla: 'mae_tipomuestra_ma', modulo: 'fic', modo: 'fila', pk: ['id_tipomuestra_ma'], orden: 554 },
  { tabla: 'mae_tipomuestra', modulo: 'fic', modo: 'fila', pk: ['id_tipomuestra'], orden: 555 },
  { tabla: 'mae_subarea', modulo: 'fic', modo: 'fila', pk: ['id_subarea'], orden: 556 },
  { tabla: 'mae_actividadmuestreo', modulo: 'fic', modo: 'fila', pk: ['id_actividadmuestreo'], orden: 557 },
  { tabla: 'mae_tipodescarga', modulo: 'fic', modo: 'fila', pk: ['id_tipodescarga'], orden: 558 },
  { tabla: 'mae_modalidad', modulo: 'fic', modo: 'fila', pk: ['id_modalidad'], orden: 559 },
  { tabla: 'mae_formacanal', modulo: 'fic', modo: 'fila', pk: ['id_formacanal'], orden: 560 },
  { tabla: 'mae_dispositivohidraulico', modulo: 'fic', modo: 'fila', pk: ['id_dispositivohidraulico'], orden: 561 },
  { tabla: 'mae_frecuencia', modulo: 'fic', modo: 'fila', pk: ['id_frecuencia'], orden: 562 },
  { tabla: 'mae_laboratorioensayo', modulo: 'fic', modo: 'fila', pk: ['id_laboratorioensayo'], orden: 563 },
  { tabla: 'mae_tipoentrega', modulo: 'fic', modo: 'fila', pk: ['id_tipoentrega'], orden: 564 },
  { tabla: 'mae_transporte', modulo: 'fic', modo: 'fila', pk: ['id_transporte'], orden: 565 },
  // fac_ — precios (convenios y tarifas) y documentos (ids conservados; caso/OC/emisión dependen de las prefacturas y de fic_)
  { tabla: 'fac_valor_uf', modulo: 'fac', modo: 'fila', pk: ['id_uf'], orden: 600 },
  { tabla: 'fac_cliente_config', modulo: 'fac', modo: 'fila', pk: ['id_config'], orden: 601 },
  { tabla: 'fac_convenio', modulo: 'fac', modo: 'fila', pk: ['id_convenio'], orden: 610 },
  { tabla: 'fac_tarifa', modulo: 'fac', modo: 'fila', pk: ['id_tarifa'], orden: 611 },
  { tabla: 'fac_lote_emision', modulo: 'fac', modo: 'fila', pk: ['id_lote'], orden: 620 },
  { tabla: 'fac_cotizacion', modulo: 'fac', modo: 'fila', pk: ['id_cotizacion'], orden: 630 },
  { tabla: 'fac_cotizacion_seccion', modulo: 'fac', modo: 'fila', pk: ['id_seccion'], orden: 631 },
  { tabla: 'fac_cotizacion_item', modulo: 'fac', modo: 'fila', pk: ['id_item'], orden: 632 },
  { tabla: 'fac_cotizacion_portal_solicitud', modulo: 'fac', modo: 'fila', pk: ['id_solicitud_portal'], orden: 633 },
  { tabla: 'fac_prefactura', modulo: 'fac', modo: 'fila', pk: ['id_prefactura'], orden: 640 },
  { tabla: 'fac_prefactura_caso', modulo: 'fac', modo: 'fila', pk: ['id_pf_caso'], orden: 700 },
  { tabla: 'fac_orden_compra', modulo: 'fac', modo: 'fila', pk: ['id_oc'], orden: 710 },
  { tabla: 'fac_emision', modulo: 'fac', modo: 'fila', pk: ['id_emision'], orden: 720 },
  { tabla: 'fac_oc_candidato', modulo: 'fac', modo: 'fila', pk: ['id_candidato'], orden: 730 },
  { tabla: 'fac_historial', modulo: 'fac', modo: 'fila', pk: ['id_historial'], orden: 740 },
  // fic_ — fichas: ficha → análisis → visitas (con procesos y mediciones) → resultados → uso de equipos. Las tres tablas del legado sin PK se
  // sincronizan por grupo (todas las filas de una ficha). Antes de fac_prefactura_caso (700), que apunta a las visitas.
  { tabla: 'App_Ma_FichaIngresoServicio_ENC', modulo: 'fic', modo: 'fila', pk: ['id_fichaingresoservicio'], orden: 650 },
  { tabla: 'mae_ficha_historial', modulo: 'fic', modo: 'fila', pk: ['id_historial'], orden: 655 },
  { tabla: 'App_Ma_FichaIngresoServicio_DET', modulo: 'fic', modo: 'grupo', unidad: ['id_fichaingresoservicio'], orden: 660 },
  { tabla: 'App_Ma_Agenda_MUESTREOS', modulo: 'fic', modo: 'fila', pk: ['id_agendamam'], orden: 670 },
  { tabla: 'App_Ma_Documentos_Enviados', modulo: 'fic', modo: 'fila', pk: ['id_envio'], orden: 671 },
  { tabla: 'App_Ma_Resultados', modulo: 'fic', modo: 'grupo', unidad: ['id_fichaingresoservicio'], orden: 680 },
  { tabla: 'App_Ma_Equipos_MUESTREOS', modulo: 'fic', modo: 'grupo', unidad: ['id_fichaingresoservicio'], orden: 690 },
  // rut_ — rutas planificadas y su ejecución (depende de fic_ficha/fic_visita: va al final)
  { tabla: 'mae_grupos_rutas', modulo: 'rut', modo: 'fila', pk: ['id_grupo'], orden: 900 },
  { tabla: 'mae_rutas_planificadas', modulo: 'rut', modo: 'fila', pk: ['id_ruta_planificada'], orden: 901 },
  { tabla: 'mae_rutas_planificadas_detalle', modulo: 'rut', modo: 'fila', pk: ['id_ruta_detalle'], orden: 902 },
  { tabla: 'mae_rutas_ejecuciones', modulo: 'rut', modo: 'fila', pk: ['id_ejecucion'], orden: 903 },
  { tabla: 'mae_rutas_ejecuciones_detalle', modulo: 'rut', modo: 'fila', pk: ['id_detalle_ejec'], orden: 904 },
  // sol_ — solicitudes (URS)
  { tabla: 'mae_solicitud_tipo', modulo: 'sol', modo: 'fila', pk: ['id_tipo'], orden: 100 },
  { tabla: 'rel_solicitud_tipo_permiso', modulo: 'sol', modo: 'fila', pk: ['id_permiso_sol'], orden: 110 },
  { tabla: 'rel_solicitud_tipo_notificacion', modulo: 'sol', modo: 'fila', pk: ['id_config_notif'], orden: 111 },
  { tabla: 'mae_solicitud', modulo: 'sol', modo: 'fila', pk: ['id_solicitud'], orden: 120 },
  { tabla: 'mae_solicitud_historial', modulo: 'sol', modo: 'fila', pk: ['id_historial'], orden: 130 },
];
