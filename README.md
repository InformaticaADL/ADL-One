# ADL One — Sistema de Gestión Empresarial

Sistema empresarial profesional desarrollado con arquitectura moderna y escalable para ADL Diagnostic Chile SpA.

---

## 🏗️ Arquitectura del Proyecto

### Backend — Node.js + Express + SQL Server

```
api-backend-adlone/
├── src/
│   ├── config/              # Configuración de base de datos y servicios
│   ├── controllers/         # Manejadores de peticiones HTTP
│   │   ├── health.controller.js
│   │   ├── ficha.controller.js
│   │   ├── bulk-ficha.controller.js
│   │   ├── rutas-planificadas.controller.js
│   │   ├── admin.controller.js
│   │   ├── solicitud.controller.js
│   │   ├── catalogos.controller.js
│   │   ├── menu.controller.js
│   │   └── auth.controller.js
│   ├── services/            # Lógica de negocio
│   │   ├── ficha.service.js
│   │   ├── bulk-ficha.service.js
│   │   ├── admin.service.js
│   │   ├── notification.service.js
│   │   ├── uns.service.js
│   │   ├── urs.service.js
│   │   ├── menu.service.js
│   │   ├── kpi-analyst.service.js
│   │   └── auth.service.js
│   ├── routes/              # Definición de endpoints de la API
│   ├── middlewares/         # Auth, validación, errores, logging
│   ├── utils/               # Funciones de ayuda (logger, response)
│   └── server.js            # Punto de entrada de la aplicación
├── logs/                    # Logs de la aplicación (auto-generados)
├── .env                     # Variables de entorno
└── package.json
```

### Frontend — React + TypeScript + Mantine UI

```
frontend-adlone/
├── src/
│   ├── components/          # Componentes reutilizables
│   ├── contexts/            # AuthContext, ThemeContext
│   ├── pages/               # Vistas principales por módulo
│   ├── services/            # Capa de comunicación con la API
│   ├── stores/              # State management con Zustand
│   └── App.tsx              # Punto de entrada del frontend
└── package.json
```

---

## 🚀 Tecnologías Utilizadas

### Backend
| Tecnología | Propósito |
|---|---|
| **Node.js** | Runtime de JavaScript |
| **Express** | Framework web RESTful |
| **SQL Server (mssql)** | Base de datos principal |
| **Winston** | Sistema de logging profesional |
| **JWT (jsonwebtoken)** | Autenticación stateless |
| **Joi** | Validación de esquemas |
| **Bcrypt** | Encriptación de contraseñas |
| **Nodemailer** | Envío de correos (SMTP) |
| **Socket.io** | Comunicación en tiempo real |
| **Helmet / CORS** | Seguridad HTTP |

### Frontend
| Tecnología | Propósito |
|---|---|
| **React 18** | Biblioteca de UI |
| **TypeScript** | Tipado estático |
| **Vite** | Build tool y dev server |
| **Mantine UI v7** | Componentes y sistema de temas |
| **Zustand** | State management ligero y persistente |
| **Leaflet / React-Leaflet** | Mapas interactivos para planificación de rutas |
| **Recharts** | Visualización de datos y dashboards |
| **Vanilla CSS** | Estilos modernos con glassmorphism y animaciones |

---

## 🎯 Características del Sistema

### Backend
✅ **Arquitectura en Capas** — Controllers → Services → BD + Middlewares  
✅ **Motor de Notificaciones Universal (UNS)** — Email + Web + Socket.io  
✅ **Autenticación y Autorización RBAC** — JWT + permisos granulares  
✅ **Auditoría Completa** — Registro de IP, usuario y cambios por acción  
✅ **Menús Dinámicos** — Navegación definida por backend según permisos  

### Frontend
✅ **Arquitectura Modular** — Componentes organizados por features  
✅ **Diseño Premium** — Mobile First, glassmorphism, micro-animaciones  
✅ **Dashboard Inteligente** — KPIs, gráficos Recharts, análisis automático  
✅ **Chat en Tiempo Real** — Mensajería directa y grupal vía Socket.io  

---

## 📋 Historial de Versiones

### 1. Sistema de Autenticación (Enero 2026) 🔐
- **Login Page**: Interfaz moderna con validación en tiempo real.
- **AuthContext**: Manejo de sesión global persistente en cliente.
- **Auditoría**: Todas las acciones registran el ID real del usuario en la base de datos.

### 2. Flujo de Trabajo Área Técnica (Enero 2026) 🧪
- Vista de detalle ReadOnly para fichas comerciales.
- Botones de **Aceptar** y **Rechazar** integrados con procedimientos almacenados.
- Actualización de estados (`id_validaciontecnica`) y registro de observaciones.

### 3. Notificaciones por Correo (Enero 2026) 📧
- Motor Nodemailer con transporte SMTP seguro (SSL/TLS).
- Listas de distribución configurables por entorno (`.env`).
- Capacidad de redirigir todos los correos a cuenta de desarrollador en modo DEV.

### 4. Corrección de Errores y Estabilidad (Enero 2026) 🛠️
- Manejo de errores en carga de datos asíncronos.
- Restauración de variables de estado críticas en formularios complejos.
- Corrección de discrepancias en nombres de columnas de la BD.

### 5. Módulo de Planificación y Asignación (Enero 2026) 🗓️
- Visualización integral de fichas, estados, fechas y responsables.
- Asignación masiva e individual de muestreadores (Instalación/Retiro).
- Lógica de guardado UPSERT con prevención de duplicados.
- Integridad de datos en procedimientos almacenados de coordinación.

### 6. Estandarización de Filtros Avanzados (Enero 2026) 🔍
- Componente `SearchableSelect` reutilizable con autocompletado dinámico.
- Botón "Limpiar Todo" global y limpieza individual por filtro (X).
- Ordenamiento inteligente por urgencia en módulo de Asignación.

### 7. Mejoras de UI/UX y Responsividad Móvil (Enero 2026) 📱
- Eliminación de flickers con estados de carga full-screen.
- Layouts adaptables en vistas de detalle para móviles y tablets.
- Fix de fondo morado persistente en `App.css`.
- Tablas compactas tipo "Tarjeta" en pantallas pequeñas.

### 8. Modo de Edición Comercial y Línea de Tiempo (Enero 2026) 🆕
- **Edición Comercial**: Soporte completo de edición en "Antecedentes" y "Análisis" con Soft Delete y auditoría (`EDICION_COMERCIAL`).
- **Línea de Tiempo de Observaciones**: Componente `ObservationTimeline.tsx` que traza el ciclo de vida completo de una ficha.
- Optimización de rendimiento con `useMemo` y `React.memo`.

### 9. Estandarización de UI y Refactorización (Febrero 2026) 🎨
- Sistema unificado de colores de estado: Morado, Ámbar, Azul, Verde.
- Formato Title Case en todos los estados.
- Anchos de columna fijos (`table-layout: fixed`) para evitar saltos de layout.

### 10. Flujo de Trabajo e Integridad de Datos (Febrero 2026) 🔄
- **Sistema de Alertas en Cascada**: Bloqueo contextual de acciones según estado del flujo en las áreas Técnica, Coordinación y Comercial.
- **Gestión de Frecuencia Correlativo**: Generación automática con formato `{id_ficha}-{frecuencia}-{estado}-{id_agenda}`, reactivación inteligente al aumentar frecuencia y anulación suave al reducirla.
- **Corrección de Carga de Análisis**: Migración a `LEFT JOIN` en SP para cargar análisis correctamente.
- Estabilidad de ancho de columnas y reinicio inteligente de paginación.

### 11. Mejoras en Notificaciones y Diseño de Email (Febrero 2026) 📧
- Plantillas HTML dinámicas con logo corporativo (compatible con Outlook).
- `FICHA_ASIGNADA`: Desglose completo de servicios asignados con fechas y muestreadores.
- Corrección de desfase de zona horaria (-1 día) mediante uso estricto de UTC.
- Atribución correcta del usuario asignador con lógica en cascada.

### 12. Mejoras en Login y Gestión de Sesión (Febrero 2026) 🔐
- **Recuérdame**: Persistencia de credenciales en `localStorage` por 30 días.
- **Seguridad**: Migración a `sessionStorage` como almacenamiento por defecto para tokens JWT.
- **Modal de Contraseña Olvidada**: Con información de contacto de informática.
- **Reset de Navegación en Logout**: Previene que el siguiente usuario herede la sesión anterior.
- **Guards de Permisos RBAC**: Validación granular por permiso (`MA_ADMIN_ACCESO`).

### 13. Módulo de Gestión de Equipos y Solicitudes (Febrero 2026) 🏗️
- Gestión centralizada de solicitudes: **ALTA**, **TRASPASO** y **BAJA**.
- Flujo de aprobación administrativa con diálogos de confirmación.
- Sistema de **Snapshots** automáticos en `mae_equipo_historial` para auditoría.
- Generación automática de Siglas y Correlativos por Tipo de Equipo y Sede.

### 14. Seguridad y Smart Fill (Febrero 2026) 🔒
- **Interceptor Axios 401**: Gestión global de sesiones expiradas.
- **Auto-completado Inteligente**: Al crear o aprobar un equipo, auto-puebla campos técnicos desde el catálogo maestro.

### 15. Notificaciones Proactivas y Gestión Integrada (Febrero 2026) 🔔
- El `EquipoForm` integra sección de Solicitudes Pendientes para aprobar/rechazar sin salir de la ficha.
- **Centro de Notificaciones**: Redirección por rol y persistencia del resultado de solicitudes.
- Iconos de alerta `⚠️` para trámites en curso y prevención de ediciones conflictivas.

### 16. Mejoras de UI/UX y Headers Responsivos (Febrero 2026) 🎨📱
- Implementación de cabeceras responsivas (`PageHeader`) con navegación por migas de pan (breadcrumbs).
- Alineación de tarjetas y badges en Hubs administrativos (`AdminMaHub`, `AdminGcHub`, `EquiposHub`).
- Badges de "pendientes" inteligentes por rol (Técnica vs. Calidad).

### 17. Permisos Granulares y Seguridad de Reportes (Febrero 2026) 🔐📊
- Nuevos permisos: `MA_A_REPORTES_DETALLE` y `MA_A_REPORTES_REVISION`.
- Corrección de visibilidad global: usuarios con permisos de reportes omiten el filtro por sección.

### 18. Diferenciación de Eventos en Calendario (Marzo 2026) 📅🔀
- Eventos separados de **Instalación** (`INICIO`) y **Retiro** (`RETIRO`) con colores e indicadores distintos.
- El modal muestra el muestreador correcto según el tipo de evento seleccionado.

### 19. Actualización de Filtros y Fuentes de Datos del Calendario (Marzo 2026) 🔍📊
- Empresa: datos desde `sc_empresa`; Muestreadores: solo activos desde `mae_muestreador`.
- **Fix**: Migración de `INNER JOIN` a `LEFT JOIN` en SP `MAM_FichaComercial_ConsultaCoordinador` para mostrar fichas sin agenda asignada.

### 20. Flujo de Cancelación de Muestreos (Marzo 2026) ❌📋
- Cancelación con motivo desde el modal del evento en calendario.
- Visualización de estado cancelado con motivo registrado.
- Bloqueo de acciones en eventos cancelados o con `id_validaciontecnica = 7`.

### 21. Equipos Duales por Muestreador y Versionamiento (Marzo 2026) 🔧📦
- Registro de equipos tanto del muestreador de instalación como del de retiro.
- Nueva columna `version` en `App_Ma_Equipos_MUESTREOS`.
- **Prompt de Versión en Reagendamiento**: Diálogo para mantener versión original o actualizar al maestro.

### 22. Ordenamiento de Servicios en Notificaciones (Marzo 2026) 📧🔢
- **Fix**: Los servicios asignados ahora se listan en orden numérico (1, 2, 3…) en lugar de lexicográfico.

### 23. Gestión de Muestreadores — Habilitación y Validación (Marzo 2026) 👤✅
- **Botón Habilitar**: Para muestreadores inactivos, con modal de confirmación.
- **Validación de Duplicados**: Al crear un muestreador, verifica nombre y correo existentes.
- Endpoints: `PUT /api/admin/muestreadores/:id/enable` y `GET /api/admin/muestreadores/check-duplicate`.

### 24. Gestión de Solicitudes y Resolución de Identidades (Marzo 2026) 📝👤
- Columna CÓDIGO/NOMBRE con código real de equipo, eliminando fallbacks `N/A`.
- **Estrategia de Resolución en Cascada**: Precarga de usuarios y muestreadores, mapeo de IDs y alias para mostrar nombres reales.
- Fix de modales dobles y pantalla en blanco por tag React mal cerrado.

### 25. Refinamiento de Notificaciones y Metadatos (Marzo 2026) 📧✨
- **Enriquecimiento de Metadatos SQL**: Inclusión de `{CLIENTE}`, `{PLANTA}`, `{CONTACTO_EMPRESA}`, `{CORREO_CONTACTO}`, `{MONITOREO}`, `{OBJETIVO}`.
- **Filtrado Inteligente de Servicios en Reprogramación**: Solo muestra servicios con cambios reales, con comparativa visual ~~Antiguo~~ ➔ **Nuevo**.
- Prevención de correos vacíos si no hay cambios detectados.

### 26. Resolución de Errores Críticos de Backend (Marzo 2026) 🛠️🔒
- **Fix Error 500 (batch-agenda)**: Corrección de nombres de tablas y columnas incorrectas.
- Propagación correcta de `correo_empresa` y datos de contacto hacia el servicio de notificaciones.

### 27. Finalización de Módulo de Fichas y Planificación (Marzo 2026) 🛠️📋
- Diferenciación de Cliente (a facturar) vs. Empresa de Servicio.
- Actualización del catálogo de Instrumento Ambiental con nuevas opciones normativas.
- Validaciones de integridad: al menos 1 servicio y 1 normativa por ficha.
- Selección de laboratorio por parámetro individual.
- Control de visibilidad de valores en UF (solo Área Comercial).
- Corrección del cálculo de Fechas Recomendadas y sincronización de Fecha Retiro.

### 28. Dashboards Especializados y Analítica Avanzada (Marzo 2026) 📊📈
- Dashboards dedicados para **Gestión Operativa**, **Servicios y Clientes** y **Logística y Centros**.
- Gráficos Recharts: Radar, Treemap, Composed Charts.
- Filtros dinámicos con drill-down temporal y geográfico.

### 29. Refuerzo de Auditoría Global (Marzo 2026) 🛡️🔍
- Captura automática de `ip_address`, `trace_id` y `metadatos_extra` en `App_Audit_Log`.
- Middleware de contexto global que propaga la identidad del usuario a todas las capas del servicio.

### 30. Validación Estricta y Auto-Completado de Equipos (Marzo 2026) 📋⚡
- Campos de nombre de equipo, parámetros y unidades funcionan como selectores (sin texto libre).
- Al elegir un equipo, se auto-pueblan "Qué Mide" y "Unidad de Medida" desde el catálogo maestro.

### 31. Módulo de Administración de Información y Exportador de Datos (Marzo 2026) 📊
- `AdminInfoHub.tsx`: Exportación de tablas maestras, fichas, solicitudes y equipos a Excel (`.xlsx`).
- Generación de reportes personalizada por área de negocio.
- Acceso restringido por permiso `AI_MA_ADMIN_ACCESO`.

### 32. Rediseño Minimalista del Catálogo Maestro (Marzo 2026) ✨🛠️
- Refactorización de `EquipoCatalogoView.tsx` con clases CSS `catalog-*-refined`.
- Scroll automático tras 6 elementos en la tabla principal.
- Columna **Sigla** visible en la lista de catálogo.
- Formularios en cuadrículas de 2 columnas con micro-animaciones (fadeIn).

### 33. Motor de Notificaciones Universal (UNS) (Marzo 2026) 🔔🔄
- Servicio unificado para alertas en tiempo real (Socket.io) y correos (Nodemailer).
- **Priorización de Reglas**: Usuario > Rol > Aplicación.
- Sincronización total entre el Hub administrativo y la tabla `mae_notificacion_regla`.
- **Toast Shield**: Escudo de 5 segundos durante el arranque para evitar notificaciones fantasmas.
- Diseño corporativo de correos con compatibilidad total para Outlook y móviles.

### 34. Resiliencia, Seguridad y Centro de Ayuda (Marzo 2026) 🛡️✨
- **Gestión Avanzada de Contraseñas**: Indicador de fortaleza en tiempo real, validación de coincidencia instantánea.
- **Landing Page Unificada**: Al seleccionar un módulo, muestra la WelcomePage con avisos relevantes.
- **ErrorBoundary Global** en `App.tsx` con ErrorPage de glassmorphism.
- **HelpCenter Modal**: Acceso a soporte vía WhatsApp y Email, con FAQ de acordeones.

### 35. Personalización y Perfil de Usuario (Marzo 2026) 👤✨
- Página "Mi Perfil" con encabezado de degradado dinámico adaptado al tema visual.
- Información dividida en tarjetas: "Información Personal" y "Seguridad y Rol".
- Panel de preferencias con atajos de configuración integrados.

### 36. Módulo de Chat General en Tiempo Real (Marzo 2026) 💬⚡
- Chats directos (uno a uno) y grupos de trabajo con múltiples integrantes.
- Motor Socket.io con entrega inmediata de mensajes y avisos de "escribiendo...".

### 37. Accesibilidad y Usabilidad Móvil (Marzo 2026) 📱🚀
- Filas cliqueables en tablas de gestión de roles para móviles.
- Clase `.mobile-hide` para ocultar elementos no críticos en pantallas pequeñas.

### 38. Fidelidad y Estandarización de Notificaciones URS (Abril 2026) 🔔📧
- Resolución de identidad real del técnico solicitante (elimina el genérico "Sistema").
- **Remapeo Automático**: Solicitudes Tipo 13 (General) se reclasifican automáticamente a Tipo 14 (Equipo) o Tipo 15 (Servicio/Ficha).
- Correlativos de negocio en notificaciones (ej. `123-1-Pendiente-1835`) en lugar de IDs internos.
- Actualización masiva de 7 plantillas URS al diseño corporativo premium.

### 39. Optimización de Flujos, Identidad y Experiencia Visual (Abril 2026) 🚀🎨
- **Resolución de Identidad Móvil (URS)**: Cruce de `id_tecnico` con tabla de usuarios para identificar nombres reales.
- **Auto-Jump por Rol**: Redirección automática al área de trabajo al acceder a Fichas de Ingreso con acceso único.
- **ConfirmModal** con colores verdes e iconos de éxito para aprobaciones técnicas.
- Corrección de desbordes en el Sidebar para nombres/correos largos.

### 40. Consolidación del Módulo Medio Ambiente y Menús Dinámicos (Abril 2026) 🚀📋
- **Explorador de Fichas Universal** (`FichasExploradorView.tsx`): Unifica las vistas de Comercial, Técnica y Coordinación.
- **Sistema de Menús Dinámicos**: Motor en `menu.service.js` que entrega navegación según permisos del usuario.
- **Refactorización de Sidebar**: Consume el API de menús para cambios de navegación sin despliegues.

### 41. Planificación de Evolución del Ecosistema (Abril 2026) 🏗️🚀
- Definición de la nueva arquitectura: **Monolito Modular** con NestJS y PostgreSQL.
- Motor de **Backend-Driven UI** basado en JSON Schema.
- Esquema "Zero" de base de datos con integridad referencial estricta y soporte JSONB.

### 42. Refinamiento del Planificador de Rutas (Abril 2026) 🗺️🚗
- **Selección Precisa de Correlativos**: Selector desplegable para elegir exactamente qué servicio se asocia a la ruta.
- **Smart Zoom**: Auto-ajuste del mapa con zoom máximo 15 para grupos y 16 para marcadores individuales.
- **Fix SQL Server**: Validación `getFullYear() > 1900` para discriminar fechas dummy `1900-01-01`.
- Refactorización de estado para evitar duplicación de Toasts en React Strict Mode.

### 43. Dashboard Inteligente y Analítica de KPIs (Abril 2026) 📊🚀
- `KpiAnalystDashboardView.tsx`: Centraliza métricas de rendimiento operativo.
- Algoritmos de detección automática de riesgos y alertas operativas.
- Insights estratégicos: narrativas automáticas basadas en la data.
- Visualización con tendencias temporales y distribución por clientes.

### 44. Planificador de Rutas y Logística Geográfica (Abril 2026) 🗺️🚗
- `RouteMapPlannerView.tsx`: Mapa interactivo Leaflet para agrupar servicios en rutas lógicas.
- `RutasListView.tsx`: Seguimiento de rutas planificadas, vehículos y estados.
- Backend `rutas-planificadas.service.js` para persistencia de datos geográficos.
- Scripts SQL de creación de tablas de rutas.

### 45. Sistema de Carga Masiva — Bulk Ficha Creator (Abril 2026) 📑⚡
- `BulkFichaCreator.tsx`: Ingreso de múltiples servicios en un solo flujo.
- `BulkReviewGrid.tsx`: Validación exhaustiva antes del guardado definitivo.
- Motor `bulk-ficha.service.js` con parsing de PDFs (`pdf-parse`) y archivos Excel.

### 46. Gestión de Maestros de Empresas de Servicio (Abril 2026) 🏢🛠️
- `EmpresaServicioFormView.tsx`: Gestión centralizada de empresas prestadoras de muestreo.
- Filtrado por estados para mostrar solo proveedores activos.
- Sincronización de datos de contacto y correos electrónicos de proveedores.

### 47. Estabilización de Carga Masiva y Navegación (Mayo 2026) 🛠️🚀
- Soporte de archivos Excel junto a PDF en el módulo de carga masiva.
- **Fix Bug Sidebar**: Corrección del bug que eliminaba permisos al navegar al inicio.
- **Fix Batch-Agenda 400**: Ajuste del schema Joi para manejar correctamente las asignaciones masivas.

### 48. Mejoras en Chat Interno y Plantillas de Correo (Mayo 2026) 💬📧
- **Fix ChatSidebar**: Exclusión del usuario autenticado de los resultados de búsqueda de contactos.
- Estandarización visual de correos de aprobación/rechazo de fichas.
- Incorporación del campo **Hora** en notificaciones de fichas para mayor trazabilidad.

### 49. Correcciones Críticas de Permisos y Seguridad (Mayo 2026) 🔐🛡️
- **Fix 400 GET `/api/admin/muestreadores`**: Schema Joi actualizado para aceptar `ACTIVOS`, `INACTIVOS` y `TODOS`.
- **SQL Directo en Muestreadores**: Reemplazo del SP por consulta directa con mapeo correcto de estados.
- **Permisos Alternativos**: Ruta acepta `MA_MUESTREADORES` OR `MA_A_GEST_EQUIPO`.
- **Fix Crítico — Logout por 403**: El interceptor Axios ahora solo hace logout en errores **401**; los 403 se propagan sin cerrar la sesión.
- **Desacoplamiento de Guards**: `admin-equipos-gestion` y `admin-muestreadores` fuera del guard general, con verificaciones independientes.
- **Fix idValue = 0**: Validación corregida de `!idValue` a `=== undefined || === null` en `catalogos.controller.js`.

### 50. Efectos Visuales — Glassmorphism en Dashboard (Mayo 2026) 🎨🔒
- Overlay de privacidad con `backdrop-filter: grayscale(100%) blur(2px)` en tarjetas inactivas.
- Bloqueo de interacciones con `pointer-events: none` en secciones en desarrollo.
- Preservación de la imagen principal en color dentro del overlay.

### 51. Refinamiento en Asignación de Rutas (Mayo 2026) 🗺️🚫
- Validación estricta de correlativos antes de guardar la ruta.
- Bloqueo y ocultamiento de fichas en estado `AGENDADO` o `en_ruta` para prevenir duplicidad.
- **Fix SQL**: Evaluación del estado de ruta por exclusión lógica (`NOT IN ('COMPLETADA', 'CANCELADA', 'ANULADA')`).

### 52. Georeferenciación, RBAC Estricto y UI Premium (Mayo 2026) ✨🚀
- **Fix Error 500 en Rutas**: `LEFT JOIN` a `mae_centro` para obtener coordenadas reales.
- **Algoritmo de Extracción Tri-Fase**: Parsing de Google Maps, goo.gl y fallback a columnas legadas.
- **Migración a RBAC Estricto**: Permiso atómico `GEM_REALIZADO` reemplaza validación por nombre de rol.
- **Loader Inteligente para KPIs**: Pantalla de transición con `Loader` de Mantine tipo bars.
- **Menús Animados**: Reemplazo de Framer Motion por animaciones CSS para evitar pantalla en blanco.
- Expansión del catálogo de Maestros con nuevas entidades: "Orígenes", "Tipos de Instalación", "Medio".

### 53. Sincronización de Equipo y Módulo de Ejecución de Rutas (Mayo 2026) 🤝🚀
- Implementación generalizada de `PageHeader` y breadcrumbs en todo el módulo de Medio Ambiente.
- **Módulo `rutas-ejecuciones`**: Gestión del ciclo de vida y estados de servicios en terreno.
- **KPI Analyst — Fix de CPU**: Cálculos asíncronos con `setImmediate` para evitar bloqueo del Event Loop.
- Protección de rutas previamente desprotegidas (subidas de archivos, catálogos).
- Actualización atómica de rutas planificadas con endpoint `PUT /:id` dentro de una transacción.

### 54. Estética Global Premium y Alertas de Equipos (Mayo 2026) 🎨📋
- Fondo blanco puro (`#ffffff`) en `App.css`, `index.css` y `MainLayout.tsx`.
- **Alertas Accionables en Equipos por Vencer**: Botón de acción que aplica filtros automáticos.
- **Ordenamiento Priorizado**: Equipos con solicitudes pendientes y próximos a vencer al tope de la tabla.

### 55. Empresas de Servicio, Filtros Adaptativos y Catálogos (Mayo 2026) 🏢🔍
- `EmpresaServicioFormView.tsx` con scroll inteligente tras 11 registros.
- **Tipos de Muestra** (`mae_tipomuestra`): Campos `modo_ingreso`, `aplicado_a`, `nombre_sernapesca`, `metodologia`, `realiza_screening`, `guia`.
- **Sistema de Filtros Adaptativos** en `MaestroDataManager.tsx`: Selectores automáticos por clave foránea, con filtros por Cliente, Empresa, Cargo, Componente y Lugar de Análisis.

### 56. Corrección de Numeración de Servicios y Estilo de Bloques (Mayo 2026) 📧✏️
- **Fix numeración doble**: Los servicios en correos de `FICHA_MUESTREO_REAGENDADO_REASIGNADO` ya no muestran el número duplicado (ej. `36 36`), sino solo uno.
- **Estilo compacto del bloque de metadata**: Las filas de "Modificado por", "Fecha" y "Hora" ahora usan `padding:4px` y `line-height:1.2` igualando el estilo de todos los demás templates.
- Aplicado a todos los templates: Cancelado, Reasignado, Reagendado y Reagendado+Reasignado.

### 57. Motor de Observaciones y Limpieza de Datos en Correos (Mayo 2026) 🧹📧
- **Fix Observaciones en Reasignado**: El bloque "Observaciones" ahora solo aparece cuando hay texto real ingresado por el usuario; la `glosa` comercial del servicio ya no se filtra como observación.
- **Fix Usuario en Correo Cancelado**: El campo "Cancelado por" resuelve correctamente el nombre del usuario real que realizó la acción.
- **Corrección de Correo Reagendado**: El correo de reagendado ahora se envía correctamente (fix del pipeline de contexto enriquecido).

### 58. Auto-Cálculo de Fecha de Retiro y Display Inteligente (Mayo 2026) 📅🔧
- **Auto-cálculo automático**: Al cambiar solo la Fecha de Instalación, el sistema calcula automáticamente la nueva Fecha de Retiro manteniendo el mismo intervalo de días del registro histórico.
  - Ej.: instalación cambia del 21 al 22 → retiro pasa del 22 al 23 automáticamente.
  - Si la fecha de retiro histórica era inválida (`1900-01-01`), el auto-cálculo se omite.
- **Ocultamiento de fechas inválidas**: Las filas "📅 Fecha Retiro" y "📤 Muestreador Ret." ya no se muestran si el valor es `null`, vacío o la fecha dummy de SQL Server.

### 59. Armonización Visual de Bloques de Metadata en Correos (Mayo 2026) 🎨📧
- **Filas vacías eliminadas en runtime**: Post-render en `notification.service.js` elimina filas `<tr>` donde la celda de valor queda vacía después del reemplazo de placeholders (ej. "Empresa Servicio:" sin valor).
- **Fix estructural de tabla** (`FICHA_ASIGNADA`): Migración de `padding`/`background-color`/`border-radius` desde el elemento `<table>` (no soportado en Outlook) hacia un `<td>` wrapper externo — exactamente la misma estructura correcta del template Cancelado.
- **Normalización global de padding**: Todas las filas de detail tables usan `padding:3px`, `line-height:1.2` y `vertical-align:middle` para un aspecto compacto y armonioso.
- **Fix `border-collapse`**: Cambio de `separate` → `collapse` en todas las tablas internas, eliminando el espacio implícito entre filas.
- **`{COLOR_PRINCIPAL}` resuelto en runtime**: Cualquier placeholder de color residual se reemplaza por `#0062a8` durante el render.
- **Actualización masiva en BD**: 73 templates actualizados con el nuevo estilo compacto.

---

## 🔧 Configuración para Desarrollo

### Variables de Entorno — Base de Datos
```env
DB_SERVER=192.168.x.x
DB_DATABASE=NombreBD
DB_USER=usuario
DB_PASSWORD=contraseña
DB_PORT=1433
```

### Variables de Entorno — SMTP
```env
SMTP_HOST=mail.server.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=sender@server.com
SMTP_PASS=password
```

### Variables de Entorno — Email (Desarrollo)
Para evitar el envío a usuarios reales durante el desarrollo:
```env
EMAIL_TO_LIST=tu_correo_dev@adldiagnostic.cl
EMAIL_TO_REJECT_LIST=tu_correo_dev@adldiagnostic.cl
EMAIL_BCC_LIST=tu_correo_dev@adldiagnostic.cl
```

### Ejecución Local
```bash
# Backend
cd api-backend-adlone
npm install
npm run dev       # Puerto 8002

# Frontend
cd frontend-adlone
npm install
npm run dev       # Puerto 5173
```

---

## 📈 Próximos Pasos (Hoja de Ruta 2026)
1. **Bootstrapping ADL ECOSISTEMA**: Inicio del nuevo repositorio unificado en NestJS.
2. **Implementación de ADL Sampling**: Desarrollo de la nueva App de shell dinámico para terreno.
3. **Módulos de Facturación y Abastecimiento**: Desarrollo de los primeros procesos operativos integrados.

---

## 📄 Estado del Proyecto

| Componente | Tecnología | Estado |
|---|---|---|
| **Backend API** | Node.js + Express (RESTful, Auth, UNS, Chat) | ✅ Estable |
| **Frontend** | React + TypeScript + Mantine UI | ✅ Estable |
| **Base de Datos** | SQL Server (Esquema Legacy estabilizado) | ✅ Estable |
| **Notificaciones** | Nodemailer + Socket.io + 73 plantillas HTML | ✅ Estable |
| **Chat** | Socket.io (tiempo real, grupos y directos) | ✅ Estable |
| **Rutas Logísticas** | Leaflet + Backend geoespacial | ✅ Estable |
| **KPI Dashboard** | Recharts + Análisis automático | ✅ Estable |

---

*ADL One — Fase de personalización finalizada. En evolución hacia la Plataforma Digital Unificada ADL Diagnostic.*
