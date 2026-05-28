/* Generates "Plan de Pruebas ADL ONE.xlsx" with ExcelJS */
const path = require('path');
const ExcelJS = require(path.join(__dirname, 'frontend-adlone', 'node_modules', 'exceljs'));

const OUT = path.join(__dirname, 'Plan_de_Pruebas_ADL_ONE.xlsx');

// ---------- Test cases ----------
// Columns: [ID, Modulo, Submodulo, Funcionalidad, Escenario, PreRequisitos, Pasos, ResultadoEsperado, Tipo, Prioridad]
const cases = [];
let nId = 0;
const add = (mod, sub, func, esc, pre, pasos, exp, tipo, prio) => {
  nId += 1;
  const id = 'TC-' + String(nId).padStart(3, '0');
  cases.push([id, mod, sub, func, esc, pre, pasos, exp, tipo, prio]);
};

// ===== 1. Autenticación y Sesiones =====
const M1 = '1. Autenticación y Sesiones';
add(M1, 'Login', 'Validación de credenciales', 'Login exitoso con credenciales válidas',
  'Usuario activo registrado',
  '1. Ir a /login\n2. Ingresar email y contraseña válidos\n3. Click "Iniciar sesión"',
  'Redirige al WelcomePage / Dashboard, token guardado, header Authorization seteado en axios.',
  'Funcional', 'Alta');
add(M1, 'Login', 'Validación de credenciales', 'Login con contraseña incorrecta',
  'Usuario activo registrado',
  '1. /login\n2. Email correcto + contraseña errada\n3. Submit',
  'Mensaje de error claro ("Credenciales inválidas"). No se almacena token. No redirige.',
  'Funcional', 'Alta');
add(M1, 'Login', 'Validación de credenciales', 'Login con email inexistente',
  '—',
  '1. /login\n2. Email no registrado + cualquier contraseña\n3. Submit',
  'Error 401 con mensaje genérico (no debe revelar si el email existe). No se guarda token.',
  'Seguridad', 'Alta');
add(M1, 'Login', 'Validación de credenciales', 'Login con campos vacíos',
  '—',
  '1. /login\n2. Click Submit con campos vacíos',
  'Validación cliente impide envío. Mensajes de "campo requerido".',
  'UI', 'Media');
add(M1, 'Login', 'Validación de credenciales', 'Login de usuario deshabilitado',
  'Usuario marcado como inactivo en DB',
  '1. /login\n2. Credenciales válidas pero usuario inactivo',
  'Backend devuelve error y bloquea el acceso. Mensaje claro.',
  'Seguridad', 'Alta');
add(M1, 'Sesión', 'Lógica de "Recordarme"', 'Persistencia con Recordarme activado',
  'Usuario válido',
  '1. Login marcando "Recordarme"\n2. Cerrar pestaña/navegador\n3. Reabrir y entrar a la app',
  'Token persiste en localStorage. Sesión activa al reabrir, sin pedir login.',
  'Funcional', 'Alta');
add(M1, 'Sesión', 'Lógica de "Recordarme"', 'Sin "Recordarme" — sesión efímera',
  '—',
  '1. Login sin marcar "Recordarme"\n2. Cerrar pestaña\n3. Reabrir',
  'Token en sessionStorage. Al cerrar la pestaña la sesión se pierde.',
  'Funcional', 'Alta');
add(M1, 'Sesión', 'Auto-logout', 'Token expirado o inválido',
  'Sesión iniciada',
  '1. Alterar/expirar el token en storage\n2. Disparar cualquier request autenticado',
  'Interceptor de axios captura 401/403 y ejecuta logout automático. Redirige a /login.',
  'Seguridad', 'Alta');
add(M1, 'Sesión', 'Cierre de sesión', 'Logout manual',
  'Sesión iniciada',
  '1. Click en "Cerrar sesión" en el sidebar/menú usuario',
  'Limpia local/sessionStorage. Resetea AuthContext y navegación. Redirige a /login.',
  'Funcional', 'Alta');
add(M1, 'Sesión', 'Recarga de página', 'Mantener sesión al recargar (F5)',
  'Sesión activa',
  '1. Estando logueado, recargar la página',
  'Vuelve a cargar la sesión desde storage. No pide credenciales. Permisos cargan ok.',
  'Funcional', 'Alta');
add(M1, 'Password Reset', 'Solicitud de restablecimiento', 'Solicitar reset con email válido',
  '—',
  '1. /login → "¿Olvidaste tu contraseña?"\n2. Ingresar email registrado\n3. Submit',
  'Confirmación de "enviado". Email llega con link de reset y token válido (S-13/S-14).',
  'Funcional', 'Alta');
add(M1, 'Password Reset', 'Solicitud de restablecimiento', 'Solicitar reset con email no registrado',
  '—',
  '1. Solicitar reset con email inexistente',
  'Respuesta genérica (no revela existencia). Sin email enviado.',
  'Seguridad', 'Alta');
add(M1, 'Password Reset', 'Aplicar nuevo password', 'Reset con token válido',
  'Link de reset recibido',
  '1. Abrir link\n2. Ingresar nueva contraseña + confirmación\n3. Submit',
  'Contraseña cambia. Token queda invalidado. Redirige a login.',
  'Funcional', 'Alta');
add(M1, 'Password Reset', 'Aplicar nuevo password', 'Reset con token expirado/usado',
  'Link de reset usado previamente o vencido',
  '1. Reabrir el link ya usado/vencido\n2. Intentar setear nueva contraseña',
  'Mensaje claro de token inválido. No permite cambiar la contraseña (S-15/S-16/S-17).',
  'Seguridad', 'Alta');
add(M1, 'Password Reset', 'Aplicar nuevo password', 'Validación de fortaleza de password',
  '—',
  '1. En reset, ingresar contraseñas débiles (corta, sin números, etc.)',
  'Frontend y/o backend rechazan. Mensajes claros de requisitos.',
  'Seguridad', 'Media');

// ===== 2. Carga inicial / Permisos del usuario =====
const M2 = '2. Carga inicial y RBAC';
add(M2, 'Bootstrap', 'Carga del perfil tras login', 'Usuario y permisos disponibles',
  'Login exitoso',
  '1. Tras login, verificar Network → /me o equivalente\n2. Verificar permissions[] en AuthContext',
  'Usuario, roles y permissions cargan. hasPermission() responde correctamente.',
  'Integración', 'Alta');
add(M2, 'Sidebar', 'Render según permisos', 'Sidebar muestra solo módulos permitidos',
  'Usuario con permisos limitados (ej. solo MA_ACCESO)',
  '1. Login\n2. Observar sidebar',
  'Solo aparecen módulos a los que tiene acceso. Admin/Informática ocultos si no aplica.',
  'Seguridad', 'Alta');
add(M2, 'Routing Guard', 'Protección de submódulos', 'Acceso directo a submódulo restringido',
  'Usuario sin permiso para admin',
  '1. Forzar setActiveSubmodule a "admin-users" sin permisos',
  'DashboardPage detecta falta de permiso y ejecuta resetNavigation(). No muestra contenido.',
  'Seguridad', 'Alta');
add(M2, 'ProtectedContent', 'Componente de gate', 'Render condicional por permiso',
  '—',
  '1. Loguearse con/sin permisos específicos y abrir vistas protegidas',
  'ProtectedContent oculta contenido o muestra fallback cuando no hay permiso.',
  'Seguridad', 'Alta');
add(M2, 'Super-admin', 'AI_MA_ADMIN_ACCESO', 'Bypass de super-admin (si aplica)',
  'Usuario con AI_MA_ADMIN_ACCESO',
  '1. Verificar acceso a vistas restringidas',
  'Tiene acceso total como bypass. (Confirmar si sigue activo: nota en código RB-08 lo removió en ciertas guardas.)',
  'Seguridad', 'Media');

// ===== 3. Perfil =====
const M3 = '3. Perfil de usuario';
add(M3, 'Visualización', 'Datos del usuario', 'Información correcta del perfil',
  'Sesión activa',
  '1. Ir a Perfil\n2. Revisar nombre, email, rol, foto, firma',
  'Datos coinciden con DB. Foto/firma renderizan correctamente.',
  'Funcional', 'Media');
add(M3, 'Edición', 'Actualización de datos', 'Editar campos editables',
  'Sesión activa',
  '1. Editar nombre/teléfono/etc.\n2. Guardar',
  'Persistencia en backend. Toast de éxito. Datos se reflejan al recargar.',
  'Funcional', 'Media');
add(M3, 'Firma', 'Carga de firma', 'Subir imagen de firma',
  '—',
  '1. Profile → subir archivo PNG/JPG válido\n2. Guardar',
  'Imagen se guarda y muestra. Tamaño/tipo validado.',
  'Funcional', 'Alta');
add(M3, 'Firma', 'Firma manual (canvas)', 'Dibujar firma desde el dispositivo',
  '—',
  '1. Profile → opción de dibujar firma\n2. Trazar\n3. Guardar',
  'Firma se persiste como imagen base64/blob. Se asocia al usuario.',
  'Funcional', 'Alta');
add(M3, 'Cambio password', 'Cambio de contraseña desde perfil', 'Cambio con contraseña actual válida',
  'Sesión activa',
  '1. Profile → cambiar password\n2. Ingresar actual + nueva\n3. Guardar',
  'Backend valida actual, persiste nueva. Sesión se mantiene o pide re-login según diseño.',
  'Seguridad', 'Alta');

// ===== 4. Notificaciones =====
const M4 = '4. Notificaciones';
add(M4, 'Socket.IO', 'Conexión en vivo', 'Conexión al iniciar sesión',
  'Login exitoso',
  '1. Login\n2. DevTools → WS → ver conexión socket\n3. Verificar join al room user_<id>',
  'Socket conecta. Cliente une al room user_<id>. Reconnect on disconnect.',
  'Integración', 'Alta');
add(M4, 'Emisión', 'Recepción en tiempo real', 'Notificación emitida desde backend llega al cliente',
  'Sesión activa, otro usuario o trigger backend',
  '1. Disparar evento (ej. nueva solicitud asignada)\n2. Observar GlobalNotificationHub',
  'Notificación aparece en tiempo real sin recargar. Contador se actualiza.',
  'Integración', 'Alta');
add(M4, 'UI', 'Popover y panel', 'Apertura del popover de notificaciones',
  'Sesión activa con notificaciones',
  '1. Click en icono de campana',
  'Popover muestra lista con últimas notificaciones. Estado leído/no leído visible.',
  'UI', 'Media');
add(M4, 'Marcar leídas', 'Persistencia', 'Marcar individual y todas como leídas',
  '—',
  '1. Click en notificación → leída\n2. Botón "Marcar todas"',
  'Estado se actualiza en backend. Contador disminuye. Persiste al recargar.',
  'Funcional', 'Media');
add(M4, 'Deep-link', 'Navegación desde notificación', 'Click en notificación abre la entidad',
  'Notificación de solicitud / ficha',
  '1. Click en notificación de URS\n2. App debe abrir el detalle correspondiente',
  'Navegación se ejecuta vía pendingRequestId / pendingChatId. Abre la vista correcta.',
  'Funcional', 'Alta');
add(M4, 'Ocultar', 'hiddenNotifications', 'Ocultar notificación persistente',
  '—',
  '1. Descartar una notificación contextual\n2. Recargar página',
  'Permanece oculta (lista hiddenNotifications en navStore se persiste).',
  'Funcional', 'Baja');
add(M4, 'Página', 'UserNotificationsPage', 'Listado completo con filtros',
  '—',
  '1. Abrir página de notificaciones\n2. Filtrar/buscar',
  'Lista paginada, filtros funcionales, navegación a entidades correcta.',
  'Funcional', 'Media');
add(M4, 'Push fuera de app', 'Notificaciones con app cerrada', 'Recepción sin la pestaña abierta',
  '—',
  '1. Cerrar todas las pestañas\n2. Disparar evento desde backend',
  'NO implementado en la app web (no hay Service Worker / Push API). Documentar como pendiente si se requiere.',
  'Funcional', 'Informativo');

// ===== 5. Welcome / Dashboard / Navegación =====
const M5 = '5. Welcome y navegación';
add(M5, 'WelcomePage', 'Render por defecto', 'Vista inicial post-login',
  '—',
  '1. Login\n2. Observar contenido sin submódulo seleccionado',
  'WelcomePage se muestra como landing.',
  'UI', 'Media');
add(M5, 'Sidebar', 'Colapsado/Expandido', 'Toggle del sidebar',
  '—',
  '1. Click en toggle sidebar',
  'Persiste sidebarCollapsed en navStore. Layout se ajusta. Persistencia tras recarga.',
  'UI', 'Baja');
add(M5, 'Drawer', 'Drawer en mobile', 'Apertura/cierre del drawer',
  'Viewport mobile',
  '1. Abrir drawer en vista mobile\n2. Seleccionar submódulo',
  'Drawer cierra automáticamente al seleccionar submódulo.',
  'UI', 'Media');
add(M5, 'Reset', 'resetNavigation', 'Reset al perder permiso',
  '—',
  '1. Forzar pérdida de permiso\n2. resetNavigation debe ejecutarse',
  'Vuelve a estado default sin romper UI.',
  'Funcional', 'Media');

// ===== 6. Medio Ambiente - Fichas =====
const M6 = '6. Medio Ambiente — Fichas';
add(M6, 'Listado', 'FichasIngresoPage', 'Carga inicial del listado',
  'Permiso MA_ACCESO',
  '1. Ir a Fichas\n2. Verificar carga inicial',
  'Lista paginada. Estados de carga / vacío correctos.',
  'Funcional', 'Alta');
add(M6, 'Listado', 'Filtros y búsqueda', 'Buscar y filtrar fichas',
  'Fichas en DB',
  '1. Aplicar filtros (estado, fecha, búsqueda)',
  'Resultados coherentes. Combinación de filtros funciona.',
  'Funcional', 'Alta');
add(M6, 'Creación', 'FichaCreateForm manual', 'Crear ficha individual',
  'Permiso de creación',
  '1. Botón "Crear ficha"\n2. Elegir manual\n3. Completar todos los campos\n4. Submit',
  'Validaciones de campos requeridos. Persiste en backend. Aparece en listado. Toast éxito.',
  'Funcional', 'Alta');
add(M6, 'Creación', 'BulkFichaCreator', 'Carga masiva por Excel',
  'Template de carga masiva',
  '1. Subir archivo Excel válido\n2. BulkReviewGrid muestra preview\n3. Confirmar',
  'Valida filas (errores marcados). Crea solo las válidas. Reporta resultado.',
  'Funcional', 'Alta');
add(M6, 'Creación', 'BulkFichaCreator', 'Carga masiva con errores',
  '—',
  '1. Subir Excel con celdas inválidas o vacías obligatorias',
  'Cada error marcado por fila/columna. No inserta filas inválidas. Permite corregir y reintentar.',
  'Funcional', 'Alta');
add(M6, 'Detalle', 'FichaDetailView', 'Abrir detalle de ficha',
  '—',
  '1. Click en ficha del listado',
  'Detalle completo: antecedentes, análisis, observaciones, timeline. Datos coinciden con DB.',
  'Funcional', 'Alta');
add(M6, 'Detalle', 'Edición', 'Editar campos editables',
  'Permiso de edición',
  '1. Detalle → editar\n2. Guardar',
  'Cambios persisten. Timeline registra cambio. Otros usuarios ven cambios al refrescar.',
  'Funcional', 'Alta');
add(M6, 'Detalle', 'Cancelación de ficha', 'Cancelar una ficha',
  'Permiso adecuado',
  '1. Detalle → cancelar (con motivo)\n2. Confirmar',
  'Estado pasa a "Cancelada". Aparece marcada en listado. Acciones posteriores bloqueadas.',
  'Funcional', 'Alta');
add(M6, 'Exportar', 'FichaExportModal', 'Exportar ficha individual o lote',
  '—',
  '1. Click exportar\n2. Seleccionar opciones',
  'Archivo (PDF/Excel) generado con datos correctos. Descarga sin error.',
  'Funcional', 'Media');
add(M6, 'Calendario', 'CalendarioReplicaPage', 'Visualización en calendario',
  '—',
  '1. Ir a calendario\n2. Navegar meses',
  'Eventos / fichas se muestran en su fecha. Click navega al detalle.',
  'UI', 'Media');
add(M6, 'Remuestreo', 'RemuestreoPage', 'Crear remuestreo a partir de ficha',
  'Ficha existente',
  '1. Ir a remuestreo\n2. Seleccionar ficha origen\n3. Programar nuevo',
  'Genera nueva ficha hija con referencia a la original.',
  'Funcional', 'Alta');
add(M6, 'Asignaciones', 'AssignmentListView', 'Lista de asignaciones',
  '—',
  '1. Ir a "Asignaciones"',
  'Lista filtrable. Estado de asignación visible.',
  'Funcional', 'Media');
add(M6, 'Asignaciones', 'AssignmentDetailView', 'Detalle de asignación',
  '—',
  '1. Abrir una asignación',
  'Datos completos. Acciones disponibles según rol.',
  'Funcional', 'Alta');
add(M6, 'Asignaciones', 'AssignmentMapView', 'Mapa de asignaciones',
  '—',
  '1. Vista mapa',
  'Marcadores en coordenadas correctas. Click abre detalle.',
  'UI', 'Media');
add(M6, 'Coordinación', 'CoordinacionDashboardView', 'Dashboard coordinación',
  'Permiso coordinación',
  '1. Abrir vista coordinación',
  'KPIs y listas coherentes con backend.',
  'Funcional', 'Media');
add(M6, 'KPI', 'KpiAnalystDashboardView', 'Dashboard KPI analista',
  'Permiso KPI',
  '1. Abrir KPI',
  'Métricas correctas, filtros funcionales.',
  'Funcional', 'Media');
add(M6, 'Rutas', 'RouteMapPlannerView', 'Planificación de rutas',
  '—',
  '1. Abrir planner\n2. Seleccionar puntos\n3. Guardar ruta',
  'Ruta se genera, persiste y aparece en RutasListView.',
  'Funcional', 'Media');
add(M6, 'Empresas', 'EmpresaServicioFormView', 'Gestión de empresas/servicios',
  '—',
  '1. Crear/editar empresa+servicio',
  'CRUD funcional, validaciones, persistencia.',
  'Funcional', 'Media');
add(M6, 'Ejecutados', 'MuestreosEjecutadosListView', 'Lista de muestreos completados',
  'Permiso GEM_REALIZADO',
  '1. Ir a "Muestreos completados"',
  'Lista correcta. Filtros y búsqueda. Acceso al detalle.',
  'Funcional', 'Media');
add(M6, 'NuevaEjecucion', 'NuevaEjecucionModal', 'Registrar nueva ejecución',
  '—',
  '1. Abrir modal\n2. Completar y guardar',
  'Persistencia ok. Ficha asociada se actualiza.',
  'Funcional', 'Alta');
add(M6, 'Timeline', 'ObservationTimeline / SolicitudTimeline', 'Timeline de cambios',
  '—',
  '1. Detalle ficha o solicitud → timeline',
  'Eventos en orden cronológico con usuario/fecha.',
  'Funcional', 'Media');

// ===== 7. URS / Solicitudes =====
const M7 = '7. URS / Solicitudes';
add(M7, 'Inbox', 'UniversalInbox', 'Carga inicial de recibidos',
  'Permiso URS',
  '1. Abrir inbox\n2. Tab "Recibidos"',
  'Lista paginada. Contador unread correcto. Loader/empty states correctos.',
  'Funcional', 'Alta');
add(M7, 'Inbox', 'Modo enviados', 'Cambio entre recibidos/enviados',
  '—',
  '1. SegmentedControl → "Enviados"',
  'Lista cambia a solicitudes enviadas por el usuario. ursInboxMode persiste.',
  'Funcional', 'Alta');
add(M7, 'Inbox', 'Filtros (estado, área, tipo, búsqueda)', 'Filtros combinados',
  '—',
  '1. Aplicar combinaciones de filtros\n2. Verificar resultado',
  'Resultados coherentes. ursFilters persiste tras volver a la página.',
  'Funcional', 'Alta');
add(M7, 'Inbox', 'Contador unread', 'ursUnreadCount',
  '—',
  '1. Recibir nueva solicitud\n2. Marcar como leída',
  'Contador se incrementa/decrementa en tiempo real (socket).',
  'Funcional', 'Alta');
add(M7, 'Detalle', 'RequestDetailPanel', 'Apertura del detalle',
  '—',
  '1. Click en una solicitud',
  'Panel muestra título, tipo, estado, datos del formulario, archivos adjuntos.',
  'Funcional', 'Alta');
add(M7, 'Detalle', 'RequestActivityAndChat', 'Chat y actividad de la solicitud',
  '—',
  '1. Abrir detalle\n2. Enviar mensaje en chat',
  'Mensaje se envía y aparece. Otros participantes lo reciben en vivo. Actividad registra acción.',
  'Integración', 'Alta');
add(M7, 'Nueva solicitud', 'NewRequestModal', 'Crear desde modal',
  '—',
  '1. Botón "Nueva"\n2. Elegir tipo\n3. Completar formulario\n4. Enviar',
  'Validaciones. Persiste. Notifica al área destino. Aparece en inbox del receptor.',
  'Funcional', 'Alta');
add(M7, 'Tipos', 'EquipoActivationForm', 'Tipo: Activación de equipo',
  '—',
  '1. Nueva solicitud → Activación\n2. Llenar campos\n3. Enviar',
  'Campos cargan desde catálogo correcto. Envío exitoso.',
  'Funcional', 'Alta');
add(M7, 'Tipos', 'EquipoBajaForm', 'Tipo: Baja de equipo',
  '—',
  '1. Nueva solicitud → Baja',
  'Igual al anterior con sus campos específicos.',
  'Funcional', 'Alta');
add(M7, 'Tipos', 'EquipoTraspasoForm', 'Tipo: Traspaso de equipo',
  '—',
  '1. Nueva → Traspaso',
  'Origen y destino válidos. Envía ok.',
  'Funcional', 'Alta');
add(M7, 'Tipos', 'NuevoEquipoForm', 'Tipo: Nuevo equipo',
  '—',
  '1. Nueva → Nuevo equipo',
  'Campos completos. Persiste y notifica.',
  'Funcional', 'Alta');
add(M7, 'Tipos', 'VigenciaExtensionForm', 'Tipo: Extensión de vigencia',
  '—',
  '1. Nueva → Vigencia',
  'Validación de fechas. Persiste.',
  'Funcional', 'Media');
add(M7, 'Tipos', 'ReporteProblemaForm', 'Tipo: Reporte de problema',
  '—',
  '1. Nueva → Reporte\n2. Adjuntar evidencia',
  'Subida de archivos ok. Persiste.',
  'Funcional', 'Alta');
add(M7, 'Tipos', 'MuestreadorDeactivationForm', 'Tipo: Desactivación de muestreador',
  '—',
  '1. Nueva → Desactivación de muestreador',
  'Persiste y notifica.',
  'Funcional', 'Media');
add(M7, 'Derivar', 'DeriveRequestModal', 'Derivar solicitud a otra área/usuario',
  'Permiso para derivar',
  '1. Detalle → Derivar\n2. Elegir destino + motivo\n3. Confirmar',
  'Solicitud cambia área/responsable. Timeline registra. Destino recibe notificación.',
  'Funcional', 'Alta');
add(M7, 'Estados', 'Transiciones de estado', 'Aprobar / rechazar / completar',
  'Permisos correspondientes',
  '1. Detalle → cambiar estado válido\n2. Confirmar',
  'Estado se actualiza. Notifica a interesados. Validación de transición correcta.',
  'Funcional', 'Alta');

// ===== 8. Admin / Información =====
const M8 = '8. Admin / Información';
add(M8, 'AdminInfoHub', 'Render Hub', 'Visualización del hub',
  'Permiso AI_ACCESO o equivalente',
  '1. Ir a Admin Información',
  'Hub muestra tarjetas de submódulos disponibles según permisos.',
  'UI', 'Media');
add(M8, 'Roles', 'RolesPage CRUD', 'Crear/editar/eliminar rol',
  'Permiso de admin',
  '1. Roles → crear\n2. Asignar permisos\n3. Guardar',
  'Rol persiste. Aparece en lista. Editar/eliminar funcionan con validación.',
  'Funcional', 'Alta');
add(M8, 'Roles', 'RoleModal', 'Modal de asignación de permisos',
  '—',
  '1. Editar rol → asignar/quitar permisos\n2. Guardar',
  'Permisos persisten correctamente. Usuarios con ese rol reflejan cambios al re-loguear.',
  'Funcional', 'Alta');
add(M8, 'Usuarios', 'UsersManagementPage', 'Lista, filtros y búsqueda',
  'Permiso admin',
  '1. Ir a usuarios\n2. Filtrar por rol/estado\n3. Buscar',
  'Lista paginada. Filtro por rol (commit reciente) funciona. Búsqueda ok.',
  'Funcional', 'Alta');
add(M8, 'Usuarios', 'UserRoleModal', 'Asignar/quitar rol a usuario',
  '—',
  '1. Editar usuario → modificar roles\n2. Guardar',
  'Roles se persisten. Usuario refleja nuevos permisos al re-loguear.',
  'Funcional', 'Alta');
add(M8, 'Usuarios', 'Crear / desactivar usuario', 'Alta y baja',
  '—',
  '1. Crear usuario nuevo + setear password inicial\n2. Desactivar usuario existente',
  'Email opcional de activación. Desactivado no puede loguearse.',
  'Funcional', 'Alta');
add(M8, 'Notificaciones', 'NotificationEventsPage / RecipientsPage', 'Configurar eventos y destinatarios',
  '—',
  '1. Configurar evento N\n2. Definir destinatarios por permiso/rol',
  'Persistencia ok. Disparo de evento envía a destinatarios correctos.',
  'Funcional', 'Alta');
add(M8, 'URS Admin', 'AdminUrsPage', 'CRUD tipos y permisos de solicitud',
  '—',
  '1. Crear/editar tipo de solicitud\n2. Definir permisos requeridos',
  'Tipos se reflejan al crear nueva solicitud. Permisos respetados (RequestTypePermissionsPage).',
  'Funcional', 'Alta');
add(M8, 'Menu Web', 'AdminMenuWebPage', 'Configuración del menú',
  '—',
  '1. Editar visibilidad de módulos\n2. Guardar',
  'Menú lateral refleja la configuración para los roles correspondientes.',
  'Funcional', 'Media');
add(M8, 'Maestros', 'MaestrosHub / MaestroDataManager', 'CRUD genérico catálogos',
  '—',
  '1. Abrir catálogo X\n2. Crear/editar/eliminar fila\n3. Aplicar filtros dinámicos',
  'CRUD funciona. Filtros dinámicos correctos.',
  'Funcional', 'Alta');
add(M8, 'Hub MA', 'AdminMaHub', 'Render y navegación',
  '—',
  '1. Admin → Medio Ambiente\n2. Navegar a subhubs',
  'Tarjetas y enlaces a Equipos/Muestreadores/Reportes.',
  'UI', 'Media');
add(M8, 'Hub GC', 'AdminGcHub', 'Render y navegación',
  'Permiso GC_ACCESO',
  '1. Admin → Gestión Calidad',
  'Tarjetas visibles solo con permiso.',
  'UI', 'Media');

// ===== 9. Equipos =====
const M9 = '9. Equipos';
add(M9, 'Lista', 'EquiposPage', 'Carga y agrupación por estado',
  'Permiso MA_A_GEST_EQUIPO o GC_ACCESO',
  '1. Ir a Gestión de equipos\n2. Observar grupos Operativos / Por vencer / Vencidos',
  'Conteo y orden correctos por fecha de vencimiento.',
  'Funcional', 'Alta');
add(M9, 'CRUD', 'EquipoForm / EquipoModal', 'Crear / editar equipo',
  '—',
  '1. Nuevo equipo\n2. Completar campos\n3. Guardar\n4. Editar luego',
  'Validaciones, persistencia, refleja en lista.',
  'Funcional', 'Alta');
add(M9, 'Catalogo', 'EquipoCatalogoView', 'Vista de catálogo',
  '—',
  '1. Abrir catálogo',
  'Render correcto. Acciones disponibles.',
  'UI', 'Media');
add(M9, 'Reporte problema', 'EquipmentRequestsModal / ReporteProblemaForm', 'Reportar problema desde equipo',
  '—',
  '1. Equipo → reportar problema\n2. Adjuntar info\n3. Enviar',
  'Crea solicitud URS asociada al equipo. Llega al área correcta.',
  'Funcional', 'Alta');
add(M9, 'Export', 'EquipmentExportModal', 'Exportar listado',
  '—',
  '1. Exportar lista (Excel/PDF)',
  'Archivo correcto descargado.',
  'Funcional', 'Media');
add(M9, 'Estados', 'Vencimientos', 'Lógica de "por vencer"',
  '—',
  '1. Equipo con fecha cercana al vencimiento (ej. <30 días)',
  'Aparece automáticamente en categoría "Por vencer".',
  'Funcional', 'Alta');

// ===== 10. Muestreadores =====
const M10 = '10. Muestreadores';
add(M10, 'CRUD', 'MuestreadoresPage / MuestreadorForm', 'Alta/edición',
  'Permiso MA_MUESTREADORES o GC_ACCESO',
  '1. Crear muestreador\n2. Editar después',
  'Validaciones y persistencia ok.',
  'Funcional', 'Alta');
add(M10, 'Desactivación', 'SamplerDeactivationModal', 'Desactivar muestreador',
  '—',
  '1. Desactivar con motivo\n2. Confirmar',
  'Estado cambia. Notificación a interesados. No aparece en selección de nuevas fichas.',
  'Funcional', 'Alta');
add(M10, 'Requests', 'SamplerRequestsModal', 'Solicitudes asociadas',
  '—',
  '1. Abrir solicitudes de un muestreador',
  'Lista filtrada de solicitudes URS relacionadas.',
  'Funcional', 'Media');

// ===== 11. Chat general =====
const M11 = '11. Chat';
add(M11, 'Sidebar', 'ChatSidebar', 'Lista de conversaciones',
  'Sesión activa',
  '1. Abrir módulo Chat',
  'Lista de conversaciones con último mensaje y unread count.',
  'Funcional', 'Media');
add(M11, 'Ventana', 'ChatWindow', 'Envío de mensajes',
  '—',
  '1. Abrir conversación\n2. Escribir + enviar',
  'Mensaje aparece. Receptor lo recibe en vivo (socket room chat_<conversationId>).',
  'Integración', 'Alta');
add(M11, 'Grupos', 'ChatGroupModal', 'Crear chat grupal',
  '—',
  '1. Crear grupo\n2. Agregar participantes',
  'Grupo creado. Participantes lo ven. Mensajes se distribuyen.',
  'Funcional', 'Media');
add(M11, 'Contactos', 'ContactProfileDrawer', 'Ver perfil de contacto',
  '—',
  '1. Click en avatar/contacto',
  'Drawer abre con datos del contacto.',
  'UI', 'Baja');
add(M11, 'Deep-link', 'pendingChatId', 'Abrir chat desde notificación',
  '—',
  '1. Notificación de chat → click',
  'Abre directamente la conversación correspondiente.',
  'Funcional', 'Media');

// ===== 12. Estadísticas / Reportes =====
const M12 = '12. Estadísticas y reportes';
add(M12, 'KPI', 'KpiAnalystDashboardView', 'Carga de datos',
  'Permiso KPI',
  '1. Abrir dashboard\n2. Aplicar filtros (fecha/área/etc.)',
  'Datos numéricos coherentes con DB. Filtros se aplican.',
  'Funcional', 'Alta');
add(M12, 'Coordinación', 'CoordinacionDashboardView', 'Render con datos',
  '—',
  '1. Abrir dashboard\n2. Cambiar filtros',
  'KPIs y listas refrescan.',
  'Funcional', 'Media');
add(M12, 'Online', 'Datos en línea', 'Refresco de datos',
  '—',
  '1. Disparar cambio en backend\n2. Refrescar dashboard',
  'Datos actualizados se reflejan. (Auto-refresh: validar si aplica.)',
  'Funcional', 'Media');

// ===== 13. Backend / Integración =====
const M13 = '13. Backend / Integración';
add(M13, 'API', 'apiClient (axios)', 'Authorization header automático',
  'Sesión activa',
  '1. Disparar cualquier request\n2. Inspeccionar header',
  'Authorization: Bearer <token> se inyecta automáticamente.',
  'Integración', 'Alta');
add(M13, 'API', 'Interceptor 401/403', 'Logout automático',
  '—',
  '1. Provocar respuesta 401 (token inválido)',
  'Interceptor ejecuta logout y redirige.',
  'Seguridad', 'Alta');
add(M13, 'Socket.IO', 'Reconexión', 'Caída y recuperación de conexión',
  '—',
  '1. Cortar red\n2. Restaurar red',
  'Socket reconecta automáticamente. Re-une a sus rooms.',
  'Integración', 'Alta');
add(M13, 'CORS / Config', 'VITE_API_URL', 'URL base correcta',
  '—',
  '1. Verificar Network → host coincide con config',
  'Sin errores CORS. Conexión a backend ok.',
  'Integración', 'Media');
add(M13, 'Health', '/health endpoint', 'Backend up',
  '—',
  '1. GET /health',
  'Responde 200 con estado healthy.',
  'Integración', 'Media');
add(M13, 'Scheduler', 'Tareas programadas backend', 'Notificaciones recurrentes',
  '—',
  '1. Verificar logs/disparos de scheduler\n2. Confirmar recepción cliente',
  'Notificaciones recurrentes llegan según configuración.',
  'Integración', 'Media');

// ===== 14. UI / UX transversal =====
const M14 = '14. UI/UX transversal';
add(M14, 'Responsive', 'Layout en mobile/tablet/desktop', 'Render adaptativo',
  '—',
  '1. Probar en breakpoints (320, 768, 1024, 1440)',
  'Sin overflow ni elementos cortados. Drawer en mobile, sidebar en desktop.',
  'UI', 'Media');
add(M14, 'Errores', 'ErrorPage', 'Pantalla de error global',
  '—',
  '1. Forzar error no controlado',
  'ErrorBoundary muestra ErrorPage. No queda en blanco.',
  'UI', 'Alta');
add(M14, 'Toasts', 'ToastContext', 'Notificaciones in-app',
  '—',
  '1. Disparar éxito/error desde varias acciones',
  'Toast se muestra y desaparece. Estilo consistente.',
  'UI', 'Media');
add(M14, 'Loading', 'Loaders / Skeletons', 'Estados de carga',
  '—',
  '1. Cargar listas grandes / conexión lenta',
  'Spinner o skeleton visible. No queda UI vacía sin feedback.',
  'UI', 'Media');
add(M14, 'Validaciones', 'Mantine forms', 'Mensajes de error de formularios',
  '—',
  '1. Enviar formularios incompletos/ inválidos',
  'Mensajes claros junto al campo. No envía al backend.',
  'UI', 'Media');

// ===== 15. No implementado / Fuera de alcance (documentar) =====
const M15 = '15. No implementado (revisar alcance)';
add(M15, 'Offline', 'Procesos instalación/retiro offline', 'Funcionalidad no presente',
  '—',
  '1. Revisar repo: no hay Service Worker / IndexedDB / cola de pendientes',
  'Documentar como pendiente o fuera de alcance para esta versión (web SPA).',
  'Informativo', 'Informativo');
add(M15, 'Almacenamiento', 'Limpieza inteligente del teléfono', 'No aplica (web)',
  '—',
  '1. N/A',
  'No es app móvil nativa. Si se requiere PWA, documentar.',
  'Informativo', 'Informativo');
add(M15, 'Tutorial', 'Onboarding primera vez', 'No implementado',
  '—',
  '1. No hay componente Tutorial en el código',
  'Pendiente: definir si se implementa. Considerar feature request.',
  'Informativo', 'Informativo');
add(M15, 'Push fuera de app', 'Web Push API', 'No implementado',
  '—',
  '1. No hay Service Worker registrado para push',
  'Documentar como pendiente si se requiere push real con app cerrada.',
  'Informativo', 'Informativo');
add(M15, 'Sincronización manual', 'Botón "Sincronizar"', 'No implementado',
  '—',
  '1. No hay UI explícita de sync manual',
  'Documentar. La app es online en vivo; refresco es automático.',
  'Informativo', 'Informativo');

// ---------- Build workbook ----------
const wb = new ExcelJS.Workbook();
wb.creator = 'ADL ONE QA';
wb.created = new Date();

// Sheet 1: Resumen
const s1 = wb.addWorksheet('Resumen', { views: [{ state: 'frozen', ySplit: 1 }] });
s1.columns = [
  { header: 'Módulo', key: 'mod', width: 38 },
  { header: 'Total casos', key: 't', width: 14 },
  { header: 'Alta', key: 'a', width: 10 },
  { header: 'Media', key: 'm', width: 10 },
  { header: 'Baja', key: 'b', width: 10 },
  { header: 'Informativos', key: 'i', width: 14 }
];
const counts = {};
cases.forEach(c => {
  const mod = c[1], pri = c[9];
  counts[mod] = counts[mod] || { t: 0, a: 0, m: 0, b: 0, i: 0 };
  counts[mod].t += 1;
  if (pri === 'Alta') counts[mod].a += 1;
  else if (pri === 'Media') counts[mod].m += 1;
  else if (pri === 'Baja') counts[mod].b += 1;
  else counts[mod].i += 1;
});
Object.keys(counts).forEach(mod => {
  const v = counts[mod];
  s1.addRow({ mod, t: v.t, a: v.a, m: v.m, b: v.b, i: v.i });
});
const totalRow = s1.addRow({
  mod: 'TOTAL',
  t: cases.length,
  a: cases.filter(c => c[9] === 'Alta').length,
  m: cases.filter(c => c[9] === 'Media').length,
  b: cases.filter(c => c[9] === 'Baja').length,
  i: cases.filter(c => c[9] === 'Informativo').length
});
totalRow.font = { bold: true };
totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4FC' } };

s1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
s1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
s1.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

// Sheet 2: Casos de Prueba
const s2 = wb.addWorksheet('Casos de Prueba', { views: [{ state: 'frozen', ySplit: 1 }] });
s2.columns = [
  { header: 'ID', key: 'id', width: 9 },
  { header: 'Módulo', key: 'mod', width: 28 },
  { header: 'Submódulo / Vista', key: 'sub', width: 28 },
  { header: 'Funcionalidad', key: 'func', width: 32 },
  { header: 'Escenario / Caso', key: 'esc', width: 38 },
  { header: 'Pre-requisitos', key: 'pre', width: 28 },
  { header: 'Pasos', key: 'pasos', width: 50 },
  { header: 'Resultado esperado', key: 'exp', width: 50 },
  { header: 'Tipo', key: 'tipo', width: 14 },
  { header: 'Prioridad', key: 'prio', width: 12 },
  { header: 'Resultado (OK/NOK)', key: 'res', width: 18 },
  { header: 'Tester', key: 'tester', width: 16 },
  { header: 'Fecha', key: 'fecha', width: 12 },
  { header: 'Bug ID', key: 'bug', width: 12 },
  { header: 'Observaciones', key: 'obs', width: 40 }
];

cases.forEach(c => {
  const row = s2.addRow({
    id: c[0], mod: c[1], sub: c[2], func: c[3], esc: c[4],
    pre: c[5], pasos: c[6], exp: c[7], tipo: c[8], prio: c[9],
    res: '', tester: '', fecha: '', bug: '', obs: ''
  });
  row.alignment = { vertical: 'top', wrapText: true };
  // Color por prioridad
  const colorByPrio = {
    'Alta': 'FFFCE4E4',
    'Media': 'FFFFF4CE',
    'Baja': 'FFE8F5E9',
    'Informativo': 'FFEFEFEF'
  };
  const fill = colorByPrio[c[9]];
  if (fill) row.getCell('prio').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
});

s2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
s2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
s2.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
s2.getRow(1).height = 32;

// Data validations on result column
for (let i = 2; i <= cases.length + 1; i++) {
  s2.getCell(`K${i}`).dataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: ['"OK,NOK,Bloqueado,N/A,Pendiente"']
  };
}

// Autofilter
s2.autoFilter = { from: { row: 1, column: 1 }, to: { row: cases.length + 1, column: 15 } };

// Sheet 3: Bugs / Hallazgos
const s3 = wb.addWorksheet('Bugs y Hallazgos', { views: [{ state: 'frozen', ySplit: 1 }] });
s3.columns = [
  { header: 'Bug ID', key: 'id', width: 10 },
  { header: 'TC ID', key: 'tc', width: 10 },
  { header: 'Módulo', key: 'mod', width: 24 },
  { header: 'Resumen', key: 'res', width: 40 },
  { header: 'Severidad', key: 'sev', width: 12 },
  { header: 'Reproducible', key: 'rep', width: 14 },
  { header: 'Pasos para reproducir', key: 'pasos', width: 48 },
  { header: 'Resultado actual', key: 'act', width: 36 },
  { header: 'Resultado esperado', key: 'exp', width: 36 },
  { header: 'Asignado a', key: 'asign', width: 16 },
  { header: 'Estado', key: 'est', width: 14 },
  { header: 'Fecha', key: 'fecha', width: 12 }
];
s3.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
s3.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC00000' } };
s3.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
for (let i = 2; i <= 50; i++) {
  s3.getCell(`E${i}`).dataValidation = {
    type: 'list', allowBlank: true,
    formulae: ['"Crítica,Alta,Media,Baja"']
  };
  s3.getCell(`K${i}`).dataValidation = {
    type: 'list', allowBlank: true,
    formulae: ['"Abierto,En análisis,En desarrollo,Resuelto,Cerrado,Rechazado"']
  };
}

// Sheet 4: Notas
const s4 = wb.addWorksheet('Notas');
s4.getColumn('A').width = 110;
const notas = [
  'PLAN DE PRUEBAS — ADL ONE',
  '',
  'Alcance: SPA web (React 19 + Vite + TypeScript) + API Node/Express + SQL Server + Socket.IO.',
  '',
  'Mejoras al plan original:',
  '  • Cobertura ampliada por feature: Fichas (manual + carga masiva), URS (7 tipos de formulario), Admin (Roles, Users, Maestros, Notificaciones, Menu Web, URS Admin), Equipos, Muestreadores, Chat.',
  '  • Se agregaron escenarios de seguridad (token expirado, password reset con token usado/vencido, login revelación de existencia de email, guards de routing por permiso).',
  '  • Se desglosó "Notificaciones" en: conexión Socket.IO, recepción en vivo, deep-link, persistencia hiddenNotifications, popover.',
  '  • Se agregó RBAC como bloque transversal con casos de gates y guards.',
  '  • Se incluyó integración (interceptor 401/403, reconexión socket, /health).',
  '  • UI/UX transversal: responsive, loaders, toasts, ErrorPage.',
  '',
  'Items del plan original NO encontrados en el código (módulo 15 "No implementado"):',
  '  • Modo offline para procesos de instalación/retiro (no hay Service Worker / IndexedDB / cola de pendientes).',
  '  • Almacenamiento del teléfono / limpieza inteligente (no es app móvil nativa).',
  '  • Tutorial primera vez (no hay componente Tutorial).',
  '  • Notificaciones push con la app cerrada (no hay Service Worker registrado).',
  '  • Sincronización manual de fichas (la app trabaja online en vivo).',
  '  Estos puntos quedan documentados como pendientes o fuera de alcance; revisar con el equipo si deben ser implementados.',
  '',
  'Cómo usar este Excel:',
  '  1. Hoja "Casos de Prueba": ejecutar uno por uno. Completar columnas Resultado, Tester, Fecha, Bug ID, Observaciones.',
  '  2. Si falla → registrar el bug en la hoja "Bugs y Hallazgos" y poner el Bug ID en el caso.',
  '  3. La hoja "Resumen" da una vista por módulo. Actualizable manualmente al cierre.',
  '',
  'Convenciones de prioridad:',
  '  Alta = bloqueante o flujo crítico (login, crear ficha, enviar solicitud, RBAC).',
  '  Media = afecta UX o secundario.',
  '  Baja = cosmético o edge cases.',
  '  Informativo = documentación / pendientes / fuera de alcance.'
];
notas.forEach((t, idx) => {
  const row = s4.addRow([t]);
  if (idx === 0) {
    row.font = { bold: true, size: 14 };
  } else if (t.endsWith(':') || /^[A-ZÁ]/.test(t) && t.length < 50 && !t.startsWith('  ')) {
    row.font = { bold: true };
  }
  row.alignment = { wrapText: true, vertical: 'top' };
});

wb.xlsx.writeFile(OUT).then(() => {
  console.log('OK ->', OUT);
  console.log('Total casos:', cases.length);
});
