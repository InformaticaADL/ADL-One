# ADL One - Sistema de Gestión Empresarial

Sistema empresarial profesional desarrollado con arquitectura moderna y escalable.

## 🏗️ Arquitectura del Proyecto

### Backend - Node.js + Express + SQL Server

```
api-backend-adlone/
├── src/
│   ├── config/              # Configuración de base de datos y servicios
│   │   ├── database.js
│   │   └── email.config.js
│   ├── controllers/         # Manejadores de peticiones HTTP (request/response)
│   │   ├── health.controller.js
│   │   ├── ficha.controller.js
│   │   └── auth.controller.js
│   ├── services/            # LÓGICA DE NEGOCIO (capa de inteligencia)
│   │   ├── health.service.js
│   │   ├── ficha.service.js
│   │   ├── auth.service.js
│   │   └── email.service.js
│   ├── models/              # Definición de esquemas de base de datos
│   ├── repositories/        # Consultas directas a la base de datos
│   ├── middlewares/         # Autenticación, validación, manejo de errores
│   │   ├── auth.middleware.js
│   │   ├── validation.middleware.js
│   │   ├── errorHandler.middleware.js
│   │   └── logger.middleware.js
│   ├── routes/              # Definición de endpoints de la API
│   │   ├── health.routes.js
│   │   ├── ficha.routes.js
│   │   └── auth.routes.js
│   ├── utils/               # Funciones de ayuda (helpers)
│   │   ├── logger.js
│   │   └── response.js
│   └── server.js            # Punto de entrada de la aplicación
├── logs/                    # Logs de la aplicación (auto-generados)
├── .env                     # Variables de entorno
├── .gitignore
└── package.json
```

---

## 🚀 Tecnologías Utilizadas

### Backend
- **Node.js** - Runtime de JavaScript
- **Express** - Framework web
- **SQL Server (mssql)** - Base de datos
- **Winston** - Sistema de logging profesional
- **JWT (jsonwebtoken)** - Autenticación
- **Joi** - Validación de esquemas
- **Bcrypt** - Encriptación de contraseñas
- **Nodemailer** - Envío de emails (Notificaciones)
- **Helmet** - Seguridad HTTP
- **Morgan** - Logger de peticiones HTTP
- **CORS** - Manejo de peticiones cross-origin

### Frontend
- **React 18** - Biblioteca de UI
- **Vite** - Build tool y dev server
- **TypeScript** - Tipado estático
- **Zustand** - State management
- **CSS3** - Estilos modernos con gradientes y animaciones

---

## 🎯 Características Implementadas

### Backend

✅ **Arquitectura en Capas**
- Controllers: Manejo de peticiones HTTP
- Services: Lógica de negocio
- Repositories: Acceso a datos
- Middlewares: Auth, validación, errores, logging

✅ **Sistema de Notificaciones (Nodemailer)**
- Envío asíncrono de correos (Fire and Forget)
- Configuración SMTP segura (SSL/TLS)
- Listas de distribución configurables por entorno (.env)

✅ **Autenticación y Autorización**
- Login Integrado con SQL Server
- Validación contra tabla `mae_usuario`
- JWT para sesiones stateless
- Propagación de ID de usuario a procesos de negocio

### Frontend

✅ **Arquitectura Modular**
- Componentes organizados por features
- Hooks personalizados reutilizables
- State management con Zustand

✅ **Diseño Profesional**
- Estilos CSS "Mobile First"
- Sistema de Drawer/Sidebar Responsivo
- Notificaciones Toast No-Bloqueantes

---

## ✨ Nuevas Implementaciones (Sprint Enero 2026)

### 1. Sistema de Autenticación 🔐
Se implementó un módulo de seguridad robusto que conecta directamente con los usuarios del sistema legacy.
- **Login Page**: Interfaz moderna con validación en tiempo real.
- **AuthContext**: Manejo de sesión global persistente en cliente.
- **Auditoría**: Todas las acciones (Crear, Aprobar, Rechazar) registran el ID real del usuario en la base de datos y tablas de auditoría.

### 2. Flujo de Trabajo Área Técnica 🧪
Módulo completo para la gestión y validación de Fichas Comerciales por el equipo técnico.
- **Vista de Detalle**: Reutilización de componentes comerciales para una vista "ReadOnly" segura.
- **Acciones**: Botones de **Aceptar** y **Rechazar** integrados con procedimientos almacenados.
- **Validación Backend**: Actualización de estados (`id_validaciontecnica`) y registro de observaciones.

### 3. Notificaciones por Correo 📧
Sistema de alertas automáticas para mantener informados a los involucrados en el flujo de la ficha.
- **Motor**: Nodemailer con transporte SMTP seguro.
- **Lógica de Negocio (Paridad Legacy)**:
  - **Aceptada**: Envío a lista de distribución técnica fija (e.g., Jefatura Técnica).
  - **Rechazada**: Envío a lista de distribución comercial fija.
- **Entornos**: Capacidad de redreccionar todos los correos a una cuenta de desarrollador en modo DEV.

### 4. Corrección de Errores y Estabilidad 🛠️
- **Crash Prevention**: Manejo de errores en carga de datos asíncronos (`response.data` unwrap).
- **State Integrity**: Restauración de variables de estado críticas en formularios complejos (`ReferenceError`).
- **Database Alignment**: Corrección de discrepancias en nombres de columnas (`id_cargo` vs `mam_cargo`).

### 5. Módulo de Planificación y Asignación (Medio Ambiente) 🗓️
Módulo avanzado para la gestión de agendas de muestreo, asignación de personal y equipos.
- **Visualización Integral**: Tabla detallada con información de fichas, estados, fechas y responsables.
- **Asignación Masiva e Individual**: Herramientas para asignar muestreadores (Instalación/Retiro) de forma eficiente.
- **Lógica de Guardado Inteligente (UPSERT)**: 
  - Prevención de duplicados en agenda (`App_Ma_Agenda_MUESTREOS`).
  - Actualización dinámica de resultados (`App_Ma_Resultados`) y equipos (`App_Ma_Equipos_MUESTREOS`).
- **Integridad de Datos**: Correcciones en procedimientos almacenados (`MAM_FichaComercial_ConsultaCoordinadorDetalle`) para asegurar la consistencia del campo Coordinador.
- **Experiencia de Usuario**: Redirect automático tras guardado y carga de datos existentes para edición.

### 6. Estandarización de Filtros Avanzados (UI/UX) 🔍
Unificación de la experiencia de búsqueda y filtrado en todos los módulos de gestión (Comercial, Coordinación, Técnica, Asignación).
- **Componente SearchableSelect**: Nuevo componente reutilizable con búsqueda integrada y autocompletado dinámico.
- **Funcionalidad de Limpieza**: 
  - Botón "Limpiar Todo" global.
  - **Limpieza Individual (X)**: Permite borrar filtros específicos sin afectar al resto de la selección.
- **Grillas Responsivas**: Layout estandarizado estilo "Nueva Ficha" para una interfaz limpia y consistente.
- **Ordenamiento Inteligente**: En el módulo de Asignación, las fichas se ordenan automáticamente por urgencia (Por Asignar > Pendiente > Ejecutado).

### 7. Mejoras de UI/UX y Estabilidad Móvil (Responsividad) 📱
Focalización en la experiencia de usuario en dispositivos móviles y tablets.
- **Eliminación de Flickers**: Implementación de estados de carga "full-screen" para evitar parpadeos visuales en transiciones de navegación.
- **Layouts Adaptables**: 
  - Las vistas de detalle (Técnica, Coordinación) ahora apilan verticalmente los campos de observación y botones de acción en móviles.
  - Ajuste de márgenes y paddings en modales y tablas para evitar desbordes.
- **Fix Visual Dashboard**: Corrección de fondo morado persistente mediante limpieza de estilos globales legacy en `App.css`.
- **Identidad de Usuario**: Personalización de avatar de usuario (`logo_user.png`) con ajustes de `object-fit` para visualización perfecta en el header.
- **Tablas Compactas**: Optimización de `AssignmentListView` y otras tablas para visualización tipo "Tarjeta" en pantallas pequeñas.

### 8. Recent Enhancements (January 30, 2026) 🆕
Focus on data integrity, user experience, and visual tracking of the workflow.

- **Commercial Edit Mode**: 
  - Enabled full editing capabilities for "Antecedentes" and "Análisis" in `CommercialDetailView`.
  - Implemented **Soft Delete** for analysis items (`activo = 0`) to preserve historical data integrity.
  - Added robust **Audit Logging** (`EDICION_COMERCIAL`) tracking user, timestamp, and changes.

- **Observation Timeline (Línea de Tiempo)**:
  - New visual component `ObservationTimeline.tsx` tracking the entire lifecycle: Creation -> Technical Approval -> Coordination -> Assignment.
  - Formatted messages to be user-friendly (e.g., "Ficha 61 creada por el Área Comercial").
  - Optimized performance with `useMemo` and `React.memo` to prevent re-renders and flickering.

- **Critical Fixes & Stability**:
  - **Hook Order Violation**: Resolved React crashes in Detail Views by ensuring consistent hook execution.
  - **Data Hydration**: Fixed issue where loading dependent catalogs would clear existing form data (implemented `hydrationEnabled` flag).
  - **UI Refinements**: Removed default expansion in timeline and improved text readability.

---


## 🔧 Configuración para Desarrollo

### Notificaciones de Correo
Para evitar el envío de correos a usuarios reales durante el desarrollo, configurar las siguientes variables en `.env`:

```env
# Email Recipients - DEVELOPMENT
EMAIL_TO_LIST=tu_correo_dev@adldiagnostic.cl
EMAIL_TO_REJECT_LIST=tu_correo_dev@adldiagnostic.cl
EMAIL_BCC_LIST=tu_correo_dev@adldiagnostic.cl
```

### Configuración SMTP
El sistema requiere un servidor SMTP válido:
```env
SMTP_HOST=mail.server.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=sender@server.com
SMTP_PASS=password
```

---

## 📄 Estado del Proyecto
✅ **Backend**: Node.js + Express (API RESTful, Auth, Email, SQL)
✅ **Frontend**: React + TypeScript (Dashboards, Formularios Complejos, Auth)
✅ **Base de Datos**: SQL Server (Procedimientos Almacenados, Transacciones)

### 9. UI Standardization & Refactoring (February 2026) 🎨
Complete alignment of visuals and behavior across Commercial, Technical, and Coordination modules to ensure a consistent user experience.

- **Unified Status System**:
  - Implemented a single color-coding logic across all list and detail views.
  - **Colors**: Purple (Programación), Amber (Área Técnica), Blue (Coordinación), Green (Vigente/Finalizado).
  - **Formatting**: Applied **Title Case** (e.g., "Pendiente Programación") for better readability.

- **Table Layout Optimization**:
  - **Fixed Layouts**: Standardized column widths (State: 160px, Actions: 50px) to prevent layout shifts.
  - **Emphasis**: Increased visual hierarchy for the "Estado" column.
  - **Cleanup**: Removed the "Usuario" column from Technical and Coordination views as requested.


### 10. Mejoras de Flujo de Trabajo e Integridad de Datos (5 de Febrero, 2026) 🔄
Mejoras importantes en validación de flujo de trabajo, consistencia de datos y experiencia de usuario en todas las tablas de consulta.

- **Sistema de Alertas en Cascada**:
  - Implementación de alertas contextuales en vistas de detalle de Área Técnica, Coordinación y Comercial.
  - **Área Técnica**: Bloquea acciones cuando el estado es Aprobada (1), Rechazada (2/4), En Proceso (5), Aprobada por Coordinación (6) o Anulada (7).
  - **Área Coordinación**: Bloquea acciones cuando el estado es Borrador (0), Rechazada (2/4), Pendiente Área Técnica (3), En Proceso (5), Aprobada (6) o Anulada (7).
  - **Área Comercial**: Solo alertas informativas (nunca bloquea acciones).
  - Asegura que los usuarios no puedan realizar operaciones inválidas según el estado actual del flujo de trabajo.

- **Gestión Inteligente de Frecuencia Correlativo**:
  - **Generación Automática**: Eliminada dependencia de SP poco confiable, ahora genera correlativos directamente en código.
  - **Formato**: `{id_ficha}-{numero_frecuencia}-{estado}-{id_agenda}` (ej: `62-1-Pendiente-596`).
  - **Reactivación Inteligente**: Al aumentar frecuencia, reactiva ítems de agenda previamente anulados (`ANULADA`) antes de crear nuevos.
  - **Anulación Suave**: Al reducir frecuencia, marca ítems excedentes como `ANULADA` y actualiza correlativo a `{id}-{num}-ANULA-{agenda}`.
  - **Persistencia**: Los correlativos se mantienen durante asignaciones de fechas/muestreadores.
  - **Sincronización de Estado**: Actualiza automáticamente `id_validaciontecnica = 5` (En Proceso) cuando se realizan asignaciones.
  - **Consistencia de Datos**: Asegura `estado_caso = ''` (string vacío) en todas las operaciones.

- **Corrección de Carga de Datos en Pestaña Análisis**:
  - Modificado SP `MAM_FichaComercial_ConsultaComercial_DET_unaficha` para usar `LEFT JOIN` en lugar de `INNER JOIN`.
  - Implementada consulta de respaldo en `ficha.service.js` si el SP falla.
  - Asegura que los datos de análisis se carguen correctamente incluso cuando tablas relacionadas no tienen registros coincidentes.

- **Mejoras de Diseño de Tablas y Paginación** (5 páginas de consulta):
  - **Estabilidad de Ancho de Columnas**: Corregido problema donde las columnas se comprimían al mostrar menos de 10 filas.
    - Reemplazadas filas vacías con `colSpan` por celdas `<td>` individuales que coinciden con el número de columnas.
    - Aplicado a: AssignmentListView (9 cols), CoordinationListView (11 cols), CoordinacionPage (10 cols).
  - **Reinicio Inteligente de Paginación**: Agregados hooks `useEffect` para reiniciar `currentPage` a 1 cuando cambia cualquier filtro.
    - Previene páginas vacías al filtrar desde números de página altos.
    - Aplicado a todas las páginas de consulta: Asignación, Coordinación, Comercial, Técnica y CoordinacionPage.

- **Archivos Modificados**:
  - Backend: `ficha.service.js` (9 cambios para lógica de correlativo)
  - Frontend: `TechnicalDetailView.tsx`, `CoordinacionDetailView.tsx`, `CommercialDetailView.tsx` (alertas en cascada)
  - Frontend: `AssignmentListView.tsx`, `CoordinationListView.tsx`, `CoordinacionPage.tsx`, `ComercialPage.tsx`, `TecnicaPage.tsx` (correcciones de tablas)
  - Base de Datos: SP `MAM_FichaComercial_ConsultaComercial_DET_unaficha` (corrección LEFT JOIN)

### 11. Mejoras en Notificaciones y Diseño de Email (6 de Febrero, 2026) 📧
Optimización completa del sistema de notificaciones por correo electrónico, enfocándose en diseño corporativo, detalle de información y precisión de datos.

- **Plantillas HTML Dinámicas y Corporativas**:
    - Implementación de un diseño unificado y profesional con logo corporativo (CID embedding) para compatibilidad con Outlook.
    - **Placeholders Estandarizados**: `{LOGO_BASE64}`, `{CORRELATIVO}`, `{USUARIO}`, `{FECHA}`.
    - **Variaciones de Estado**: Colores distintivos según el tipo de evento (Verde/Aprobado, Azul/Información, Rojo/Rechazo).

- **FICHA_ASIGNADA (Mejora Crítica)**:
    - **Desglose Detallado**: Ahora incluye lista completa de servicios asignados, con nombres de muestreadores (Instalación/Retiro) y fechas específicas.
    - **Precisión de Fechas**: Corrección de desfase de zona horaria (-1 día) mediante uso estricto de UTC en el backend.
    - **Atribución Correcta**: Implementación de lógica robusta para identificar al usuario asignador, priorizando "Nombre Completo" > "Login" > "Base de Datos".

- **Correcciones de Layout en Tablas (Frontend)**:
    - Replica exacta del diseño de "Gestión Coordinación" en "Planificación y Asignación".
    - **Propiedad Clave**: `table-layout: fixed` aplicada para forzar respeto de anchos de columna.
    - **Ajuste de Columnas**: N° Ficha (50px), Estado (160px) con ajuste de texto.

---

## 📄 Estado del Proyecto
✅ **Backend**: Node.js + Express (API RESTful, Auth, Email, SQL)
✅ **Frontend**: React + TypeScript (Dashboards, Formularios Complejos, Auth)
✅ **Base de Datos**: SQL Server (Procedimientos Almacenados, Transacciones)

### 12. Mejoras en Login y Sesión (Febrero 2026) 🔐
Optimización de la seguridad y experiencia de usuario en el proceso de autenticación.

- **Funcionalidad "Recuérdame" (Remember Me)**:
  - Implementación de persistencia opcional de credenciales (email) mediante `localStorage`.
  - Checkbox interactivo en el formulario de login que permite al usuario decidir si desea mantener su sesión activa por 30 días.

- **Gestión de Sesión Segura**:
  - Migración a `sessionStorage` como almacenamiento por defecto para tokens JWT.
  - Mejora la seguridad al asegurar que la sesión se cierre automáticamente al cerrar la pestaña o el navegador, a menos que el usuario haya seleccionado explícitamente "Recuérdame".

- **Recuperación de Contraseña (Forgot Password)**:
  - Nuevo enlace "¿Olvidaste tu contraseña?" en la pantalla de login.
  - **Modal Interactivo**: Diseño tipo overlay integrado en la tarjeta de login.
  - **Identidad Visual**: Cabecera con degradado azul corporativo y botones de acción con acentos naranja (`#ff9800`), alineados con el manual de marca.
  - Provee información clara de contacto con el área de informática (Email y Teléfono) para restablecimiento de claves.

- **Refinamiento UI/UX**:
  - Ajustes de espaciado (padding/margins) en el formulario de login para una apariencia más limpia y compacta.
  - Eliminación de bordes y sombras innecesarias en modales para un look "glassmorphism" moderno.

- **Seguridad de Navegación y Persistencia de Sesión**:
  - **Reset Automático de Navegación en Logout**: Implementación de función `resetNavigation()` en el store de navegación (Zustand) que se invoca automáticamente al cerrar sesión, previniendo que el siguiente usuario herede la navegación del usuario anterior.
  - **Guards de Permisos en Rutas**: Validación de permisos basada en RBAC antes de renderizar componentes administrativos en `DashboardPage.tsx`.
  - **Protección Multicapa**: 
    - `useEffect` guard que detecta y resetea automáticamente si un usuario sin permisos intenta acceder a módulos restringidos.
    - Render guard que muestra mensaje "Acceso Denegado" si se intenta renderizar contenido sin autorización.
  - **Validación por Permisos**: Sistema de control de acceso basado en permisos específicos (`MA_ADMIN_ACCESO`) en lugar de roles genéricos, permitiendo granularidad en el control de acceso.

### 13. Módulo de Gestión de Equipos y Solicitudes (Medio Ambiente) 🏗️
Se desarrolló un ecosistema completo para la gestión del inventario de equipos y el flujo de solicitudes desde terreno.

- **Saturación y Tipos de Solicitud**: 
  - Gestión centralizada de solicitudes de tipo **ALTA** (nuevos equipos), **TRASPASO** (cambio de ubicación/responsable) y **BAJA** (retiro de inventario).
  - Formularios dinámicos que adaptan sus campos según el tipo de solicitud seleccionada por el usuario.
- **Flujo de Aprobación Administrativa**: 
  - Interfaz de "Review" para administradores que permite validar los datos enviados por Medio Ambiente antes de impactar el inventario real.
  - Implementación de un proceso de aprobación simplificado para **ALTA** mediante diálogos de confirmación directa.
- **Control de Versiones y Trazabilidad**:
  - Sistema de **Snapshots** automáticos: cada edición guarda la versión anterior en `mae_equipo_historial` para permitir auditoría y restauración.
  - Preservación obligatoria de la primera versión del equipo para trazabilidad histórica.
- **Lógica de Generación de Códigos**: 
  - Cálculo automático de Siglas y Correlativos basados en el Tipo de Equipo y Sede.
  - Actualización dinámica del sufijo del código al realizar traspasos de ubicación.

### 14. Mejoras Funcionales y de Seguridad (Febrero 2026) 🔒
- **Manejo Automático de Errores 401**: Interceptor Axios global que gestiona sesiones expiradas, redirigiendo al usuario al login de forma segura.
- **Autocompletado Inteligente (Smart Fill)**: 
  - Al crear o aprobar un equipo, el sistema detecta equipos "plantilla" del mismo tipo para auto-poblar campos técnicos como **"Qué Mide"** y **"Unidad de Medida"**.
  - Mejora significativa en la velocidad de ingreso de datos y reducción de errores humanos.

### 15. Notificaciones Proactivas y Gestión Integrada (Febrero 2026) 🔔
Optimización del flujo de aprobación y comunicación entre el área de Medio Ambiente y Calidad.

- **Gestión Directa desde el Formulario**: 
  - El `EquipoForm` integra ahora una sección de **Solicitudes Pendientes**. Los administradores pueden procesar (Aprobar/Rechazar) cambios de ubicación, bajas o reactivaciones sin salir de la ficha del equipo.
  - Al aprobar, los datos se sincronizan y guardan automáticamente, eliminando redundancias.
- **Centro de Notificaciones Inteligente**:
  - **Redirección por Rol**: Las notificaciones redirigen al usuario según su necesidad comercial (`ma-solicitudes` para gestores) o administrativa (`gc-equipos` para revisores).
  - **Persistencia de Feedback**: Los resultados de las solicitudes se mantienen en la campana del solicitante con el motivo detallado de aprobación o rechazo.
- **Seguridad y Limpieza de Permisos**:
  - Remoción definitiva de permisos obsoletos (`AI_MA_NOTIF_REC/ENV`), consolidando el acceso mediante subpermisos granulares.
- **Prevención de Inconsistencias**:
  - Iconos de alerta `⚠️` y mensajes dinámicos que informan sobre trámites en curso para evitar ediciones conflictivas.

### 16. Mejoras de UI/UX y Estandarización de Headers Responsivos (23 de Febrero 2026) 🎨📱
Mejoras visuales y de layout enfocadas en consistencia, usabilidad móvil y ergonomía de formularios en los módulos de Medio Ambiente y Administración.

- **Selector de Tipo de Solicitud (`SolicitudesMaPage`)**:
  - Rediseño completo como grilla uniforme (3 columnas en móvil, 5 en escritorio).
  - Íconos SVG representativos por tipo de solicitud, estados activo/inactivo y alturas estandarizadas (`72px` móvil / `52px` escritorio).

- **Layouts de Formulario (Móvil)**:
  - **Reporte de Problema**: Wrapper `prob-tipo-frecuencia-row` con columnas `3fr 1fr` para que "Tipo de Problema" sea más ancho y "Frecuencia" más compacto.
  - **Solicitud Nuevo Equipo**: Wrapper `nuevo-eq-ubicacion-row` con columnas `2fr 1fr` y `align-items: end` para que "Ubicación" y "Fecha de Vigencia" queden lado a lado y alineados en la base.

- **Normalización de Pestañas (`SolicitudesMaPage`)**:
  - Unificación de `padding`, `font-size` (`0.85rem`) y estilo de borde inferior en las tres pestañas: **Pendientes**, **En Revisión** e **Historial**. Anteriormente tenían tamaños inconsistentes.

- **Patrón `responsive-header` — Todas las Páginas Hub y Admin**:
  - Nuevo layout de 3 columnas reutilizable: botón **Volver** a la izquierda | **Título + Subtítulo** centrado | acción opcional a la derecha.
  - En móvil, el CSS colapsa todos los elementos verticalmente y centrados (`flex-direction: column`).
  - Aplicado a: `EquiposHub`, `MuestreadoresPage`, `AdminMaHub`, `AdminInfoHub`, `InformaticaHub`, `NotificationEventsPage`, `NotificationRecipientsPage`.

- **Correcciones CSS (`admin.css`)**:
  - Agrega `flex-direction: column` y `align-items: center` a `.responsive-header > div` para evitar que `h1` y `p` queden en fila horizontal en móvil.
  - Incremento del gap móvil de `0.25rem` → `0.5rem` y margin-bottom de `0.5rem` → `0.75rem` para mejor separación visual.

- **Eliminación del Widget Reloj/Clima**:
  - Se eliminó el componente `WeatherClockWidget` del Dashboard principal para simplificar la vista de inicio.


