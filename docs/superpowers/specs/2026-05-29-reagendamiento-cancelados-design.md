# Especificación: Re-agendamiento de Servicios Cancelados

**Fecha:** 2026-05-29  
**Autor:** Claude Code  
**Componente:** `EnProcesoCalendarView.tsx`  
**Módulo:** Medio Ambiente - Calendario de Servicios  

---

## Resumen Ejecutivo

Actualmente, cuando un servicio (ficha) es cancelado en el calendario "En Proceso", no puede ser re-agendado. Los campos de edición (fecha y muestreador) se bloquean y se vuelven estáticos.

Esta especificación permite reactivar y re-agendar servicios cancelados, manteniendo un historial del motivo de cancelación anterior para propósitos de auditoría.

---

## Requisitos

### Requisitos Funcionales

**RF-1: Edición de servicios cancelados**
- Los campos "Fecha de Muestreo" y "Muestreador Asignado" deben ser editables para servicios en estado CANCELADO
- Estos campos solo se habilitan si el usuario tiene permiso `MA_CALENDARIO_REAGENDAR`
- Los campos de servicios EJECUTADOS siguen siendo estáticos (sin cambios)

**RF-2: Modal de confirmación de reactivación**
- Cuando un usuario intenta guardar cambios en un servicio CANCELADO, se abre un modal de confirmación
- Este modal muestra:
  - Título: "Reactivar y Reagendar Muestreo"
  - El motivo de cancelación anterior
  - Las observaciones adicionales (si existen)
  - Un resumen de los nuevos datos (fecha y muestreador)
- El usuario puede confirmar o cancelar la acción

**RF-3: Reactivación y cambio de estado**
- Al confirmar, el servicio cambia de estado CANCELADO a PENDIENTE
- El motivo de cancelación anterior se mantiene en historial (no se borra)
- La fecha y muestreador se actualizan con los nuevos valores

**RF-4: Modal de versiones de equipos (existente)**
- Si el usuario intenta reactivar un cancelado y cambiar la fecha, se muestra el modal de "Versión de Equipos" después de la reactivación
- Esto permite elegir entre mantener la versión original de equipos o actualizar a la versión actual

### Requisitos No Funcionales

**RNF-1: Sin validaciones de tiempo**
- No hay restricción temporal: un servicio puede ser reactivado en cualquier momento, sin importar cuándo fue cancelado

**RNF-2: Permisos únicos**
- Se usa el permiso existente `MA_CALENDARIO_REAGENDAR`
- No se crean nuevos permisos para esta funcionalidad
- El mismo permiso controla: reagendar pendientes Y reactivar cancelados

---

## Diseño de Flujo

### Flujo de Usuario

```
┌─────────────────────────────────────────────────────────────┐
│ Usuario abre detalle de servicio CANCELADO                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ¿Tiene permiso MA_CALENDARIO_REAGENDAR?
                       │
            ┌──────────┴──────────┐
            │                     │
           SÍ                     NO
            │                     │
    Campos editables      Campos estáticos
            │
      Usuario edita
    (fecha y/o muestreador)
            │
    Clic en "Guardar Cambios"
            │
    ┌───────┴─────────────────────────────────────┐
    │                                             │
¿Hay cambios?                               (No hay cambios)
    │                                             │
   SÍ                                           Nada
    │
ABRE MODAL DE REACTIVACIÓN
├─ Muestra motivo de cancelación
├─ Muestra observaciones
├─ Muestra resumen de nuevos datos
│
    ┌──────────────────────────┐
    │                          │
Usuario confirma      Usuario cancela
    │                          │
   SÍ                      Modal cierra
    │
API: batchUpdateAgenda
+ flag: reactivating: true
+ nuevos datos (fecha, muestreador)
    │
¿Cambió la fecha?
    │
    ├─ SÍ → ABRE MODAL DE VERSIONES DE EQUIPOS
    │       (existente, flujo actual)
    │
    └─ NO → Se guarda directamente
            Servicio ahora está PENDIENTE
            Motivo cancelación se mantiene en historial
```

---

## Cambios en el Componente

### 1. Modificación de condiciones de visibilidad (líneas 893, 907)

**Antes:**
```typescript
{hasPermission('MA_CALENDARIO_REAGENDAR') && !isExecutedEvent(selectedEvent!) && !isCancelledEvent(selectedEvent!) ? (
```

**Después:**
```typescript
{hasPermission('MA_CALENDARIO_REAGENDAR') && !isExecutedEvent(selectedEvent!) ? (
```

**Efecto:** Los campos de edición ahora se muestran para servicios PENDIENTES y CANCELADOS (no para EJECUTADOS).

### 2. Nuevo estado para el modal de reactivación

Agregar a los estados del componente:
```typescript
const [showReactivateConfirm, setShowReactivateConfirm] = useState(false);
const [isReactivating, setIsReactivating] = useState(false);
```

### 3. Modificación de la lógica del botón "Guardar Cambios"

En el evento `onClick` del botón (línea 956):

**Antes:** Validar → Construir payload → Enviar o mostrar modal de versiones

**Después:** 
```typescript
// Si el evento está CANCELADO, mostrar modal de reactivación
if (isCancelledEvent(selectedEvent!) && (isEditingDate || isEditingSampler)) {
    setPendingPayload(payload);
    setShowReactivateConfirm(true);
    return;
}

// Si es PENDIENTE, flujo actual (versiones o guardar directo)
```

### 4. Nuevo Modal: "Reactivar y Reagendar Muestreo"

Ubicación: Después del modal `showVersionPrompt` (línea 1109)

**Estructura:**
```tsx
<Modal
    opened={showReactivateConfirm}
    onClose={() => setShowReactivateConfirm(false)}
    title="Reactivar y Reagendar Muestreo"
    centered
>
    <Stack gap="md">
        {selectedEvent && (
            <>
                <Paper withBorder p="sm" radius="md" bg="red.0">
                    <Group gap="xs">
                        <IconAlertCircle size={18} />
                        <Text size="sm" fw={700}>
                            Este muestreo fue cancelado anteriormente
                        </Text>
                    </Group>
                </Paper>

                <Box>
                    <Text size="xs" fw={700} c="dimmed" tt="uppercase">Motivo de cancelación</Text>
                    <Text size="sm">{selectedEvent.motivo_cancelacion || 'No especificado'}</Text>
                </Box>

                {cancelReason && (
                    <Box>
                        <Text size="xs" fw={700} c="dimmed" tt="uppercase">Observaciones</Text>
                        <Text size="sm">{cancelReason}</Text>
                    </Box>
                )}

                <Divider />

                <Box>
                    <Text size="xs" fw={700} c="dimmed" tt="uppercase">Nuevos datos</Text>
                    <Stack gap="xs" mt="xs">
                        <Group justify="space-between">
                            <Text size="sm">Fecha:</Text>
                            <Text size="sm" fw={700}>{editedDate}</Text>
                        </Group>
                        <Group justify="space-between">
                            <Text size="sm">Muestreador:</Text>
                            <Text size="sm" fw={700}>
                                {globalMuestreadores.find(m => m.id_muestreador === Number(editedSamplerId))?.nombre_muestreador || 'Sin Asignar'}
                            </Text>
                        </Group>
                    </Stack>
                </Box>

                <Text size="sm" c="dimmed">
                    ¿Desea reactivar este muestreo y aplicar los cambios?
                </Text>

                <Group justify="flex-end" mt="md">
                    <Button variant="outline" onClick={() => setShowReactivateConfirm(false)}>
                        No, Volver
                    </Button>
                    <Button
                        color="blue"
                        loading={isReactivating}
                        onClick={async () => {
                            setIsReactivating(true);
                            try {
                                // Agregar flag reactivating al payload
                                const reactivatePayload = {
                                    ...pendingPayload,
                                    reactivating: true
                                };
                                
                                await fichaService.batchUpdateAgenda(reactivatePayload);
                                showToast({ type: 'success', message: 'Muestreo reactivado y reprogramado.' });
                                lastFetchRef.current = '';
                                setSelectedEvent(null);
                                setShowReactivateConfirm(false);
                                loadData();
                            } catch (error) {
                                console.error('Error reactivating:', error);
                                showToast({ type: 'error', message: 'Error al reactivar el muestreo.' });
                            } finally {
                                setIsReactivating(false);
                            }
                        }}
                    >
                        Sí, Reactivar
                    </Button>
                </Group>
            </>
        )}
    </Stack>
</Modal>
```

---

## Cambios en el Backend

### API Endpoint: `batchUpdateAgenda`

**Cambio:** Agregar soporte para el flag `reactivating` en el payload

**Payload actual:**
```json
{
    "assignments": [{
        "id": number,
        "fecha": string,
        "fechaRetiro": string,
        "idMuestreadorInstalacion": number,
        "idMuestreadorRetiro": number,
        "idFichaIngresoServicio": number,
        "frecuenciaCorrelativo": string
    }],
    "user": { "id": number, "usuario": string }
}
```

**Payload nuevo (con soporte de reactivación):**
```json
{
    "assignments": [{
        "id": number,
        "fecha": string,
        "fechaRetiro": string,
        "idMuestreadorInstalacion": number,
        "idMuestreadorRetiro": number,
        "idFichaIngresoServicio": number,
        "frecuenciaCorrelativo": string,
        "reactivating": boolean  // ← NUEVO
    }],
    "user": { "id": number, "usuario": string }
}
```

**Lógica del backend:**
- Si `reactivating: true`:
  - Verificar que el estado actual es CANCELADO
  - Cambiar estado a PENDIENTE
  - Actualizar fecha/muestreador como siempre
  - Mantener `motivo_cancelacion` y `fecha_cancelacion` en historial (no borrar)
- Si `reactivating: false` o no existe:
  - Comportamiento actual (solo actualizar fecha/muestreador)

---

## Flujo de Guardado Detallado

```
┌─────────────────────────────────────────────┐
│ Usuario hace clic "Guardar Cambios"          │
└──────────────┬──────────────────────────────┘
               │
      Validaciones básicas:
      - Fecha válida
      - Muestreador válido
               │
    ┌──────────┴────────────────────┐
    │                               │
isCancelledEvent()?                 NO
    │                               │
   SÍ                            Pendiente
    │                               │
Construir payload              Construir payload
+ reactivating: true           sin reactivating
    │                               │
ABRE MODAL                    ¿Cambió fecha?
DE REACTIVACIÓN                    │
    │                      ┌────────┴────────┐
    │                      │                 │
    │                     SÍ               NO
    │                      │                 │
    │              Modal versiones      Guardar
    │              equipos              directo
    │
Usuario confirma
    │
Envía payload
+ reactivating: true
    │
Backend actualiza
+ cambia estado
```

---

## Validaciones y Restricciones

| Condición | Campos | Comportamiento |
|-----------|--------|----------------|
| PENDIENTE + permisos | Editables | Flujo actual (versiones o guardar) |
| CANCELADO + permisos | Editables | Modal reactivación → API con `reactivating: true` |
| CANCELADO sin permisos | Estáticos | No editar |
| EJECUTADO + permisos | Estáticos | No editar (nunca) |
| Cambio de fecha | - | Modal versiones equipos (después de reactivar) |
| Solo cambio muestreador | - | Guardar directo sin modal versiones |

---

## Consideraciones de Auditoría

- **Motivo de cancelación anterior:** Se mantiene en la BD para historial
- **Fecha de reactivación:** Podría agregarse opcionalmente (TBD si el backend captura esto)
- **Usuario que reactivó:** Se envía en el objeto `user` del payload (igual que ahora)

---

## Testing

### Casos de prueba

1. **Editar cancelado sin permiso:** Campos estáticos, no se puede editar
2. **Editar cancelado con permiso:** Campos editables, abre modal de reactivación
3. **Cancelar modal de reactivación:** Se cierra, no se guarda nada
4. **Confirmar reactivación (solo muestreador):** Se guarda directo sin modal versiones
5. **Confirmar reactivación (fecha + muestreador):** Se abre modal de versiones después
6. **Confirmar versiones en modal:** Se completa la reactivación correctamente

---

## Scope y Limitaciones

- ✅ Reactivación sin restricción de tiempo
- ✅ Historial de cancelación mantenido
- ✅ Permisos existentes reutilizados
- ❌ No se crea un nuevo permiso específico de "reactivación"
- ❌ No se registra explícitamente la fecha/usuario de reactivación (se asume que backend lo captura)

---

## Dependencias

- `fichaService.batchUpdateAgenda()` — Debe soportar flag `reactivating`
- Backend SP — Debe manejar cambio de estado CANCELADO → PENDIENTE

---

## Próximos Pasos

1. ✅ Especificación aprobada
2. → Escribir plan de implementación (writing-plans)
3. → Implementar cambios en frontend
4. → Validar cambios en backend / API
5. → Testing funcional
6. → PR y revisión de código
