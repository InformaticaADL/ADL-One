# Arquitectura y Diseño del Sistema: ADL ONE

Este documento proporciona una visión general técnica de la arquitectura, metodología de desarrollo y funcionalidades principales de la plataforma **ADL ONE**.

## 1. Arquitectura del Sistema

La plataforma sigue un modelo de arquitectura de cliente-servidor moderno, diseñado para ser escalable, seguro y reactivo.

### Backend (Core API)
- **Motor**: Node.js con el framework Express.
- **Base de Datos**: Microsoft SQL Server (MSSQL), gestionado mediante un pool de conexiones optimizado.
- **Seguridad**: 
    - Autenticación robusta basada en **JWT (JSON Web Tokens)**.
    - Encriptación de credenciales con **bcryptjs**.
    - Sistema de **RBAC (Role-Based Access Control)** para gestión granular de permisos.
- **Tiempo Real**: Integración de **Socket.io** para habilitar comunicación bidireccional instantánea (notificaciones y chat).
- **Procesamiento en Segundo Plano**: Un sistema de **Scheduler (Vigilante)** personalizado que ejecuta tareas críticas:
    - Verificación diaria de vencimientos de equipos.
    - Procesamiento y remapeo inteligente de solicitudes URS cada 20 segundos.

### Frontend (User Experience)
- **Framework**: **React 19** con **Vite** como herramienta de construcción, garantizando tiempos de carga y respuesta mínimos.
- **Lenguaje**: **TypeScript**, proporcionando una base de código robusta, tipada y fácil de mantener.
- **Estado Global**: **Zustand**, utilizado para una gestión de estado ligera y eficiente (sesiones, notificaciones, configuración).
- **Sistema de Diseño**: 
    - **Mantine v8**: Utilizado para la estructura principal, componentes modernos y diseño "premium".
    - **Ant Design**: Empleado para componentes de datos complejos y consistencia en el panel administrativo.
- **Reporting**: Motor de generación de documentos dinámicos (PDF y Excel) directamente desde el cliente.

---

## 2. Metodología de Desarrollo

El desarrollo de ADL ONE se rige por principios de ingeniería de software modernos:

- **Feature-Based Architecture**: El código está organizado por módulos funcionales (Features). Cada funcionalidad (como `urs`, `admin`, `auth`) contiene sus propios componentes, servicios y lógica, lo que permite un desarrollo aislado y escalable.
- **Standardized UI/UX**: Se utiliza un sistema de diseño centralizado con layouts fluidos y cajas contenedoras estándar, asegurando que la experiencia de usuario sea consistente en todos los módulos.
- **Type Safety**: El uso estricto de TypeScript en todo el stack frontend previene errores en tiempo de ejecución y mejora la documentación interna del código.
- **Performance Driven**: Optimización de peticiones al backend mediante middlewares de compresión y manejo eficiente del DOM en el frontend.

---

## 3. Funciones Principales

### Sistema de Solicitudes (URS / Avisos)
Es el núcleo operativo del sistema, permitiendo:
- Creación y seguimiento de diversos tipos de avisos (Problemas, Extravíos, Consultas de Gestión).
- Lógica de remapeo automático: El sistema identifica el contexto de la solicitud y la clasifica inteligentemente (ej. diferenciando consultas de equipo vs. consultas de servicio).
- Flujo de estados dinámico con notificaciones a los responsables.

### Gestión de Activos y Equipos
- Inventarios detallados de equipos fijos y móviles.
- Control de disponibilidad en tiempo real (`esta_ocupado`, `es_fijo`).
- Alertas automáticas de mantenimiento y vencimiento de certificaciones.

### Centro de Notificaciones y Comunicación
- Alertas visuales y sonoras en tiempo real.
- Notificaciones vía correo electrónico automatizadas.
- Chat interno para coordinación entre usuarios y administración.

### Reportabilidad y Documentación
- Dashboards interactivos con analíticas de gestión.
- Exportación masiva de datos a Excel.
- Generación automática de documentos técnicos y comprobantes en PDF.

---

## 4. Lógica Detallada de Módulos Críticos

### Sistema de Solicitudes (URS)
El motor de URS (User Request System) funciona como un orquestador de flujos de trabajo dinámicos:
- **Estructura de Datos Flexible**: Utiliza un campo `datos_json` para almacenar metadatos específicos de cada formulario. Esto permite que el sistema maneje desde reportes de extravío hasta solicitudes de traspaso complejas sin cambios en el esquema de la base de datos.
- **Motor de Remapeo (Vigilante)**: Un scheduler en el backend analiza periódicamente solicitudes genéricas y las reclasifica inteligentemente basándose en el contenido de sus metadatos (ej. vinculándolas automáticamente a un equipo o una ficha de servicio específica).
- **Hilo de Gestión**: Cada solicitud actúa como un canal de comunicación dedicado donde se registran comentarios, adjuntos y cambios de estado del sistema de forma cronológica.
- **Automatización de Acciones**: Ciertos cambios de estado (como marcar una solicitud como "Realizada") disparan procesos automáticos en otros módulos, como la actualización física de responsables de equipos o la deshabilitación de cuentas de usuario.

### Motor de Chat (General Chat)
El sistema de chat está diseñado para comunicaciones corporativas seguras y en tiempo real:
- **Arquitectura de Salas**: Utiliza **Socket.io** para gestionar salas de chat aisladas (`Rooms`) por cada conversación, ya sea directa (1 a 1) o de grupo.
- **Persistencia y Auditoría**: Todos los mensajes se almacenan en la base de datos para consulta histórica, pero el sistema implementa una lógica de "Ocultamiento Temporal" que permite a los usuarios limpiar su vista sin perder el historial en el servidor.
- **Confirmación de Lectura**: Rastreo detallado de lectura por mensaje, permitiendo saber exactamente quién ha visto cada comunicación en grupos y chats directos.
- **Notificaciones Reactivas**: Si un usuario no está dentro del módulo de chat, el sistema utiliza un canal de WebSockets global para emitir alertas visuales (Toasts) inmediatas al recibir un mensaje nuevo.

---

## 4. Estado Visual y Diseño
ADL ONE se diferencia por su estética **Premium**:
- Soporte para **Modo Oscuro** y temas visuales coherentes.
- Layouts responsivos que se adaptan a diversos tamaños de pantalla.
- Micro-animaciones suaves para mejorar la retroalimentación al usuario.
