// Modo FORK con una sola instancia para el backend — a propósito, NO cluster.
// Este backend usa global.io (Socket.IO) y un scheduler con cron jobs (Daily
// check, URS Watcher, Muestreo Completado Watcher, Folio SII Watcher, etc.).
// En cluster, cada worker tendría su propia memoria: las notificaciones en
// tiempo real no llegarían a usuarios conectados a otro worker, y los cron
// jobs se ejecutarían duplicados en paralelo (emails/notificaciones dobles).
module.exports = {
  apps: [
    {
      name: "adl-one-backend",
      script: "src/server.js",

      instances: 1,
      exec_mode: "fork",

      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: "2G",

      error_file: "./logs/adl-one-backend-error.log",
      out_file: "./logs/adl-one-backend-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,

      // PORT fijado explícitamente acá: gana siempre sobre cualquier
      // variable de entorno heredada del sistema/sesión (ver PORT=3001
      // que causó el conflicto con ADL WEB GO el 2026-09-29).
      env: {
        NODE_ENV: "development",
        PORT: 8002,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 8002,
      },
    },
    {
      // Sirve el build estático (frontend-adlone/dist) — no existía ningún
      // servidor para esto en 192.168.10.28 (sin IIS, nada en :5174) hasta
      // el 2026-09-29. Se probó `serve` (vercel) primero, pero esa versión
      // (14.2.6) falla headless bajo PM2 ("getaddrinfo ENOTFOUND -l") aunque
      // corre perfecto en una terminal interactiva — parece un bug de esa
      // versión ligado a su función de copiar al portapapeles, que no tiene
      // sentido sin TTY. http-server no tiene nada interactivo, así que no
      // sufre este problema.
      // En Windows, PM2 resuelve binarios globales de npm al wrapper .cmd y
      // lo ejecuta directo con Node (falla: Node intenta parsear el .cmd
      // como JS). Pasarlo por cmd.exe hace que Windows resuelva e invoque
      // el wrapper correctamente.
      name: "adl-one-frontend",
      script: "cmd.exe",
      // -c-1: sin caché. Por defecto http-server manda `Cache-Control: max-age=3600`
      // y el navegador conservaba index.html hasta una hora tras cada despliegue,
      // dejando a los usuarios con la versión vieja. Los .js/.css llevan hash en el
      // nombre, así que no pierden nada; solo se vuelve a consultar al servidor.
      args: ["/c", "http-server dist -p 5174 -a 0.0.0.0 -c-1"],
      cwd: "../frontend-adlone",

      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,

      error_file: "./logs/adl-one-frontend-error.log",
      out_file: "./logs/adl-one-frontend-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
    },
    {
      // Vigilante: manda un correo si la pantalla web (5174) o el servidor (8002) dejan de responder. Es un proceso APARTE a propósito: si
      // viviera dentro del backend, no podría avisar cuando el backend se cae. Ignora los procesos que pm2 muestra «stopped» (paradas manuales
      // y despliegues). Se levanta una sola vez con:  pm2 start ecosystem.config.cjs --only adl-one-vigilante  y luego  pm2 save
      // (scripts/deploy-produccion.ps1 reinicia backend y frontend por nombre y no lo toca). Ver src/vigilante/vigilante.js.
      name: "adl-one-vigilante",
      script: "src/vigilante/vigilante.js",

      instances: 1,
      exec_mode: "fork",

      autorestart: true,
      watch: false,
      max_restarts: 50,
      restart_delay: 5000,
      max_memory_restart: "300M",

      error_file: "./logs/adl-one-vigilante-error.log",
      out_file: "./logs/adl-one-vigilante-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
    },
  ],
};
