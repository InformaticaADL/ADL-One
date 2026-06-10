# Rediseño del sistema de notificaciones por email

## Contexto

ADL ONE envía decenas de notificaciones por correo (`mae_evento_notificacion`, 79
eventos hoy, creciendo). El sistema actual tiene tres problemas:

1. **Duplicación masiva**: 18 plantillas son documentos HTML completos (~6-9 KB
   cada uno) que repiten header, footer y estilos. Cualquier cambio de marca
   obliga a editar decenas de archivos.
2. **Inconsistencia visual**: el "tema" (color) cambia el email completo según
   el resultado (ej. todo en rojo si es un rechazo), generando layouts muy
   distintos entre eventos.
3. **4 plantillas rotas**: `GCHAT_*` tienen `cuerpo_template_html = NULL`.

El objetivo es un sistema donde:

- Todos los emails comparten un **layout base minimalista** (estilo
  Notion/Shadcn), con logo y footer ADL.
- El **color/estado** se comunica con un **badge** puntual (ej. "RECHAZADO"
  en rojo), no recoloreando todo el email.
- Crear un email nuevo sea **rápido y mecánico**: copiar un objeto de
  configuración pequeño, no escribir HTML.
- Escale a "cientos de tipos de evento" sin que el costo de mantenimiento
  crezca linealmente.

## Diseño visual aprobado

Layout tipo Notion/Shadcn (ver mockups de la sesión de brainstorming):

- Header simple: logo ADL ONE.
- Título del evento + **badge de outcome** al lado (ej. `RECHAZADO`,
  `APROBADO`, `NUEVA`).
- Frase de resumen breve (opcional).
- **Lista de detalles** tipo Notion: filas `icono + label + valor`, fondo
  neutro, sin tablas pesadas. Las filas con valor vacío se omiten.
- Bloque de **observación/motivo** destacado sutilmente (fondo gris claro,
  borde izquierdo de color).
- **CTA** opcional (botón) — link a la app.
- Footer minimalista con datos de ADL Diagnostic Chile SpA.

El layout **no cambia de color** según el outcome — solo el badge y,
opcionalmente, el borde izquierdo del bloque de observación.

## Catálogo de Outcomes (badges)

Catálogo cerrado de 8 estados, cada uno con `{label, color, background}`.
Es independiente de la categoría — el mismo badge "RECHAZADA" se usa en
Fichas, Solicitudes de Equipo, URS, etc.

| Outcome | Label | Uso |
|---|---|---|
| `NUEVA` | NUEVA (azul) | Solicitudes/avisos recién creados |
| `APROBADA` | APROBADA (verde) | Aceptaciones / aprobaciones |
| `RECHAZADA` | RECHAZADA (rojo) | Rechazos |
| `EN_REVISION` | EN REVISIÓN (ámbar) | Pendiente de revisión |
| `DERIVADA` | DERIVADA (morado) | Reasignada a otro responsable |
| `CANCELADA` | CANCELADA (gris) | Anulaciones / cancelaciones |
| `REPROGRAMADA` | REPROGRAMADA (celeste) | Reasignación de fechas/recursos |
| `INFORMATIVA` | (sin badge fuerte) | Comentarios, mensajes, avisos generales |

Agregar un outcome nuevo en el futuro = una entrada más en el catálogo, sin
tocar el layout.

## Categorías y bloques especiales

Cada evento pertenece a una categoría. La categoría determina qué **bloque
especial** (además de la lista genérica de detalles) puede renderizarse.

| Categoría | Eventos actuales (ejemplos) | Bloque especial |
|---|---|---|
| `FICHA` | `FICHA_CREADA`, `FICHA_ASIGNADA`, `FICHA_MUESTREO_*`, `FICHA_*APROBADA/RECHAZADA*` | Tabla de servicios/fechas de muestreo (con detección de cambios old→new) |
| `SOLICITUD_EQUIPO` | `SOL_EQUIPO_*` (ALTA, BAJA, TRASPASO, REACTIVACIÓN, etc.) | Detalle de equipo / traspaso origen→destino |
| `SOLICITUD_SERVICIO` (URS) | `SOLICITUD_*`, `SOL_TRASPASO_*`, `SOL_DESHABILITAR_*`, `SOL_EXTENSION_*` | Lista dinámica de campos del formulario (varía según `tipo_solicitud`) |
| `AVISO_MOVIL` | `AVISO_*` | Equipo/Ficha relacionada + datos reportados desde la app móvil |
| `ENVIO_CLIENTE` | `ENV_FOMA_MAM`, `ENV_CADENA_MAM` | Datos del centro/cliente + referencia al adjunto |
| `SEGURIDAD` | `PASSWORD_RESET_*` | Sin badge ni bloque Acción/Responsable/Fecha — solo mensaje + CTA |
| `CHAT` | `GCHAT_*` | Vista previa del mensaje/grupo + CTA "Abrir chat" |

La mayoría de eventos (los `_NUEVA`/`_APR`/`_RECH` que comparten estructura,
ej. la mayoría de `SOL_EQUIPO_*`) **no necesitan bloque especial** — solo
badge + lista genérica de detalles.

## Estructura de archivos (backend)

```
api-backend-adlone/src/notifications/
  layout/
    base-layout.js        // Header, badge, lista de detalles, observación, CTA, footer
  outcomes.js              // Catálogo de 8 badges (color, label)
  blocks/                  // Bloques especiales por categoría
    ficha-servicios.js
    solicitud-equipo-traspaso.js
    urs-detalle-dinamico.js
    aviso-movil.js
    envio-cliente.js
  config/                  // Config declarativa, 1 archivo por categoría
    ficha.config.js
    solicitud-equipo.config.js
    urs.config.js
    aviso.config.js
    envio.config.js
    seguridad.config.js
    chat.config.js
  renderer.js              // renderEmail(codigoEvento, context) -> { asunto, html }
```

## Forma del objeto de configuración (por evento)

```js
{
  codigo: 'FICHA_CREADA',
  categoria: 'FICHA',
  outcome: 'NUEVA',
  asunto: 'Nueva Ficha Ingresada: {CORRELATIVO}',
  titulo: 'Ficha Comercial Creada',
  campos: [
    { icono: '📄', label: 'Tipo de Monitoreo', variable: 'TIPO_FICHA_INFO' },
    { icono: '🏭', label: 'Base de Operaciones', variable: 'BASE_OPERACIONES' },
    { icono: '🏢', label: 'Empresa a Facturar', variable: 'EMPRESA_FACTURAR' },
    { icono: '🧪', label: 'Empresa Servicio', variable: 'EMPRESA_SERVICIO' },
    { icono: '📍', label: 'Fuente Emisora', variable: 'FUENTE_EMISORA' },
    { icono: '🎯', label: 'Objetivo del Muestreo', variable: 'OBJETIVO_MUESTREO' },
    // Filas con variable vacía/undefined se omiten automáticamente
  ],
  observacion: { etiqueta: 'Observaciones', variable: 'OBSERVACION' },
  bloqueEspecial: undefined,   // ej. 'fichaServicios' para FICHA_ASIGNADA
  cta: undefined                // opcional: { label: 'Ver Ficha', ruta: '...' }
}
```

Reglas:

- `campos[].variable` se resuelve contra el `context` que ya arma
  `uns.service.js` / `getFichaContextForNotification` (mismo mecanismo de
  reemplazo de placeholders que existe hoy, incluyendo formateo de fechas).
- Si el valor resuelto es vacío/`null`/`undefined`/`'No aplica'`, la fila se
  omite (igual que el comportamiento actual de limpieza de filas vacías).
- `bloqueEspecial` es un string que mapea a una función en `blocks/` —
  recibe `context` y devuelve HTML adicional, insertado después de la lista
  de campos y antes de la observación.
- `cta.ruta` soporta placeholders `{VARIABLE}` igual que `asunto`/`titulo`.

## Renderer

`renderer.js` expone `renderEmail(codigoEvento, context) -> { asunto, html }`:

1. Busca la config del evento por `codigo` en los archivos de `config/`.
2. Resuelve `outcome` → badge (label, color, bg) desde `outcomes.js`.
3. Resuelve `titulo`/`asunto`/`cta.ruta` reemplazando placeholders.
4. Construye filas de `campos` (omitiendo vacíos).
5. Si hay `bloqueEspecial`, invoca el bloque correspondiente y agrega su HTML.
6. Construye el bloque de `observacion` si hay valor.
7. Pasa todo a `base-layout.js`, que arma el documento HTML final (logo,
   título+badge, lista, bloque especial, observación, CTA, footer).

`notification.service.js` mantiene su firma pública
(`send(eventCode, context, directEmails, options)`), pero internamente
reemplaza la lectura de `mae_evento_notificacion.cuerpo_template_html` +
`_compileTemplate` por una llamada a `renderer.js`. La resolución de
destinatarios (`rel_evento_destinatario`, roles, permisos) **no cambia**.

`mae_evento_notificacion.asunto_template` y `cuerpo_template_html` dejan de
usarse (se documentan como deprecados; no se eliminan de la BD en esta fase
para no romper nada en producción).

## Plan de migración (por fases)

1. **Piloto — categoría `FICHA`** (7 eventos: `FICHA_CREADA`,
   `FICHA_REMUESTREO_CREADA`, `FICHA_APROBADA_TECNICA`,
   `FICHA_RECHAZADA_TECNICA`, `FICHA_APROBADA_COORDINACION`,
   `FICHA_RECHAZADA_COORDINACION`, `FICHA_ASIGNADA`, más los de
   reasignación/reagendado/cancelación de muestreo). Construir
   `base-layout.js`, `outcomes.js`, `renderer.js`, y el bloque
   `fichaServicios`. Validar visualmente con envíos de prueba antes de
   continuar.
2. **`SOLICITUD_EQUIPO`** (~28 eventos `SOL_EQUIPO_*`) — casi todos
   comparten estructura, migración rápida una vez el motor existe.
3. **`SOLICITUD_SERVICIO` (URS)** — los más "legacy" (8 KB c/u), con
   bloques dinámicos según `tipo_solicitud` (traspasos, deshabilitación,
   extensión de vigencia, derivación).
4. **`AVISO_MOVIL`, `ENVIO_CLIENTE`, `SEGURIDAD`**.
5. **`CHAT`** — crear plantillas/config nuevas (hoy `cuerpo_template_html`
   es `NULL`, no existen).

## Fuera de alcance (futuro)

- **Deep-linking real desde el CTA**: hoy `useNavStore` soporta
  `pendingRequestId`/`pendingChatId` para notificaciones in-app, pero no
  existe un mecanismo de deep-link vía query params desde un email externo
  hacia el SPA. En esta fase, `cta.ruta` apunta a la URL base de la app
  (`APP_URL`); el deep-linking real queda como mejora futura.
- Eliminar columnas `asunto_template`/`cuerpo_template_html` de
  `mae_evento_notificacion` (se deprecan, no se borran).
- UI de administración para editar configuración sin deploy.
