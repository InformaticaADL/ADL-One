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
