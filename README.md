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

### 6.8 Refactorización Módulo Medio Ambiente (Mayo 2026) 🗺️
- Simplificación de Fichas de Ingreso (removidas tarjetas y dependencias innecesarias de "Empresas de Servicio").
- Campo de "Referencia Google Maps" modificado como opcional en Fichas. Si no se ingresa, la ficha se excluye de generación de rutas.
- Actualización de importaciones dinámicas para componentes ligeros.

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

### 60. Optimización de Correos, Permisos RBAC y Limpieza (Mayo 2026) 📧🔐
- **Limpieza de Proyecto**: Eliminación de scripts de diagnóstico (`scratch/`) y optimización del repositorio.
- **Armonización de Plantillas**: Unificación de notificaciones de reagendamiento, separación en plantillas específicas y solución del bloque de observaciones ('Sin observaciones').
- **Permisos y RBAC**: Correcciones en la gestión y validación de permisos de roles (RBAC) en las rutas del backend y módulo URS.

### 61. Sincronización y Refinamiento de Planificador de Rutas y Formularios (Mayo 2026) 🗺️📝
- **Resolución de Enlaces de Google Maps**: Nueva utilidad `resolverGoogleMapsLink.js` para extraer coordenadas precisas a partir de URLs cortas y enriquecer la planificación.
- **Refinamiento de Formularios**: Actualizaciones en componentes de Medio Ambiente (`AnalysisForm`, `AntecedentesForm`, `FichaCreateForm`, `BulkReviewGrid`) optimizando validación y experiencia de usuario.
- **Gestión Avanzada de Rutas**: Ajustes en backend (`ficha`, `rutas-planificadas`, `rutas-ejecuciones`) para una ejecución y trazabilidad operativa más robusta.
- **Integración de Cambios**: Sincronización transparente con el módulo de administración de usuarios remoto.

### 62. Sistema Completo de Recuperación de Contraseña (Mayo 2026) 🔐📧
- **S-14 a S-17 — Flujo de Reset por Email**: Implementación completa del ciclo de vida de recuperación de contraseña con token de un solo uso.
  - `auth.service.js` — `requestPasswordReset`, `validateResetToken`, `consumeResetToken` con hashing SHA-256 y expiración configurable (60 min).
  - `auth.controller.js` — Endpoints `POST /forgot-password`, `GET /validate-reset-token`, `POST /reset-password`; respuesta genérica siempre `200` para no filtrar existencia de emails (S-15).
  - `auth.routes.js` — Rutas públicas sin autenticación.
  - `email.service.js` — Método `sendPasswordReset` con plantilla HTML corporativa, botón de acción y versión de texto plano.
  - `ResetPasswordPage.tsx` — Página frontend con flujo de 2 pasos: ingreso de nueva contraseña + confirmación visual.
  - `App.tsx` — Detección de ruta `/reset-password` para renderizar la página antes del login.
  - `LoginForm.tsx` — Modal de "Recuperar Contraseña" completamente rehecho: formulario de email funcional con `forgotSent` para feedback post-envío; reemplaza la pantalla estática de contacto informática.
- **S-17**: Invalidación automática de tokens previos al solicitar uno nuevo.
- **S-13 — Bloqueo de Cuenta**: `auth.service.js` incrementa intentos fallidos y bloquea tras N intentos; `clearFailedLoginAttempts` se llama tras reset exitoso; `auth.controller.js` retorna HTTP 423 con código `ACCOUNT_LOCKED`.
- **Migración de Base de Datos** (`db-migrations/phase5-auth-tables.sql`):
  - Tabla `mae_login_attempts` — Registra intentos fallidos con bloqueo temporal.
  - Tabla `mae_password_reset_tokens` — Tokens hash SHA-256 con `expires_at`, `used_at` e IP del solicitante.
  - Columna `permisos_version` en `mae_usuario` — Invalida JWTs al deshabilitar o cambiar permisos de un usuario (RB-04 / RB-07).

### 63. Correcciones de Integridad en Asignación y Cancelación de Muestreos (Mayo 2026) 🛠️🔒
- **A-05 / A-06 — COALESCE en UPDATE**: La asignación de muestreos ahora usa `COALESCE(@param, columna_actual)`, preservando el valor previo cuando el frontend envía `null` para un campo no modificado.
- **C-04 / C-05 — Validación pre-cancelación**: El backend valida el estado actual antes de cancelar; lanza error descriptivo si el muestreo ya está `CANCELADO`, `ANULADO` o `REALIZADO` (id_estadomuestreo = 3).
- **M-06 — Datos de ejecución en PDF**: La ficha PDF incluye una nueva sección "Datos de Ejecución del Muestreo" con fechas reales de instalación/retiro, totalizadores inicio/final y nombre del ejecutor GEM, visible solo cuando hay muestreos ejecutados.
- **MS-04 — Asignaciones futuras del muestreador**: Nuevo endpoint y consulta SQL `getMuestreadorFutureAssignments` que retorna la lista de servicios futuros activos antes de desactivar un muestreador.
- **MS-05 — Conservación de clave en edición**: Al actualizar un muestreador sin cambiar la clave, el servicio lee y reenvía la clave actual para no sobrescribirla con vacío.
- **Refinamiento de FichaUniversalView, AssignmentDetailView, EnProcesoCalendarView, RutasListView**: Mejoras de UI, manejo de estados y visualización de datos de ejecución en el frontend.
- **notificationStore.ts**: Store Zustand dedicado para el centro de notificaciones con persistencia y conteo de no leídas.

### 64. Hardening de Seguridad — RBAC Estricto y Protección de Sesión (Mayo 2026) 🔐🛡️
- **RB-04 — Deshabilitación Instantánea**: `auth.middleware.js` verifica `habilitado` en cada request vía `getUserAuthState` (TTL cache 5s). Si el admin deshabilita un usuario, la sesión se corta en máx. 5 segundos con HTTP 401.
- **RB-07 — permisos_version en cada request**: La validación de `permisos_version` se ejecuta siempre (antes solo en token con versión). Cambios de permisos fuerzan re-login inmediato.
- **`permVersionCache.js` — Refactorización**: `getPermVersion` reemplazado por `getUserAuthState` que trae `habilitado` + `permisos_version` juntos con TTL reducido de 2 min → 5 seg. Compatible con código existente mediante alias.
- **RB-08 — Eliminación de Bypass Super-Admin**: `solicitud.controller.js` y `AdminGcHub.tsx` eliminaron el bypass `isSuperAdmin` por nombre de rol; reemplazado por permisos atómicos (`GC_ACCESO`, `GC_EQUIPOS`).
- **S-13 — Bloqueo de cuenta robusto**: `recordFailedLoginAttempt` reescrito con INSERT/UPDATE explícitos en lugar de MERGE (compatibilidad con todos los niveles de isolation). Logging detallado del conteo y timestamp de bloqueo.
- **S-14/S-15 — Mensajes específicos en reset**: El negocio decidió dar feedback explícito (sistema interno). `auth.service.js` lanza errores con código (`EMAIL_NOT_FOUND`, `USER_DISABLED`, `EMAIL_MISSING`); `auth.controller.js` los mapea a 404/403/400 respectivamente; `LoginForm.tsx` actualizado para mostrar esos mensajes.
- **AuthContext.tsx — Mensajes de logout diferenciados**: El interceptor Axios 401 muestra mensajes específicos según causa: cambio de permisos, cuenta deshabilitada, sesión inválida o token expirado. Rutas de reset-password excluidas del auto-logout.
- **`solicitud.controller.js` — Refactorización RBAC completa**: Todos los métodos (`create`, `getAll`, `updateStatus`, `reviewTechnical`, `acceptForReview`, `getHistorial`, `getSolicitudesByEquipo`) eliminan el bypass por rol y usan permisos atómicos explícitos.
- **`AdminGcHub.tsx` — Permiso correcto para Equipos GC**: Removido `AI_MA_ADMIN_ACCESO` del filtro; solo acepta `GC_ACCESO`, `GC_EQUIPOS`, `MA_A_GEST_EQUIPO`.

### 65. Correcciones de Datos, Filtros y Globalización de UI (Mayo 2026) 🛠️🌐
- **MA-05 — Filter defensivo global en Mantine**: `main.tsx` registra `filter` defensivo en `Select`, `MultiSelect` y `Autocomplete` que tolera `label`/`value` nulos desde BD. Previene crashes al buscar en selectores con opciones parcialmente nulas.
- **F-01b — Enriquecimiento de detalles con normativas**: `ficha.service.js` hace JOIN adicional a `mae_normativa` y `mae_normativareferencia` al cargar detalles de ficha, resolviendo `nombre_normativa` y `nombre_normativareferencia` directamente en el backend.
- **F-01f — Campo "Otro" en Instrumento Ambiental**: En `AntecedentesForm.tsx`, cuando se selecciona "Otro" como instrumento, el campo número acepta texto libre y el año se deshabilita (no obligatorio). El bloque `onKeyDown` bloquea teclas no numéricas solo para instrumentos convencionales.
- **C-01 (revisado) — Filtro de calendario simplificado**: La consulta de fichas coordinadas filtra solo por `fecha_muestreo` (instalación), eliminando la condición doble de retiro que provocaba duplicados en el calendario.
- **isNoAplicaValue helper en AntecedentesForm**: Nueva función que detecta correctamente valores "No Aplica" en selectores de Medición de Caudal, Modalidad, Forma Canal y Dispositivo Hidráulico, deshabilitando cascadas de forma semántica.
- **Refinamientos de UI**: `AdminInfoHub.tsx`, `EquiposPage.tsx`, `MuestreadoresPage.tsx`, `UsersManagementPage.tsx`, `ChatWindow.tsx`, `DashboardPage.tsx`, `FichaUniversalView.tsx`, `EmpresaServicioFormView.tsx` — ajustes menores de layout, estados y manejo de datos.
- **Scripts de pre-producción** (`db-migrations/pre-production-cleanup.sql`, `pre-production-cleanup.html`): Script SQL transaccional por bloques para limpiar datos de prueba antes de producción (fichas, rutas, solicitudes, chat, auditoría, tokens), preservando todos los maestros.

### 66. Ayuda Contextual, Control de Avatares y Mejoras de Usabilidad (Mayo 2026) ℹ️👤
- **Centro de Ayuda Contextual (HelpCenter & FieldHelp)**:
  - Implementación del nuevo componente `FieldLabel` (`FieldHelp.tsx`) para proveer ayuda en tiempo real (tooltips) en los campos de formulario más críticos de `AntecedentesForm.tsx`.
  - Rediseño y enriquecimiento de `HelpCenter.tsx` agregando acordeones de consejos útiles y tarjetas directas de soporte TI (Correo e integración directa con WhatsApp) habilitadas en el flujo global.
  - Integración global del modal de ayuda mediante el estado `helpCenterOpen` y la acción `setHelpCenterOpen` definidos centralizadamente en `navStore.ts`.
  - Botón "Información" incorporado en las cabeceras principales (`PageHeader.tsx`) y en la vista de detalles (`FichaDetailView.tsx`) para invocar el centro de ayuda.
  - Actualización de navegación y estilo del icono del menú de ayuda en `Sidebar.tsx`.
- **Gestión de Avatar de Usuario**:
  - Backend habilitado en `user.controller.js` para permitir la eliminación de fotos de perfil (seteando el avatar a `null`).
  - Botón "Eliminar foto actual" añadido en la vista de perfil de usuario (`ProfilePage.tsx`).
- **Mejoras Generales y Corrección de Token**:
  - `analysis.service.ts`: Añadido interceptor de requests para asegurar que el token de autenticación del usuario se incluya correctamente en las peticiones al microservicio de análisis.
  - `KpiAnalystDashboardView.tsx`: Optimización de responsive en el encabezado de KPIs, ocultamiento inteligente del timestamp de actualización en móviles y ajuste estético de botones.

### 67. Costo Operativo y Corrección de Correlativo en Documentos (Mayo 2026) 💰📄
- **Fila Costo Operativo (`tipo_analisis='CostoOperativo'`)**:
  - `ficha.service.js` — Al crear una ficha, se inserta automáticamente una fila de Costo Operativo en `App_Ma_FichaIngresoServicio_DET` (UF=0 cuando no aplica).
  - `ficha.service.js` — Al editar, se realiza un **UPSERT** de la fila Costo Operativo: UPDATE si ya existe, INSERT si no, preservando integridad sin duplicados.
  - `bulk-ficha.service.js` / `bulk-excel.service.js` — Misma lógica de inserción de Costo Operativo integrada en el flujo de carga masiva.
  - `AnalysisForm.tsx` — Nuevo control toggle/input para habilitar el Costo Operativo y definir su valor en UF, disponible en modo edición y remuestreo.
  - `FichaCreateForm.tsx` — Integración del estado `costoOperativo` en el payload de creación de ficha.
  - `FichaUniversalView.tsx` — Vista de detalle: la fila Costo Operativo se muestra siempre al fondo de la tabla de análisis (fondo amarillo si tiene UF, gris si no aplica); se filtra de las filas regulares en modo lectura.
  - `FichaDetailView.tsx` — Filtros de tabla actualizados para excluir `tipo_analisis='CostoOperativo'` de las vistas de parámetros de terreno.
  - `RemuestreoPage.tsx` — Al cargar un remuestreo, se recupera y pre-rellena el Costo Operativo de la ficha original; el estado se propaga al payload de guardado.
  - `AssignmentDetailView.tsx` — Exclusión defensiva de la fila Costo Operativo en listas de análisis de asignación.
- **Fix Correlativo en Documentos PDF (FoMa / Cadena de Custodia)**:
  - `ficha.service.js` — El asunto y cuerpo del correo de documentos ahora usan `frecuencia_correlativo` como identificador principal en lugar de `caso_adlab`, alineando la referencia del PDF con el correlativo que ve el usuario en la app móvil.
  - Soporte para placeholder `{CORRELATIVO}` en templates de BD, manteniendo `{CASO_ADLAB}` como alias de compatibilidad.

### 68. Mapeo de Muestreadores Inactivos, Ayuda Contextual en Equipos y Regla de Expiración a Fin de Mes (Junio 2026) 🛠️ℹ️📅
- **Visualización de Muestreadores Inactivos**:
  - `EquipoForm.tsx` — Carga todos los muestreadores (activos e inactivos) del backend, etiquetando los inactivos con `(Inactivo)` para permitir visualizar y mantener asignaciones previas sin perder datos.
  - `validate.middleware.js` — Ajuste al validador Joi para permitir un valor de `estado: ''` (vacío = sin filtro), evitando errores 400 (Bad Request).
- **Ayuda Contextual en Equipos**:
  - `EquipoForm.tsx` — Integración del componente `FieldLabel` para mostrar tooltips descriptivos de ayuda contextual en tiempo real en los campos del formulario de equipos.
- **Sincronización de Vigencia (`fecha_vigencia`)**:
  - `EquipoForm.tsx` — Sincronización automática mediante `useEffect` del campo `vigencia` con `siguiente_verificacion`. El campo `Vigencia` se configuró como de solo lectura (`readOnly`) y `Siguiente Verificación` como obligatorio (`required`).
  - Sincronización integrada en el editor masivo (bulk creation) y script de migración SQL para equiparar los registros existentes en la base de datos `PruebasInformatica`.
- **Regla de Vencimiento a Fin de Mes**:
  - `equipo.service.js` / `admin.service.js` — Modificación de las consultas del contador por vencer, indicador de dashboard y tarea automática de inactivación (`inactivateExpiredEquipos`) utilizando `EOMONTH(fecha_vigencia)` de SQL Server, de modo que el equipo solo pase a estado inactivo al expirar el último día del mes correspondiente.

### 69. Refinamiento de la Gestión de Equipos y Control de Errores (Junio 2026) 🛠️🔒⚠️
- **Prevención de Errores por Opciones Duplicadas en Mantine**:
  - `EquipoForm.tsx` — Implementación de lógica de deduplicación de opciones en el selector de **Equipo Asociado** y el helper **MantineHybridSelect** para evitar el error de renderizado crítico de Mantine Core al encontrar llaves duplicadas.
- **Prevención de Warnings por Campos Textarea Nulos**:
  - `EquipoForm.tsx` / `ObservacionesForm.tsx` — Se añadieron valores de respaldo (fallback) vacíos (`|| ''`) en los atributos `value` de los componentes `<Textarea>` (como `observacion` y `plazo_vigencia`) para evitar advertencias de React al procesar campos nulos provenientes de la base de datos.
- **Filtrado Inteligente de Responsables (Muestreadores)**:
  - `EquipoForm.tsx` — Al crear un equipo nuevo, el selector de responsables solo muestra muestreadores activos. Al editar un equipo existente, muestra los activos más el responsable actual (incluso si está inactivo), agregando la etiqueta `(Inactivo)`.
- **Bloqueo del Correlativo de Equipos**:
  - `EquipoForm.tsx` — El campo **Correlativo** se configuró como deshabilitado (`disabled`) para impedir que los usuarios lo alteren manualmente, manteniéndolo coherente con la auto-generación del código.
- **Notificaciones Dinámicas de Advertencia en Edición**:
  - `EquipoForm.tsx` — Implementación de un panel unificado de advertencias (`warningsAlert`) en la parte superior que alerta si la vigencia del equipo está vencida (indicando si debe estar inactivo), próxima a vencer, o si el responsable asignado se encuentra inactivo.

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

### Variables de Entorno — Seguridad / Auth
```env
FRONTEND_URL=http://localhost:5173   # URL base del frontend (usada en links de reset de contraseña)
EMAIL_FROM=no-reply@adldiagnostic.cl # Dirección remitente de correos del sistema
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
| **Recuperación de Contraseña** | Token SHA-256 + Nodemailer + ResetPasswordPage | ✅ Implementado |
| **Seguridad de Cuenta (S-13)** | Bloqueo por intentos fallidos + permisos_version JWT | ✅ Implementado |
| **Ayuda Contextual** | Componente Tooltip + Modal Global de Soporte (WhatsApp/Email) | ✅ Implementado |

---

*ADL One — Fase de personalización finalizada. En evolución hacia la Plataforma Digital Unificada ADL Diagnostic.*
