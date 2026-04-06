# ADL ONE - Frontend

Este es el repositorio del frontend para la aplicación ADL ONE, construida utilizando React, TypeScript y Vite.

## Cambios Recientes (Actualización)

Durante la última sesión de desarrollo se implementaron las siguientes características principales:

1. **Sistema de Notificaciones Contextuales:**
   - Incorporación de componentes de visualización de notificaciones para mostrar alertas del sistema y actualizaciones de estado a los usuarios.
   - Integración de notificaciones de manera global para advertencias en tiempo real.

2. **Gestión de Solicitudes (URS):**
   - Mejoras en el panel de detalles de la solicitud (`RequestDetailPanel`) incluyendo un **Historial de Acciones** interactivo en formato de línea de tiempo.
   - Implementación de flujos de control de estado: botones de acción rápida para marcar solicitudes según su estado (ej. "En Revisión").
   - Nueva funcionalidad para derivar solicitudes a través de modales dedicados (`DeriveRequestModal`).
   - Mejoras en la visualización de iconos de archivos adjuntos.

3. **Integración con el Backend:**
   - Ajustes en la configuración de la API.
   - Actualización sincrónica frente a los desarrollos de backend para URS y planificadores de tareas automáticas (Schedulers) para el ciclo de vida de las notificaciones e incidentes.

## Tecnologías Utilizadas

- **React:** Biblioteca de UI.
- **TypeScript:** Tipado estático para escalabilidad en JavaScript.
- **Vite:** Herramienta de construcción y servidor de desarrollo rápido.
- **Mantine UI:** Componentes de interfaz de usuario limpios y responsivos.
- **Tabler Icons:** Iconografía de la plataforma.

## Comandos Útiles

- `npm run dev`: Inicia el servidor de desarrollo local.
- `npm run build`: Compila la aplicación para producción.
- `npm run lint`: Ejecuta ESLint para mantener la calidad del código.
