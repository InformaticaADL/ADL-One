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
- **Mantine UI v7** - Biblioteca de componentes y sistema de temas
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
  - **Área Técnica**: Bloquea acciones cuando el estado es Aprobada (1), Rechazada (2/4), En Proceso (5), Aprobada por Coordinación (6) o Cancelado (7).
  - **Área Coordinación**: Bloquea acciones cuando el estado es Borrador (0), Rechazada (2/4), Pendiente Área Técnica (3), En Proceso (5), Aprobada (6) o Cancelado (7).
  - **Área Comercial**: Solo alertas informativas (nunca bloquea acciones).
  - Asegura que los usuarios no puedan realizar operaciones inválidas según el estado actual del flujo de trabajo.

- **Gestión Inteligente de Frecuencia Correlativo**:
  - **Generación Automática**: Eliminada dependencia de SP poco confiable, ahora genera correlativos directamente en código.
  - **Formato**: `{id_ficha}-{numero_frecuencia}-{estado}-{id_agenda}` (ej: `62-1-Pendiente-596`).
  - **Reactivación Inteligente**: Al aumentar frecuencia, reactiva ítems de agenda previamente anulados (`CANCELADO`) antes de crear nuevos.
  - **Anulación Suave**: Al reducir frecuencia, marca ítems excedentes como `CANCELADO` y actualiza correlativo a `{id}-{num}-CANCEL-{agenda}`.
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

### 17. Permisos Granulares y Seguridad de Reportes (26 de Febrero 2026) 🔐📊
Se implementó un sistema de permisos más fino para el área de reportes y se corrigieron discrepancias de visibilidad en el servidor.

- **Nuevos Permisos de Reportes**:
    - `MA_A_REPORTES_DETALLE`: Permite ver el detalle extendido de una solicitud en la pestaña de reportes.
    - `MA_A_REPORTES_REVISION`: Permite solicitar revisiones técnicas de reportes existentes.
    - **Agrupación lógica**: Estos permisos se configuraron en `RoleModal.tsx` para aparecer agrupados bajo "Medio Ambiente" -> "Reportes".

- **Corrección de Visibilidad Global (Fix Técnico)**:
    - Se modificó el controlador `solicitud.controller.js` en el backend.
    - **El Problema**: Los usuarios del Área Técnica estaban restringidos por sección (sólo veían solicitudes de su área), mientras que Calidad tenía acceso global.
    - **La Solución**: Se añadió una excepción para que cualquier usuario con permisos de reportes (`MA_A_REPORTES`) se salte el filtrado por sección, garantizando paridad de información entre Calidad y Técnica.

### 18. Mejoras de UI/UX y Estética Premium (Febrero 2026) ✨🎨
Refinamiento visual para asegurar una interfaz profesional, centrada y adaptable.

- **Hubs Administrativos Centrados**:
    - Se corrigió la alineación de las tarjetas en `AdminMaHub.tsx`, `AdminGcHub.tsx` y `EquiposHub.tsx`.
    - Títulos y badges de "pendientes" ahora aparecen perfectamente centrados respecto al icono, eliminando el sesgo a la izquierda.
- **Optimización de SolicitudesMaPage**:
    - Centrado de pestañas y contenedores principales (max-width `1000px`).
    - Mejora en la visualización de la pestaña de **Reportes y Vouchers** para que sea responsiva y consistente con el diseño de Gestión de Equipos.
- **Visibilidad Basada en Roles**:
    - Los badges rojos de "pendientes" en los Hubs ahora son inteligentes: solo muestran conteos relevantes al rol del usuario (Técnica vs. Calidad).

### 19. Usabilidad Móvil y Accesibilidad 📱🚀
- **Filas Cliqueables**: En la gestión de roles, las filas de la tabla ahora son totalmente cliqueables en móviles para abrir el detalle directamente sin depender de botones pequeños.
- **Ocultamiento Inteligente**: Se implementó la clase `.mobile-hide` para ocultar elementos no críticos (como el widget de clima/reloj previo) en pantallas pequeñas, maximizando el espacio útil.
### 20. Diferenciación de Eventos en Calendario (Marzo 2026) 📅🔀
Mejoras en la vista de calendario para diferenciar visualmente entre eventos de Instalación y Retiro.

- **Eventos Separados (INICIO / RETIRO)**:
    - Transformación de datos de muestreo en eventos individuales de Instalación (`INICIO`) y Retiro (`RETIRO`).
    - Cada tipo de evento tiene indicadores visuales distintos (colores, etiquetas).
    - Vista diaria con tarjetas diferenciadas por tipo de evento.
- **Muestreador Correcto por Tipo de Evento**:
    - La query `getEnProcesoFichas` ahora incluye `LEFT JOIN` adicional a `mae_muestreador` para traer el nombre del muestreador de retiro (`muestreador_retiro`).
    - El modal del calendario muestra el muestreador correcto según el tipo de evento seleccionado.
- **Archivos Modificados**:
    - Backend: `ficha.service.js` (query `getEnProcesoFichas` con segundo JOIN a `mae_muestreador`)
    - Frontend: `EnProcesoCalendarView.tsx` (transformación de eventos, renderizado diferenciado)

### 21. Actualización de Filtros y Fuentes de Datos del Calendario (Marzo 2026) 🔍📊
Corrección de fuentes de datos para garantizar que los filtros del calendario y la vista de coordinación funcionen correctamente.

- **Filtros de Empresa y Muestreador**:
    - Empresa: Datos obtenidos de la tabla `sc_empresa`.
    - Muestreadores: Solo muestreadores habilitados desde `mae_muestreador`.
- **Corrección de Visualización de Fichas Pendientes**:
    - **Problema**: Las fichas recién aprobadas con estado `PENDIENTE PROGRAMACIÓN` (`id_validaciontecnica = 6`) no aparecían en la vista de Planificación y Asignación.
    - **Causa Raíz**: El SP `MAM_FichaComercial_ConsultaCoordinador` usaba `INNER JOIN` con `App_Ma_Agenda_MUESTREOS` y `mae_empresaservicios`, filtrando fichas que aún no tenían registros de agenda o cuyo ID de empresa servicio no existía en la tabla maestra.
    - **Solución**: Migración de todos los `INNER JOIN` a `LEFT JOIN` en el SP, permitiendo que fichas sin agenda o con datos maestros faltantes aparezcan correctamente.
- **Archivos Modificados**:
    - Base de Datos: SP `MAM_FichaComercial_ConsultaCoordinador` (todos los JOINs cambiados a LEFT JOIN)
    - Script local: `db_scripts/modify_assignment_sp.sql`

### 22. Flujo de Cancelación de Muestreos (Marzo 2026) ❌📋
Implementación del flujo completo de cancelación de eventos de muestreo desde el calendario.

- **Cancelación con Motivo**:
    - Botón de cancelación disponible en el modal de detalle del evento.
    - Registro del motivo de cancelación (`motivo_cancelacion`) en la base de datos.
    - Corrección del backend para guardar correctamente el motivo en la tabla `App_Ma_Agenda_MUESTREOS`.
- **Visualización de Estado**:
    - Los eventos cancelados se marcan visualmente y muestran el motivo registrado.
    - Bloqueo de acciones (guardar, reasignar) en eventos ya cancelados o con `id_validaciontecnica = 7`.
- **Archivos Modificados**:
    - Backend: `ficha.service.js` (función `cancelAgendaSampling`)
    - Frontend: `EnProcesoCalendarView.tsx` (UI de cancelación con motivo)

### 23. Equipos Duales por Muestreador y Versionamiento (Marzo 2026) 🔧📦
Mejoras profundas en la lógica de asignación de equipos para soportar muestreadores duales y control de versiones.

- **Equipos de Ambos Muestreadores**:
    - Al asignar un muestreo, se registran los equipos tanto del muestreador de **instalación** como del de **retiro**.
    - Se evitan duplicados si ambos muestreadores comparten equipos (validado por `id_equipo`).
    - Cada equipo registra a qué muestreador pertenece (`id_muestreador`).
- **Control de Versión de Equipos**:
    - Nueva columna `version` en `App_Ma_Equipos_MUESTREOS` para capturar la versión del equipo al momento de la asignación.
    - La versión se obtiene directamente de `mae_equipo.version` durante la inserción.
- **Prompt de Versión en Reagendamiento**:
    - Al reagendar un muestreo desde el calendario, se muestra un diálogo con dos opciones:
        - **"Mantener versión original"**: Preserva los equipos y versiones tal como fueron registrados originalmente.
        - **"Usar versión actual"**: Refresca los equipos y versiones desde la tabla maestra (`mae_equipo`).
    - Flag `actualizarVersiones` en el payload que controla el comportamiento del backend.
- **Simplificación de UI**:
    - Eliminada la sección de visualización de equipos del modal del calendario (a solicitud del usuario).
    - Eliminados los estados y efectos de fetch de equipos (`samplingEquipos`, `isLoadingEquipos`).
- **Archivos Modificados**:
    - Backend: `ficha.service.js` (función `batchUpdateAgenda` reescrita para lógica dual + versión)
    - Frontend: `EnProcesoCalendarView.tsx` (prompt de versión, eliminación de sección de equipos)
    - Base de Datos: `ALTER TABLE App_Ma_Equipos_MUESTREOS ADD version VARCHAR(50)`

### 24. Ordenamiento de Servicios en Notificaciones (Marzo 2026) 📧🔢
Corrección del orden de servicios en los correos de notificación `FICHA_ASIGNADA`.

- **Problema**: Los servicios asignados se listaban en orden lexicográfico (1, 10, 11, 12, 2, 3...) en lugar de numérico.
- **Solución**: Implementación de ordenamiento numérico en JavaScript antes del envío del correo, extrayendo el número de servicio del `frecuencia_correlativo`.
- **Archivos Modificados**:
    - Backend: `ficha.service.js` (lógica de ordenamiento en la sección de notificación `FICHA_ASIGNADA`)

### 25. Gestión de Muestreadores - Habilitación y Validación de Duplicados (Marzo 2026) 👤✅
Nuevas funcionalidades para la administración de muestreadores en el módulo de gestión.

- **Botón Habilitar Muestreador**:
    - Nuevo botón verde con ícono de verificación (✓) visible para muestreadores **inactivos**.
    - Modal de confirmación antes de ejecutar la habilitación.
    - Endpoint `PUT /api/admin/muestreadores/:id/enable` que actualiza `habilitado = 'S'` en `mae_muestreador`.
- **Validación de Duplicados al Crear**:
    - Al crear un nuevo muestreador, el sistema verifica automáticamente si ya existe uno con el mismo **nombre** o **correo electrónico**.
    - Si se detecta un duplicado, se muestra una advertencia amarilla con:
        - Nombre y correo del muestreador existente.
        - Estado actual (Activo/Inactivo).
        - Sugerencia de habilitarlo desde la lista si está inactivo.
    - La advertencia **bloquea** la creación hasta que se corrijan los datos.
    - Endpoint `GET /api/admin/muestreadores/check-duplicate?nombre=...&correo=...`.
- **Archivos Modificados**:
    - Backend: `admin.service.js` (funciones `enableMuestreador`, `checkDuplicateMuestreador`)
    - Backend: `admin.controller.js` (nuevos handlers)
    - Backend: `admin.routes.js` (nuevas rutas)
    - Frontend: `admin.service.ts` (nuevos métodos de API)
    - Frontend: `MuestreadoresPage.tsx` (botón habilitar + modal de confirmación)
    - Frontend: `MuestreadorModal.tsx` (validación de duplicados en formulario de creación)

### 26. Gestión de Solicitudes y Resolución de Identidades (Marzo 2026) 📝👤
Mejoras sustanciales en el módulo de "Gestión de Solicitudes" (`SolicitudesMaPage.tsx`) para optimizar la visualización de datos devueltos por la API aplicados a la lectura de jefaturas y administradores.

- **Despliegue Exacto de Código y Nombre (Equipos)**:
    - Modificada la columna `CÓDIGO/NOMBRE` para solicitudes de *ALTA* y *BAJA*.
    - Impresión directa del código real del equipo ingresado (desde `datos_originales` o estructura interna), erradicando el texto fallback `N/A`.
    - **Limpieza Visual**: Implementada una función regex de limpieza para evitar que el título del equipo reitere su código redundante entre paréntesis.

- **Resolución de Identidad del Solicitante (Nombres y Alias)**:
    - **Problema**: El campo "Solicitante" mostraba IDs numéricos asilados (ej. `394`) o alias de inicio de sesión genéricos (ej. `pflores`) dependiendo de qué proceso creaba u originaba la solicitud administrativa.
    - **Solución**: Implementada una **Estrategia de Resolución en Cascada** para forzar la visualización del nombre humano real (`Pablo Flores`):
        1. **Precarga Global**: Consumo y cacheo en memoria de `usuariosDB` (`/api/rbac/users`) y del catálogo de `muestreadores`.
        2. **Mapeo de IDs (Números)**: Búsqueda inversa cruzando el ID entrante contra la tabla local, extrayendo el campo `nombre_real` / `usuario`.
        3. **Mapeo de Alias (pflores)**: Normalización a `toUpperCase` y cruce del alias en minúsculas contra la BD. Si coincide, extrae forzosamente el valor formal alojado de forma cruzada en la BD (`nombre_real` vs `nombre_usuario`).
        4. **Resguardo Seguro**: Recorrido iterativo por lista de propiedades secundarias (`nombre_solicitante`, `nombre_completo`, etc.) antes de pintar textualmente el ID/Alias como último recurso.

- **Solución de Bugs Visuales Generales**:
    - Corrección del bloqueo mortal (pantalla en blanco) provocado por un tag React mal cerrado (`<p/>`) dentro de los modales.
    - Reparación de los "modales dobles" sobrepuestos al clickear "Ver Detalle" en la vista de Historial.
    - Las tablas del historial ahora logran filtrar y procesar con precisión la fecha original y el último estado.

---

### 27. Refinamiento de Notificaciones y Metadatos (Marzo 2026) 📧✨
Mejoras profundas en el sistema de notificaciones para proporcionar información detallada y comparativa en procesos de reprogramación.

- **Enriquecimiento de Metadatos (SQL)**:
    - Se corrigió la consulta de metadatos para incluir el nombre del **Cliente** real (desde `mae_empresa`) y diferenciarlo de la **Empresa de Servicio**.
    - Inclusión de nuevos placeholders: `{CLIENTE}`, `{PLANTA}` (alias de centro), `{CONTACTO_EMPRESA}`, `{CORREO_CONTACTO}`, `{MONITOREO}` y `{OBJETIVO}`.
    - Alineación con el esquema legacy: corrección de nombres de columnas (`nombre_tabla_largo`, `ma_coordenadas`, `ma_punto_muestreo`, `fichaingresoservicio`).
- **Filtrado Inteligente de Servicios**:
    - En correos de **REPROGRAMACIÓN**, el sistema ahora filtra y muestra **solo los servicios que sufrieron cambios** (fecha o muestreador).
    - Implementación de comparativa visual: ~~Valor Antiguo~~ ➔ **Valor Nuevo** para resaltar qué cambió exactamente.
    - Prevención de correos vacíos si no se detectan cambios reales durante el guardado.
- **Placeholders Flexibles**:
    - Implementación de búsqueda insensible a mayúsculas para `{servicios_detalle}` y otros bloques dinámicos.

### 28. Resolución de Errores Críticos de Backend (Marzo 2026) 🛠️🔒
- **Fix Error 500 (batch-agenda)**: Resolución de errores de SQL causados por nombres de tablas (`mae_entidad` -> `mae_empresaservicios`) y columnas incorrectas.
- **Integridad de Auditoría**: Aseguramiento de que el campo `correo_empresa` y otros datos de contacto se propaguen correctamente hacia el servicio de notificaciones.

---

### 29. Finalización de Módulo de Fichas y Planificación (Marzo 2026) 🛠️📋
Consolidación de reglas de negocio, validaciones y precisión operativa en el flujo de Fichas y Agenda.

- **Flexibilidad en Facturación**: Implementación de lógica para diferenciar el **Cliente (empresa a facturar)** de la **Empresa de Servicio**, asegurando que la facturación y la ejecución sean independientes.
- **Instrumento Ambiental**: Actualización del catálogo con nuevas opciones normativas: `- res sis` y `-dgtm`.
- **Estandarización de Medidas Técnicas**: Selección dinámica de unidades (**Metros o Pies**) en campos de canal y dispositivo, con persistencia automática de símbolos.
- **Validaciones de Integridad**: Nuevas reglas en el ingreso de análisis que exigen al menos **1 servicio** y **1 normativa** por cada registro.
- **Selección de Laboratorio por Parámetro**: Capacidad de asignar laboratorios específicos para cada parámetro individual dentro de una ficha.
- **Control de Visibilidad (Privacidad)**: Restricción de acceso a valores en **UF**, los cuales ahora solo son visibles para el **Área Comercial**.
- **Optimización de Comunicación Interna**: En el Área de Coordinación, se renombró la acción de "Rechazo" por **"Solicitar Revisión"** para fomentar un flujo de trabajo iterativo.
- **Precisión Cronológica en Planificación**:
    - Corrección del cálculo de **Fechas Recomendadas** basado en periodos numéricos reales.
    - Alineación: La **Fecha de Muestreo** se sincroniza ahora estrictamente con la **Fecha de Retiro**.
- **Gestión Maestra de Cancelaciones**: Integración con la tabla `mae_estadomuestreo` para proporcionar una lista cerrada de motivos de cancelación validados.

---

---

### 30. Dashboards Especializados y Analítica Avanzada (Marzo 2026) 📊📈
Nueva suite de visualización de datos diseñada para proporcionar inteligencia de negocio accionable por área.
- **Vistas Especializadas**: Implementación de dashboards dedicados para **Gestión Operativa**, **Servicios y Clientes**, y **Logística y Centros**.
- **Visualizaciones Complejas**: Integración de gráficos de Recharts (**Radar**, **Treemap**, **Composed Charts**) para analizar KPIs de rendimiento y distribución.
- **Interactividad**: Filtros dinámicos con capacidades de drill-down que permiten profundizar en la data temporal y geográfica de cada vista.

### 31. Refuerzo de Auditoría Global (Marzo 2026) 🛡️🔍
Mejoras en la capa de seguridad y trazabilidad para cumplir con estándares de auditoría técnica.
- **Captura Extensa de Metadatos**: El sistema ahora registra automáticamente la `ip_address`, `trace_id` y `metadatos_extra` en la tabla `App_Audit_Log`.
- **Middleware de Contexto**: Implementación de una utilidad global que propaga la identidad y el contexto del usuario a todas las capas del servicio (Backend).

### 32. Validación Estricta y Auto-Completado de Equipos (Marzo 2026) 📋⚡
Aseguramiento de la integridad de datos en el ingreso de inventario técnico.
- **Selección Estricta (Select-Only)**: Los campos de nombre de equipo, parámetros de medición y unidades ahora funcionan exclusivamente como selectores, eliminando la entrada de texto libre propensa a errores.
- **Sincronización Inteligente de Metadatos**: Al elegir un equipo, el formulario puebla automáticamente los campos "Qué Mide" y "Unidad de Medida" basándose en el registro maestro del catálogo.

### 33. Módulo de Administración de Información y Exportador de Datos (Marzo 2026) 📊
Nueva interfaz centralizada para la descarga y gestión de bases de datos maestras y resultados operativos.
- **Exportador Multi-Área**: Herramienta integrada en `AdminInfoHub.tsx` que permite exportar tablas (Maestros, Fichas, Solicitudes, Equipos) y procedimientos almacenados (SP) directamente a archivos Excel (`.xlsx`).
- **Descarga en Tiempo Real**: Visualización dinámica de recursos disponibles por área de negocio y generación de reportes personalizada.
- **Seguridad**: Acceso restringido mediante permisos específicos (`AI_MA_ADMIN_ACCESO`) y para usuarios administradores.

### 34. Rediseño Minimalista del Catálogo Maestro (Marzo 2026) ✨🛠️
Refinamiento visual profundo del gestor de modelos de equipos para garantizar una experiencia de usuario premium y eficiente.
- **Estética Premium**: Refactorización de `EquipoCatalogoView.tsx` utilizando una nueva arquitectura de clases CSS (`catalog-*-refined`) en `admin.css`.
- **Optimización de Espacio**: Implementación de un límite de desplazamiento (scroll) automático tras **6 elementos** en la tabla principal, maximizando la visibilidad del contenido circundante.
- **Mayor Detalle Técnico**: Inclusión de la columna **Sigla** en la vista de lista, permitiendo identificar abreviaturas de unidad de forma inmediata.
- **Refinamiento de Usabilidad (UX)**: 
    - Reducción de espacios en blanco (márgenes y rellenos) en la cabecera del Hub para "subir" el contenido principal.
    - Rediseño de formularios en cuadrículas de 2 columnas para una entrada de datos más organizada y compacta.
    - Micro-animaciones (fadeIn) y botones de acción estilizados con iconos minimalistas.

---

---

### 35. Motor de Notificaciones Universal (UNS) y Sincronización (Marzo 2026) 🔔🔄
Consolidación de las notificaciones como un servicio centralizado y reactivo a las preferencias del usuario.

- **Motor UNS (Universal Notification Service)**:
    - Implementación de un servicio unificado que gestiona tanto alertas en tiempo real (Socket.io) como correos electrónicos (Nodemailer).
    - **Priorización de Reglas**: Sistema inteligente que decide el destinatario basándose en la especificidad: Usuario > Rol > Aplicación.
    - **Soporte Transaccional**: Capacidad de manejar eventos complejos como comentarios en solicitudes y cambios de estado con placeholders dinámicos (`{{correlativo}}`, `{{usuario_accion}}`).

- **Sincronización Total con el Hub**:
    - Se eliminó la discrepancia entre la configuración visual y el motor interno.
    - Los cambios en los canales (activar/desactivar Email/Web) en el Hub administrativo se propagan automáticamente a la tabla de reglas maestras (`mae_notificacion_regla`).

- **Optimización de UX (Toast Shield)**:
    - Implementación de un "escudo" de 5 segundos durante el arranque de la aplicación para evitar que notificaciones antiguas o de sesión previa aparezcan como nuevas para el usuario.
    - Sincronización con el estado de carga del store de notificaciones (Zustand).

- **Plantillas Corporativas Refinadas**:
    - Diseño unificado de correos electrónicos con compatibilidad total para Outlook y dispositivos móviles.
    - Reversión a la identificación de usuario solicitada para mantener la paridad con el sistema legacy.

### 36. Resiliencia, Seguridad y Experiencia de Usuario (Marzo 2026) 🛡️✨
Consolidación de la estabilidad del sistema y mejora de la interfaz de soporte y navegación.

- **Gestión Avanzada de Contraseñas**:
    - **Seguridad**: Ampliación de la columna `clave_usuario` a `VARCHAR(100)` para soportar contraseñas largas y seguras.
    - **Feedback Visual**: Implementación de un indicador de fortaleza de contraseña en tiempo real con barra de progreso animada.
    - **Validaciones**: Prevención de contraseñas idénticas a la actual y validación de coincidencia instantánea en el formulario de cambio.

- **Navegación Inteligente y Contextual**:
    - **Landing Page unificada**: Ahora, al seleccionar un módulo principal (ej: Medio Ambiente), el sistema muestra por defecto la **WelcomePage** (Inicio) con avisos y eventos relevantes.
    - **Preservación de Contexto**: Al re-clickear una unidad ya activa, el sistema ya no resetea la vista, permitiendo que el usuario mantenga su trabajo en sub-páginas (como Fichas de Ingreso) sin interrupciones.

- **Gestión de Errores Críticos (Crash Prevention)**:
    - **ErrorBoundary Global**: Implementación de un "escudo" en `App.tsx` que captura fallos de renderizado y evita la pantalla en blanco.
    - **ErrorPage Personalizada**: Nueva interfaz de error que utiliza la estética del login (glassmorphism) para informar códigos de error de forma clara y profesional.

- **Centro de Ayuda y Soporte Integrado**:
    - **HelpCenter Modal**: Nuevo componente accesible desde el menú de usuario con acceso directo a soporte técnico vía **WhatsApp** (+56 9 5721 8268) y **Email** (informatica@adldiagnostic.cl).
    - **Base de Conocimientos (FAQ)**: Sistema de acordeones con respuestas a dudas frecuentes sobre el uso de la plataforma.

---

### 37. Personalización y Perfil de Usuario (Marzo 2026) 👤✨
Nueva interfaz dedicada para la gestión y visualización de la identidad del usuario en el sistema.
- **Página de Mi Perfil**: Landing page personalizada que consolida la información del usuario con un diseño moderno y minimalista.
- **Encabezado Premium**: Implementación de un header con degradados dinámicos que se adaptan al tema visual seleccionado.
- **Organización por Módulos**: Información dividida en tarjetas claras de "Información Personal" (datos básicos) y "Seguridad y Rol" (identificación técnica).
- **Atajos de Configuración**: Panel de preferencias integrado para cambios rápidos en la experiencia de usuario.
.

### 38. Módulo de Chat General (Tiempo Real) 💬⚡
Sistema de comunicación instantánea integrado para fomentar la colaboración entre los usuarios de ADL One.
- **Mensajería Omnicanal**: Soporte para chats directos (uno a uno) y creación de grupos de trabajo con múltiples integrantes.
- **Comunicación en Tiempo Real**: Motor basado en **Socket.io** que garantiza la entrega inmediata de mensajes y avisos de "nueva conversación".
- **Gestión de Multimedia**: Capacidad para adjuntar archivos y documentos directamente en el flujo de la conversación.
- **Herramientas Administrativas**: Funciones para limpiar historial, eliminar mensajes específicos y gestionar miembros en conversaciones grupales.
- **Integración con Perfiles**: Acceso rápido al perfil del contacto y posibilidad de marcar chats como favoritos para acceso prioritario.
- **Deep-linking de Notificaciones**: Redirección automática desde las notificaciones del sistema hacia la conversación específica del chat.

---

### 39. Consolidación de Validación Técnica y Segundo Laboratorio (Marzo 2026) 🧪🔬
Optimización del flujo de validación técnica y ampliación de las capacidades analíticas en el formulario de ingreso.

- **Integración de Segundo Laboratorio**:
    - El `AnalysisForm.tsx` ahora permite asignar un **Laboratorio Secundario** opcional por cada parámetro, además del laboratorio derivado principal.
    - Captura y persistencia de campos de **Error** (`llevaerror`, `error_min`, `error_max`) alineados con los requisitos de precisión del laboratorio.
- **Flujo de Trabajo Simplificado**:
    - Consolidación de las acciones de **Aprobar Ficha** y **Solicitar Revisión** dentro de la pestaña "Validación e Historial" en las vistas de detalle técnica y coordinación.
    - Eliminación de redundancia visual: los botones de estado en la cabecera fueron removidos para evitar confusiones de flujo.
- **Refactorización de UI (Mantine)**:
    - Reconstrucción completa del motor de selección de análisis para mayor rendimiento y limpieza visual.
    - Implementación de ScrollAreas independientes para búsqueda y configuración, mejorando la usabilidad en pantallas con muchos parámetros.
- **Robustez en Notificaciones (UNS)**:
    - Fusión de plantillas de notificación para soportar eventos de Ficha, GChat y Reporte de Problemas de Equipos de forma unificada en `uns.service.js`.

---

### 40. Restauración de Gestión de Equipos y Solicitudes (Marzo 2026) 🔧📝
Se restauraron y optimizaron funcionalidades críticas de inventario tras la integración de cambios.
- **Alertas en Tabla de Equipos**: Re-implementación de la columna de alertas en la tabla principal, permitiendo identificar equipos con solicitudes pendientes visualmente.
- **Acceso Rápido desde Edición**: Añadido un botón flotante (`Affix`) de **"Solicitudes"** en el formulario de edición de equipos, permitiendo ver el historial y estado de trámites sin cerrar el formulario.
- **Gestión de Solicitudes Optimizada**: Rediseño de las acciones en el modal de solicitudes, reemplazando botones directos por un menú desplegable (`Mantine Menu`) para una interfaz más limpia y profesional.
- **Lógica de Auditoría y Versiones**: Aseguramiento de la integridad de datos al aprobar o rechazar solicitudes de traspaso, baja o alta, manteniendo la trazabilidad en `mae_equipo_historial`.
- **Limpieza de Código**: Eliminación de dependencias obsoletas y estandarización de componentes con Mantine UI v7.

### 41. Visibilidad Genérica y Notificaciones de Acción (Marzo 2026) 🌐🔔
Mejoras en la arquitectura de visibilidad de solicitudes y refinamiento de la comunicación transaccional.

- **Visibilidad Dinámica Metadatos (`modulo_destino`)**:
    - Implementación de un sistema basado en metadatos para decidir qué tipos de solicitud aparecen en cada módulo de la UI (ej. Equipos).
    - Nueva columna `modulo_destino` en `mae_solicitud_tipo` y panel administrativo para su configuración, eliminando listas "hardcodeadas" en el frontend.
- **Inbox Universal Inteligente (UX/Nav)**:
    - **Auto-Tab Switching**: El buzón detecta automáticamente si una solicitud seleccionada es *Recibida* o *Enviada* y cambia de pestaña para asegurar su visibilidad.
    - **Auto-Scroll**: Implementación de desplazamiento automático suave hacia la solicitud seleccionada, facilitando la ubicación de trámites antiguos.
    - **Resolución de Bucles**: Optimización de hooks de React para evitar ciclos infinitos durante la sincronización de estados complejos.
- **Refinamiento de Notificaciones de Acción**:
    - **Detalle Completo en Emails**: Los correos de *Aceptar*, *Rechazar* y *Realizada* ahora inyectan dinámicamente el bloque de detalles (Equipo, Destino, Motivo), reparando la falta de contexto previa.
    - **Formato Web Humano**: Las alertas web ahora incluyen el nombre del autor entre corchetes (ej. `[Manuel Sanchez]: observaciones`) y utilizan estados legibles (ej. "Aceptada" en lugar de `ACEPTADA`).
    - **Soporte de Identificadores**: El motor de plantillas ahora admite tanto `nombre_equipo` como `nombre_equipo_full` para máxima compatibilidad con solicitudes de traspaso.

---

## 🏗️ Estructura Detallada del Proyecto (Frontend)

```
frontend-adlone/
├── src/
│   ├── components/          # Componentes comunes (Layouts, UI, Timeline, Toasts)
│   ├── features/            # Módulos por área de negocio
│   │   ├── admin/           # Gestión de Usuarios, Roles, Hubs, Notificaciones Premium
│   │   ├── medio-ambiente/  # Solicitudes, Equipos, Reportes y Vouchers
│   │   ├── comercial/       # Fichas Comerciales y Análisis
│   │   └── tecnica/         # Validaciones y Flujo Técnico
│   ├── services/            # Servicios de comunicación con API (Axios)
│   ├── contexts/            # Contextos de React (Auth, Permisos)
│   └── store/               # Estados globales con Zustand (NavStore)
```

## 📄 Estado Final del Proyecto
✅ **Backend**: Node.js + Express (API RESTful, Auth JWT, Notificaciones con Adjuntos, Lógica de Exportación a Excel, Auditoría Avanzada, Motor de Chat Socket.io)
✅ **Frontend**: React + TypeScript + Mantine UI (Calendario de Muestreos, Sistema de Temas Dinámicos, Perfil de Usuario, Módulo de Chat General, Exportador de Datos)
✅ **Base de Datos**: SQL Server (Procedimientos Almacenados optimizados, Auditoría de Equipos, Alineación de Esquemas, Logs de Auditoría Global, Esquema de Mensajería)

