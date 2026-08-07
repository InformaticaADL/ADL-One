# ADL One - Backend API

Backend API para ADL One desarrollado con Node.js, Express y SQL Server.

## 🚀 Tecnologías

- **Node.js** - Runtime de JavaScript
- **Express** - Framework web
- **SQL Server (mssql)** - Base de datos
- **CORS** - Manejo de peticiones cross-origin
- **Helmet** - Seguridad HTTP
- **Morgan** - Logger de peticiones
- **Dotenv** - Variables de entorno

## 📁 Estructura del Proyecto

```
api-backend-adlone/
├── src/
│   ├── config/
│   │   └── database.js       # Configuración de SQL Server
│   ├── routes/
│   │   └── health.routes.js  # Rutas de health check
│   ├── controllers/          # Controladores (próximamente)
│   ├── models/              # Modelos (próximamente)
│   ├── middleware/          # Middleware personalizado (próximamente)
│   ├── utils/               # Utilidades (próximamente)
│   └── server.js            # Punto de entrada del servidor
├── .env                     # Variables de entorno
├── .env.example            # Ejemplo de variables de entorno
├── .gitignore
└── package.json
```

## ⚙️ Configuración

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar variables de entorno:**
   - Copia `.env.example` a `.env`
   - Actualiza las credenciales de SQL Server

3. **Configuración de red:**
   - El servidor está configurado para escuchar en `0.0.0.0` (todas las interfaces)
   - Usa la IP local del equipo servidor en la red; obténla con `ipconfig` (Windows) o `ip addr` (Linux)

## 🏃 Ejecución

**Modo desarrollo (con nodemon):**
```bash
npm run dev
```

**Modo producción:**
```bash
npm start
```

El servidor estará disponible en:
- Local: `http://localhost:5000`
- Red: `http://<IP-DEL-SERVIDOR>:5000` (reemplaza `<IP-DEL-SERVIDOR>` por la IP local del equipo)

## 📡 Endpoints Disponibles

### Root
- **GET** `/` - Información del servidor

### Health Check
- **GET** `/api/health` - Verifica el estado del servidor y la conexión a la base de datos

## 🔒 Seguridad

- Helmet para headers de seguridad HTTP
- CORS configurado para orígenes específicos
- Variables de entorno para datos sensibles

## 📝 Notas

- Asegúrate de tener SQL Server instalado y en ejecución
- Actualiza las credenciales de la base de datos en el archivo `.env`
- El servidor usa ES Modules (type: "module" en package.json)
