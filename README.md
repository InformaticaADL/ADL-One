# ADL One - Sistema de Gestión Empresarial

Sistema empresarial profesional desarrollado con arquitectura moderna y escalable.

## 🏗️ Arquitectura del Proyecto

### Backend - Node.js + Express + SQL Server

```
api-backend-adlone/
├── src/
│   ├── config/              # Configuración de base de datos y variables de entorno
│   │   └── database.js
│   ├── controllers/         # Manejadores de peticiones HTTP (request/response)
│   │   └── health.controller.js
│   ├── services/            # LÓGICA DE NEGOCIO (capa de inteligencia)
│   │   └── health.service.js
│   ├── models/              # Definición de esquemas de base de datos
│   ├── repositories/        # Consultas directas a la base de datos
│   ├── middlewares/         # Autenticación, validación, manejo de errores
│   │   ├── auth.middleware.js
│   │   ├── validation.middleware.js
│   │   ├── errorHandler.middleware.js
│   │   └── logger.middleware.js
│   ├── routes/              # Definición de endpoints de la API
│   │   └── health.routes.js
│   ├── utils/               # Funciones de ayuda (helpers)
│   │   ├── logger.js
│   │   └── response.js
│   └── server.js            # Punto de entrada de la aplicación
├── logs/                    # Logs de la aplicación (auto-generados)
├── .env                     # Variables de entorno
├── .gitignore
└── package.json
```

### Frontend - React + Vite + TypeScript

```
frontend-adlone/
├── src/
│   ├── assets/              # Recursos estáticos
│   │   ├── images/
│   │   ├── icons/
│   │   └── fonts/
│   ├── components/          # Componentes globales reutilizables
│   │   ├── ui/              # Componentes de UI (Button, Input, Card)
│   │   └── layout/          # Componentes de layout (Header, Footer, Sidebar)
│   ├── features/            # Módulos específicos por funcionalidad
│   │   └── [feature]/
│   │       ├── components/  # Componentes específicos del módulo
│   │       ├── hooks/       # Hooks específicos del módulo
│   │       └── services/    # API calls específicas del módulo
│   ├── hooks/               # Custom hooks globales
│   │   ├── useApi.ts
│   │   └── useLocalStorage.ts
│   ├── pages/               # Vistas completas asociadas a rutas
│   │   └── HomePage.tsx
│   ├── store/               # Gestión de estado global (Zustand)
│   │   └── authStore.ts
│   ├── services/            # Configuración de API Client
│   │   └── api.service.js
│   ├── config/              # Configuración de la aplicación
│   │   └── api.config.js
│   ├── App.tsx              # Router y proveedores globales
│   └── main.tsx             # Punto de entrada
├── .env
├── vite.config.ts
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
- **Nodemailer** - Envío de emails
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

## ⚙️ Configuración

### Variables de Entorno - Backend (.env)

```env
# Server Configuration
PORT=8002
NODE_ENV=development
HOST=0.0.0.0

# SQL Server Configuration
DB_SERVER=localhost
DB_PORT=1433
DB_DATABASE=YourDatabase
DB_USER=your_user
DB_PASSWORD=your_password
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true

# JWT Configuration
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=24h

# SMTP Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=true

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
```

### Variables de Entorno - Frontend (.env)

```env
VITE_API_URL=http://localhost:8002
```

---

## 🌐 Configuración de Red

### IPs Detectadas
- **Localhost:** `127.0.0.1`

### Endpoints Configurados

**Backend API:**
- `http://localhost:8002`

**Frontend:**
- `http://localhost:5173`

**Base de Datos:**
- Servidor: `your_server:1433`
- Base de datos: `YourDatabase`

---

## 📦 Instalación

### Backend

```bash
cd api-backend-adlone
npm install
npm run dev
```

### Frontend

```bash
cd frontend-adlone
npm install
npm run dev
```

---

## 🎯 Características Implementadas

### Backend

✅ **Arquitectura en Capas**
- Controllers: Manejo de peticiones HTTP
- Services: Lógica de negocio
- Repositories: Acceso a datos
- Middlewares: Auth, validación, errores, logging

✅ **Sistema de Logging**
- Winston con rotación de archivos
- Logs separados por nivel (error, info, debug)
- Logging de todas las peticiones HTTP

✅ **Autenticación y Autorización**
- JWT para autenticación
- Middleware de autorización por roles
- Bcrypt para encriptación de contraseñas

✅ **Validación de Datos**
- Joi para validación de esquemas
- Middleware de validación reutilizable
- Respuestas estandarizadas

✅ **Manejo de Errores**
- Error handler centralizado
- Logging automático de errores
- Respuestas de error consistentes

✅ **Seguridad**
- Helmet para headers HTTP seguros
- CORS configurado
- Variables de entorno para secretos

✅ **Base de Datos**
- Conexión a SQL Server
- Pool de conexiones
- Health check con información de DB

### Frontend

✅ **Arquitectura Modular**
- Componentes organizados por features
- Hooks personalizados reutilizables
- State management con Zustand

✅ **Diseño Profesional**
- Gradientes modernos
- Animaciones suaves
- Responsive design
- Tipografía Inter de Google Fonts

✅ **Gestión de Estado**
- Zustand para estado global
- Persistencia en localStorage
- Auth store configurado

✅ **API Integration**
- Cliente API centralizado
- Manejo de errores
- Timeout configurado
- Selector de endpoints

---

## 📸 Capturas de Pantalla

### Conexión Exitosa a Base de Datos

![Conexión a Base de Datos](file:///C:/Users/vremolcoy/.gemini/antigravity/brain/c2b3c6c0-5046-47e8-9d32-50c2140fa053/final_status_check_1768504936702.png)

La aplicación muestra:
- ✅ Servidor Activo
- ✅ Base de datos: **connected**
- ✅ Estado: **healthy**
- ✅ DB: **PruebasInformatica**

---

## 🔧 Próximos Pasos

### Desarrollo de Funcionalidades

1. **Autenticación**
   - Login/Registro
   - Recuperación de contraseña
   - Gestión de sesiones

2. **Módulos de Negocio**
   - Gestión de pacientes
   - Diagnósticos
   - Facturación
   - Reportes

3. **Base de Datos**
   - Crear modelos de datos
   - Implementar migraciones
   - Crear repositorios

4. **Testing**
   - Pruebas unitarias
   - Pruebas de integración
   - Pruebas end-to-end

5. **Documentación**
   - Swagger/OpenAPI
   - Documentación de API
   - Guías de usuario

---

## 📝 Comandos Útiles

### Backend
```bash
npm run dev      # Iniciar con nodemon (auto-reload)
npm start        # Iniciar en modo producción
```

### Frontend
```bash
npm run dev      # Iniciar servidor de desarrollo
npm run build    # Compilar para producción
npm run preview  # Vista previa del build
```

---

## 🏆 Mejores Prácticas Implementadas

- ✅ Separación de responsabilidades (MVC)
- ✅ Inyección de dependencias
- ✅ Manejo centralizado de errores
- ✅ Logging estructurado
- ✅ Validación de datos
- ✅ Seguridad (JWT, Helmet, CORS)
- ✅ Variables de entorno
- ✅ Código modular y reutilizable
- ✅ TypeScript para type safety
- ✅ State management profesional

---

## 📄 Licencia

Proyecto privado - ADL Diagnostic

---

## 👥 Equipo

Desarrollado para ADL Diagnostic

---

## 🎉 Estado del Proyecto

✅ **Proyecto configurado y funcionando**
- Backend conectado a SQL Server
- Frontend comunicándose con backend
- Arquitectura profesional implementada
- Listo para desarrollo de funcionalidades

---

## 📌 Implementación Ficha de Ingreso - Antecedentes

### Versión Actual: 1.0.0 (Antecedentes Completo)

Se ha implementado el módulo de Ficha de Ingreso, pestaña "Antecedentes", integrando la lógica de negocio migrada de FoxPro a una arquitectura Web moderna (React + Node.js).

### Detalles Técnicos de Implementación

#### 1. Frontend: AntecedentesForm.tsx
- **Arquitectura de Componentes**: Formulario monolítico con gestión de estado local optimizado, integrado en layout de pestañas persistentes.
- **Gestión de Estado (Catalog Loading)**:
  - Implementación de `SearchableSelect` para dropdowns con miles de registros (e.g. Empresas, Clientes).
  - Estrategia de carga "Split Batch" para `loadCatalogosComplementarios`:
    - *Batch 1 (Light)*: Componentes, Inspectores, Tipos Muestreo/Descarga.
    - *Batch 2 (Heavy)*: Cargos, Frecuencias, Dispositivos, Formas Canal.
  - Mapeo y normalización de datos backend (e.g. `nombre_frecuencia` -> `nombre`).
- **Lógica de Cascada (Dependency Chain)**:
  - `Empresa` -> `Centro` -> `Contacto`.
  - `Tipo Muestreo` -> `Tipo Muestra` -> `Actividad`.
  - `Componente` -> `SubArea`.
  - `Forma Canal` -> `Detalle`.
- **Persistencia UI**: Uso de `display: none` en `ComercialPage` para mantener el estado del formulario al navegar entre pestañas.

#### 2. Backend: API Catalogos
- **Endpoints**: `/api/catalogos/*`.
- **Stored Procedures Integrados**:
  - `Consulta_Mae_Formacanal`
  - `Consulta_Mae_Dispositivohidraulico`
  - `consulta_centro` (Filtrado en memoria por performance).
  - `maestro_empresaservicio` (Optimizado).
- **Controladores**: Implementación de manejo de errores robusto y logs detallados.

### Instrucciones de Uso (Desarrollador)
- **Navegación**: El formulario se encuentra en `/comercial` (ComercialPage).
- **Debug**: Revisar consola del navegador para logs de carga de catálogos y validaciones de cascada.
