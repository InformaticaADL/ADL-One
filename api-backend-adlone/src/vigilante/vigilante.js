// Vigilante de ADL ONE: proceso APARTE (no vive dentro del backend, porque si el backend se cae no podría avisar).
// Cada minuto pide la pantalla web (5174) y el servidor (8002) y, si uno deja de responder varias veces seguidas, manda un correo.
//
//  · No avisa por paradas a propósito: un proceso que pm2 muestra como «stopped» (parada manual o despliegue con scripts/deploy-produccion.ps1) se ignora.
//  · Sí avisa cuando pm2 lo muestra «online» pero no contesta (lo que pasó el 2026-11-19), o cuando el proceso ya no existe en pm2.
//  · Pausa manual (mantención con el proceso «online»):  node src/vigilante/pausar.js 30 "motivo"   ·  quitarla:  node src/vigilante/pausar.js 0
//  · Puesta en marcha en el servidor (una sola vez):  pm2 start ecosystem.config.cjs --only adl-one-vigilante   y después  pm2 save
//  · Configuración por variables de entorno (.env), ver .env.example. VIGILANTE_DESTINATARIOS es obligatoria para que mande correos.
//  · VIGILANTE_SIMULAR=1 no envía nada: solo escribe en el log lo que enviaría (para probar).
import dotenv from 'dotenv';
import fs from 'node:fs';
import { getTransporter } from '../config/mailer.js';
import { evaluar, estadoInicial } from './estado.js';
import { armarCorreo } from './correos.js';
import { probarHttp, estadosPm2, estaDetenidoAPropósito, pausaVigente, ARCHIVO_ESTADO, CARPETA_LOGS } from './chequeos.js';

dotenv.config();

const numero = (v, porDefecto) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : porDefecto; };

export const CONFIG = {
    intervaloMs: numero(process.env.VIGILANTE_INTERVALO_S, 60) * 1000,
    umbral: numero(process.env.VIGILANTE_UMBRAL, 3),
    recordatorioMs: numero(process.env.VIGILANTE_RECORDATORIO_MIN, 120) * 60 * 1000,
    timeoutMs: numero(process.env.VIGILANTE_TIMEOUT_S, 10) * 1000,
    destinatarios: (process.env.VIGILANTE_DESTINATARIOS || '').split(',').map((s) => s.trim()).filter(Boolean),
    simular: process.env.VIGILANTE_SIMULAR === '1',
    servidor: process.env.VIGILANTE_SERVIDOR || '192.168.10.28',
    servicios: [
        { id: 'frontend', proceso: 'adl-one-frontend', url: process.env.VIGILANTE_URL_FRONTEND || 'http://127.0.0.1:5174/', debeContener: 'id="root"' },
        { id: 'backend', proceso: 'adl-one-backend', url: process.env.VIGILANTE_URL_BACKEND || 'http://127.0.0.1:8002/', debeContener: null },
    ],
};

const registro = (...partes) => console.log(new Date().toISOString().replace('T', ' ').slice(0, 19), '[vigilante]', ...partes);

// El estado se guarda en disco para que, si el propio vigilante se reinicia en plena caída, no vuelva a avisar como si fuera nueva.
const MAX_EDAD_ESTADO_MS = 6 * 60 * 60 * 1000;
function cargarEstado() {
    try {
        const j = JSON.parse(fs.readFileSync(ARCHIVO_ESTADO, 'utf8'));
        if (Date.now() - (j.guardado || 0) > MAX_EDAD_ESTADO_MS) return {};
        return j.servicios || {};
    } catch { return {}; }
}
function guardarEstado(estados) {
    try { fs.mkdirSync(CARPETA_LOGS, { recursive: true }); fs.writeFileSync(ARCHIVO_ESTADO, JSON.stringify({ guardado: Date.now(), servicios: estados })); } catch (e) { registro('no se pudo guardar el estado:', e.message); }
}

async function enviar(accion, servicio) {
    const { subject, text, html } = armarCorreo(accion, servicio.id, { servidor: CONFIG.servidor });
    if (CONFIG.simular || !CONFIG.destinatarios.length) {
        registro(CONFIG.simular ? '(SIMULADO)' : '(SIN DESTINATARIOS: define VIGILANTE_DESTINATARIOS)', 'correo:', subject);
        console.log(text);
        return CONFIG.simular; // simulado cuenta como enviado; sin destinatarios no (se reintenta como recordatorio)
    }
    try {
        await getTransporter().sendMail({ from: process.env.EMAIL_FROM || process.env.SMTP_USER, to: CONFIG.destinatarios.join(','), subject, text, html });
        registro('correo enviado a', CONFIG.destinatarios.join(', '), '·', subject);
        return true;
    } catch (e) {
        registro('NO se pudo enviar el correo:', e.message);
        return false;
    }
}

let estados = cargarEstado();

export async function ciclo() {
    const ahora = Date.now();
    const pausa = pausaVigente(undefined, ahora);
    const pm2 = pausa ? null : await estadosPm2();
    for (const s of CONFIG.servicios) {
        let r;
        if (pausa) {
            r = { ok: false, detenido: true };
        } else if (estaDetenidoAPropósito(pm2 && pm2[s.proceso])) {
            r = { ok: false, detenido: true };
        } else {
            const http = await probarHttp(s.url, { timeoutMs: CONFIG.timeoutMs, debeContener: s.debeContener });
            const estadoPm2 = pm2 ? (pm2[s.proceso] || 'no aparece en pm2') : null;
            r = http.ok ? { ok: true } : { ok: false, motivo: `${http.motivo}${estadoPm2 ? ` (pm2: ${estadoPm2})` : ''}` };
        }
        const previo = estados[s.id] || estadoInicial();
        const { estado, accion } = evaluar(previo, r, ahora, CONFIG);
        estados[s.id] = estado;
        if (!r.ok && !r.detenido) registro(`${s.id}: falla ${estado.fallos}/${CONFIG.umbral} · ${r.motivo}`);
        if (accion) {
            registro(`${s.id}: ${accion.tipo}`);
            const enviado = await enviar(accion, s);
            // Si el correo no salió, se deja el aviso «vencido» para reintentarlo en la próxima comprobación (como recordatorio).
            if (!enviado && accion.tipo !== 'RECUPERADO') estados[s.id] = { ...estados[s.id], ultimoAviso: ahora - CONFIG.recordatorioMs };
        }
    }
    guardarEstado(estados);
}

// Arranca siempre: bajo pm2 process.argv[1] NO es este archivo, así que no se puede detectar «ejecutado directamente». Solo las pruebas lo evitan.
if (process.env.VIGILANTE_NO_ARRANCAR !== '1') {
    registro(`iniciado · cada ${CONFIG.intervaloMs / 1000} s · umbral ${CONFIG.umbral} fallos seguidos · recordatorio cada ${CONFIG.recordatorioMs / 60000} min`);
    registro(CONFIG.servicios.map((s) => `${s.id} → ${s.url} (pm2: ${s.proceso})`).join(' | '));
    registro(CONFIG.simular ? 'MODO SIMULACIÓN: no se enviará ningún correo.' : CONFIG.destinatarios.length ? `avisos a: ${CONFIG.destinatarios.join(', ')}` : 'ATENCIÓN: VIGILANTE_DESTINATARIOS está vacía; solo se escribirá en el log.');
    let detenido = false;
    const vuelta = async () => {
        if (detenido) return;
        try { await ciclo(); } catch (e) { registro('error en la comprobación:', e && e.message); }
        if (!detenido) setTimeout(vuelta, CONFIG.intervaloMs);
    };
    const salir = () => { detenido = true; registro('detenido'); process.exit(0); };
    process.on('SIGINT', salir); process.on('SIGTERM', salir);
    vuelta();
}
