# Navbar global y sistema de tablas — Ant Design

**Fecha:** 2026-09-14
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

El frontend (`frontend-adlone/`) terminó de migrarse de Mantine a Ant Design (commit `bd1906a`). El tema base (`src/main.tsx`) ya implementa un look minimalista tipo "Slate" (radios 8px, bordes suaves zinc-200, header con blur, azul de marca `#0062a8` como único acento de color en botones/nav activo). Sobre esa base, el usuario pidió dos mejoras puntuales tras ver una referencia visual (dashboard "Zenith"):

1. Un navbar global persistente que hoy no existe en desktop (solo hay sidebar + contenido).
2. Un rediseño del sistema de color/densidad de las tablas de datos, que hoy usan demasiados colores decorativos y se sienten "amontonadas".

Estas son dos piezas independientes — se implementan y verifican por separado, pero comparten el mismo pase de "barrer todos los archivos" que ya se usó para la migración Mantine→AntD.

## Parte A — Navbar global

### Componente nuevo: `src/components/layout/TopBar.tsx`

Barra fija en la parte superior de `MainLayout.tsx`, por encima de la fila sidebar+contenido, visible siempre en desktop. Contenido de izquierda a derecha:

- Logo ADL + nombre de la app (usa el mismo asset `logo-adlone.png` que ya se usa en el header móvil).
- Input de búsqueda global con hint visual "⌘K" — **solo visual en esta iteración**: el input existe, tiene el placeholder y el hint de atajo, pero no ejecuta ninguna búsqueda real. No se agrega listener de teclado ni lógica de resultados.
- Campana de notificaciones — reutiliza la lógica ya existente hoy en `Sidebar.tsx` (badge de contador no leído desde `useNotificationStore`, abre el `NotificationPopover` ya existente en `src/features/notifications/components/NotificationPopover.tsx`).
- Toggle de tema claro/oscuro — reutiliza `useThemeStore` (ya existe, compartido con Mantine/AntD), mismo switch sol/luna que hoy vive en `Sidebar.tsx`.
- Avatar + menú de usuario — reutiliza el dropdown de perfil/cerrar sesión que hoy vive en `Sidebar.tsx` (mismas opciones: ir a perfil, cerrar sesión).

`PageHeader.tsx` (breadcrumb + título + acciones por página) **no cambia** — sigue renderizándose debajo del `TopBar`, dentro del área de contenido de cada página.

### Sidebar.tsx se simplifica

Se elimina el bloque inferior que hoy contiene notificaciones/tema/avatar (líneas ~315-461 aprox., a confirmar en el plan). `Sidebar.tsx` queda únicamente con navegación (lista de módulos + collapse toggle). Los imports/estado que quedan sin uso (`useNotificationStore`, `useThemeStore`, `NotificationPopover`, `Avatar`, `Dropdown` relacionados a ese bloque) se retiran del archivo si ya no se usan en otra parte del componente.

### Mobile

El header compacto que ya existe en `MainLayout.tsx` (menú hamburguesa + logo, visible cuando `isCompact`) se extiende: el espaciador `<div style={{width:30}}/>` de la derecha se reemplaza por el mismo cluster de iconos (notificaciones/tema/avatar) en tamaño reducido, en vez de crear una segunda barra separada. No se agrega el input de búsqueda en mobile (no entra razonablemente en 60px de alto junto al resto).

### Fuera de alcance (explícito)

- Búsqueda funcional real (cualquier lógica de indexado/resultados) — queda para un proyecto aparte si se decide más adelante.
- Botón de acción global tipo "+ New Order" — cada página sigue mostrando su propio botón principal vía `PageHeader`, el navbar global no lleva uno.

## Parte B — Sistema de tablas

### Regla de color en Tags

- **Color reservado solo para estado** (activo/inactivo/pendiente/vencido/rechazado/aprobado/etc.). El componente ya existente `src/components/ui/StatusBadge.tsx` cubre el mapeo de estados de flujo de solicitudes/procesos y se mantiene como está — es el único lugar del sistema donde un `Tag` usa color con significado semántico de estado.
- **Todo lo demás pasa a neutro**: roles, tipos de equipo, categorías, sedes, nombres de tabla en `MaestrosHub`, etc. — hoy usan `Tag color="blue"`, `color="purple"`, `color="teal"`, etc. de forma decorativa/categórica. Pasan a `Tag` sin prop `color` (gris/negro por defecto de AntD) o `Tag` con variante `outline` según corresponda visualmente.
- Excepción explícita: badges de "activo/inactivo/habilitado/deshabilitado" que hoy no pasan por `StatusBadge` (ej. `habilitado === 'S'` → verde/rojo directo) se consideran estado y **mantienen** color verde/rojo — no es una categoría decorativa, es un estado real.

### Componente nuevo: `NameCell`

`src/components/ui/NameCell.tsx` — compone Avatar (iniciales, fondo gris neutro — no azul) + nombre en negrita + subtítulo secundario opcional (email, código, RUT, etc.) en una fila, para reemplazar los distintos patrones ad-hoc de "avatar + nombre" ya usados de forma inconsistente en varias tablas (algunas con avatar azul, otras sin avatar). Firma propuesta:

```tsx
<NameCell
  avatarText={initials}      // ej. "JD"
  title={nombreCompleto}
  subtitle={email}           // opcional
/>
```

### Densidad de tabla

El `Table` de AntD ya está configurado en `main.tsx` con padding de celda 14/16px y sin fondo gris de header — no requiere cambios adicionales de spacing. El ajuste de esta parte es principalmente de **color**, no de densidad.

### Alcance

Aplica a **todas** las tablas del sistema que hoy usan `Tag` con color decorativo o un patrón de avatar+nombre ad-hoc — mismo enfoque de barrido sistemático archivo por archivo que se usó en la migración Mantine→AntD, delegando a un agente en segundo plano dado el volumen de archivos.

## Verificación

Igual que en la migración anterior: por cada archivo tocado, `npx tsc -b --force`, `npx eslint <archivo>`, `npx vite build` desde `frontend-adlone/`. Al final, revisión visual manual del usuario en la app corriendo (no hay forma de tomar capturas automatizadas del navegador en este entorno).

## Fuera de alcance general

- No se toca `main.tsx`'s `MantineProvider`/`ModalsProvider` (sigue siendo infraestructura necesaria mientras el CSS legado dependa de `--mantine-color-*`, ver migración anterior).
- No se cambia el color primario de marca (`#0062a8` se mantiene).
- No se rediseña la navegación del Sidebar en sí (accordion de módulos, etc.), solo se le quita el bloque inferior.
