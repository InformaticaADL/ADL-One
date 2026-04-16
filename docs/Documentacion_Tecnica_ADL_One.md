# Dossier Técnico Integral: Ecosistema ADL One

Este documento proporciona una visión exhaustiva de la arquitectura, lógica de negocio y estructura de datos de la plataforma ADL One.

---

## 1. Arquitectura General y Stack Tecnológico

La plataforma ADL One está diseñada como un ecosistema distribuido que integra gestión comercial, técnica y operativa en terreno.

- **Servidor (Backend)**: Node.js con Express.
- **Base de Datos**: Microsoft SQL Server (MSSQL).
- **Frontend Web**: React con TypeScript.
- **App Móvil**: React Native (Integración con samplers).
- **Comunicación en Tiempo Real**: Socket.io para notificaciones instantáneas.
- **Gestión de Archivos**: Almacenamiento local de adjuntos y firmas digitales.
- **Envío de Correos**: Integración con SMTP vía Nodemailer.

---

## 2. Seguridad y Control de Acceso (RBAC)

El sistema implementa un modelo de Control de Acceso Basado en Roles (RBAC) altamente granular.

### Lógica de Autenticación
- El usuario se autentica mediante su `nombre_usuario` y `clave_usuario`.
- La sesión se gestiona mediante JSON Web Tokens (JWT).
- Se verifica el estado `habilitado = 'S'` en la tabla `mae_usuario`.

### Roles y Permisos
- **Usuarios**: Entidades individuales vinculadas a cargos.
- **Roles**: Agrupaciones de permisos (ej: SuperAdmin, Coordinador Técnica, Muestreador).
- **Permisos**: Acciones específicas dentro de módulos (ej: `RBAC_MANAGE`, `MA_FICHA_TECNICA`, `URS_RESOLVER`).

### Tablas Principales
| Tabla | Descripción |
| :--- | :--- |
| `mae_usuario` | Maestro de usuarios (credenciales, contacto, estado). |
| `mae_rol` | Catálogo de roles disponibles. |
| `mae_permiso` | Catálogo de todos los permisos atómicos del sistema. |
| `rel_usuario_rol` | Relación N:N entre usuarios y roles. |
| `rel_rol_permiso` | Relación N:N entre roles y sus permisos concedidos. |

---

## 3. Sistema de Fichas de Ingreso (MAM - Medio Ambiente)

Este es el módulo central para la gestión de servicios de muestreo.

### Flujo de Vida de una Ficha
1.  **Ingreso Comercial**: Se crea la ficha con antecedentes generales, cliente, fuente (centro) y parámetros a analizar.
2.  **Revisión Técnica**: Un usuario con permisos técnicos valida que los parámetros y normativas sean correctos.
3.  **Aprobación/Validación**: Se asigna un Inspector Ambiental y un estado de validación global.
4.  **Agendamiento**: El sistema genera automáticamente los servicios basados en la frecuencia y total de servicios definidos.
5.  **Asignación**: Se asigna un Muestreador (ejecutor) a cada servicio de la agenda.
6.  **Ejecución en Terreno**: El muestreador utiliza la App Móvil para registrar datos, fotos y firmas.
7.  **Finalización y Cierre**: Los datos se sincronizan y la ficha pasa a etapa de resultados.

### Funcionalidades Específicas
- **Edición Técnica**: Permite modificar normativas y parámetros en fichas ya creadas.
- **Reagendar**: Cambiar fechas de muestreo programadas según disponibilidad.
- **Cancelación**: Anulación de servicios programados con registro de motivo.
- **Remuestreo**: Creación de una nueva ficha vinculada a una anterior para repetir análisis fallidos.

### Tablas Principales
| Tabla | Descripción |
| :--- | :--- |
| `App_Ma_FichaIngresoServicio_ENC` | Encabezado de la ficha (Cliente, Fuente, Fechas generales, Estado global). |
| `App_Ma_FichaIngresoServicio_DET` | Detalle de parámetros/técnicas a analizar por cada ficha. |
| `App_Ma_Agenda_MUESTREOS` | Calendario de ejecuciones individuales (Agenda). |
| `mae_muestreador` | Registro de personal técnico de terreno. |
| `mae_equipo` | Maestro de equipos utilizados en el muestreo. |

---

## 4. Sistema Unificado de Solicitudes (URS)

Gestión de requerimientos internos relacionados con logística, equipos y personal.

### Tipos de Solicitud
- **Traspaso de Equipos**: Cambio de custodia de un equipo de un muestreador a otro.
- **Baja de Equipo**: Reporte de equipo dañado o perdido.
- **Cancelación de Muestreo**: Solicitud formal para suspender una ficha agendada.
- **Reporte de Problema / Ayuda**: Consultas técnicas directas.

### Ciclo de Solicitud
- **Creación**: El usuario (web o móvil) llena un formulario dinámico según el `id_tipo`.
- **Derivación**: La solicitud se asigna a un área (`area_actual`) o usuario específico.
- **Interacción**: Hilo de chat con capacidad de adjuntos entre solicitante y resolutor.
- **Resolución**: Marcado como 'CERRADA' o 'RECHAZADA' con historial de acciones.

### Tablas Principales
| Tabla | Descripción |
| :--- | :--- |
| `mae_solicitud` | Registro principal de cada solicitud creada. |
| `mae_solicitud_tipo` | Configuración de tipos y formularios dinámicos (JSON). |
| `mae_solicitud_comentario` | Mensajes e interacción dentro de la solicitud. |
| `mae_solicitud_derivacion` | Historial de quién ha tenido la solicitud en custodia. |
| `mae_solicitud_adjunto` | Archivos (evidencias, fotos) vinculados a la solicitud. |

---

## 5. Sistema de Notificaciones (UNS)

El Unified Notification System asegura la sincronización de información entre todas las áreas.

### Canales
- **Notificación Web**: Avisos en la campana del dashboard (vía Socket.io y tabla `mae_notificacion`).
- **Correo Electrónico**: Envíos automáticos basados en eventos (`FICHA_CREADA`, `SOLICITUD_ASIGNADA`).

### Lógica de Disparo
1. Un servicio (ej: `UrsService`) termina una acción y llama a `uns.trigger(evento, contexto)`.
2. El sistema busca en `mae_evento_notificacion` la plantilla de correo.
3. Se resuelven los destinatarios en `rel_evento_destinatario` (pueden ser usuarios fijos o roles completos).
4. Se envían los avisos.

---

## 6. Módulo de Administración y Catálogos

Gestión de la información base necesaria para la operación.

- **Administración de Equipos**: Trazabilidad de cada equipo (`mae_equipo`), sus certificados y estado de calibración.
- **Administración de Muestreadores**: Datos personales, empresa externa (si aplica) y zona de operación.
- **Catálogos de Parámetros**: Listado de técnicas, normativas y laboratorios autorizados para los análisis.
- **Gestión de Clientes y Fuentes**: Jerarquía de Empresas -> Centros (Plantas) -> Puntos de Muestreo.

---

## 7. Diccionario de Datos Destacado

### Tabla: `App_Ma_FichaIngresoServicio_ENC` (Campos Críticos)
- `id_fichaingresoservicio`: PK Correlativo.
- `id_empresa`: FK al cliente.
- `id_centro`: FK al punto de origen/planta.
- `estado_ficha`: Controla el flujo (VIGENTE, CERRADA, ANULADA).
- `id_validaciontecnica`: Estado de aprobación (1: Pendiente, 2: Aprobada, 3: Rechazada, etc.).

### Tabla: `mae_solicitud` (Campos Críticos)
- `id_tipo`: FK a `mae_solicitud_tipo`.
- `id_solicitante`: Usuario que genera el requerimiento.
- `datos_json`: Almacena las respuestas del formulario dinámico de forma flexible.
- `area_actual`: Indica qué departamento debe resolver (Sistemas, Logística, Técnica).

---

**Fin del Documento**
