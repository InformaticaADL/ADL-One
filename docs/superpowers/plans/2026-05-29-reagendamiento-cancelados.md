# Re-agendamiento de Servicios Cancelados - Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que servicios (fichas) cancelados sean re-agendados sin necesidad de crear nuevos registros, manteniendo el historial de cancelación.

**Architecture:** Modificar el componente `EnProcesoCalendarView.tsx` para permitir edición de cancelados y agregar un modal de confirmación de reactivación. El backend extenderá `batchUpdateAgenda()` para soportar un flag `reactivating: true` que cambie el estado de CANCELADO a PENDIENTE.

**Tech Stack:**
- Frontend: React 19, TypeScript, Mantine 8, Tabler Icons
- Backend: Node.js/Express, SQL Server
- Service: `fichaService.batchUpdateAgenda()`

---

## Cambios por Archivo

| Archivo | Cambios |
|---------|---------|
| `frontend-adlone/src/features/medio-ambiente/components/EnProcesoCalendarView.tsx` | Agregar estados, modificar condiciones, agregar modal |
| `api-backend-adlone/src/controllers/bulk-ficha.controller.js` | Agregar soporte para `reactivating` flag |
| `api-backend-adlone/src/services/bulk-ficha.service.js` | Implementar lógica de reactivación |

---

## Task 1: Agregar Estados para Modal de Reactivación

**Files:**
- Modify: `frontend-adlone/src/features/medio-ambiente/components/EnProcesoCalendarView.tsx:108-116`

- [ ] **Step 1: Agregar dos nuevos estados después de `isSavingEvent`**

Ubicar las líneas 108-116 donde están los estados:
```typescript
const [isEditingDate, setIsEditingDate] = useState(false);
const [isEditingSampler, setIsEditingSampler] = useState(false);
const [editedDate, setEditedDate] = useState('');
const [editedSamplerId, setEditedSamplerId] = useState<number | ''>('');
const [cancellationReasons, setCancellationReasons] = useState<any[]>([]);
const [selectedReasonId, setSelectedReasonId] = useState<number | ''>('');
const [isSavingEvent, setIsSavingEvent] = useState(false);
const [showVersionPrompt, setShowVersionPrompt] = useState(false);
const [pendingPayload, setPendingPayload] = useState<any>(null);
```

Después de `const [pendingPayload, setPendingPayload] = useState<any>(null);` (línea 116), agregar:

```typescript
const [showReactivateConfirm, setShowReactivateConfirm] = useState(false);
const [isReactivating, setIsReactivating] = useState(false);
```

- [ ] **Step 2: Verificar que los estados se agregaron correctamente**

El archivo debe tener ahora estos dos nuevos estados después de la línea 116.

- [ ] **Step 3: Commit**

```bash
git add frontend-adlone/src/features/medio-ambiente/components/EnProcesoCalendarView.tsx
git commit -m "feat: add reactivation modal state management"
```

---

## Task 2: Modificar Condiciones de Visibilidad de Inputs

**Files:**
- Modify: `frontend-adlone/src/features/medio-ambiente/components/EnProcesoCalendarView.tsx:893-923`

- [ ] **Step 1: Localizar la condición en la línea 893**

Buscar en el código:
```typescript
{hasPermission('MA_CALENDARIO_REAGENDAR') && !isExecutedEvent(selectedEvent!) && !isCancelledEvent(selectedEvent!) ? (
```

Este es el Grid.Col que controla la visibilidad del input de fecha.

- [ ] **Step 2: Remover `!isCancelledEvent(selectedEvent!)` de la línea 893**

Cambiar de:
```typescript
{hasPermission('MA_CALENDARIO_REAGENDAR') && !isExecutedEvent(selectedEvent!) && !isCancelledEvent(selectedEvent!) ? (
    <TextInput
```

A:
```typescript
{hasPermission('MA_CALENDARIO_REAGENDAR') && !isExecutedEvent(selectedEvent!) ? (
    <TextInput
```

- [ ] **Step 3: Localizar y modificar la condición en la línea 907**

Buscar:
```typescript
{hasPermission('MA_CALENDARIO_REASIGNAR') && !isExecutedEvent(selectedEvent!) && !isCancelledEvent(selectedEvent!) ? (
```

Cambiar de:
```typescript
{hasPermission('MA_CALENDARIO_REASIGNAR') && !isExecutedEvent(selectedEvent!) && !isCancelledEvent(selectedEvent!) ? (
    <Select
```

A:
```typescript
{hasPermission('MA_CALENDARIO_REASIGNAR') && !isExecutedEvent(selectedEvent!) ? (
    <Select
```

- [ ] **Step 4: Verificar que solo EJECUTADOS quedan bloqueados**

Los servicios CANCELADOS ahora tendrán campos editables. Visualmente:
- PENDIENTE: campos editables ✓
- CANCELADO: campos editables ✓ (NUEVO)
- EJECUTADO: campos estáticos ✓

- [ ] **Step 5: Commit**

```bash
git add frontend-adlone/src/features/medio-ambiente/components/EnProcesoCalendarView.tsx
git commit -m "feat: enable editing for cancelled services"
```

---

## Task 3: Modificar Lógica del Botón "Guardar Cambios"

**Files:**
- Modify: `frontend-adlone/src/features/medio-ambiente/components/EnProcesoCalendarView.tsx:951-1040`

- [ ] **Step 1: Localizar el botón "Guardar Cambios"**

Buscar en línea ~952:
```typescript
<ProtectedContent permission={['MA_CALENDARIO_REAGENDAR', 'MA_CALENDARIO_REASIGNAR']}>
    <Button 
        leftSection={<IconDeviceFloppy size={18} />} 
        disabled={(!isEditingDate && !isEditingSampler) || isSavingEvent}
        loading={isSavingEvent}
        onClick={async () => {
```

- [ ] **Step 2: Agregar lógica de detección de cancelado al inicio del onClick**

Dentro del `onClick`, después de `if (!selectedEvent) return;`, agregar:

```typescript
// Si el evento está CANCELADO, mostrar modal de reactivación
if (isCancelledEvent(selectedEvent!) && (isEditingDate || isEditingSampler)) {
    if (!selectedEvent) return;

    if (isEditingSampler && !editedSamplerId) {
        showToast({ type: 'warning', message: 'Debe seleccionar un muestreador válido' });
        return;
    }

    if (isEditingDate && !editedDate) {
        showToast({ type: 'warning', message: 'Debe ingresar una fecha válida' });
        return;
    }

    let finalFecha = selectedEvent.fecha;
    let finalFechaRetiro = selectedEvent.fecha_retiro;

    if (selectedEvent.tipo_evento === 'INICIO' && isEditingDate) {
        finalFecha = editedDate;
        if (selectedEvent.fecha && selectedEvent.fecha_retiro) {
            try {
                const start = new Date(selectedEvent.fecha);
                const end = new Date(selectedEvent.fecha_retiro);
                const gapMs = end.getTime() - start.getTime();
                if (gapMs >= 0) {
                    const newStart = new Date(editedDate + 'T00:00:00');
                    const newEnd = new Date(newStart.getTime() + gapMs);
                    const year = newEnd.getFullYear();
                    const month = String(newEnd.getMonth() + 1).padStart(2, '0');
                    const day = String(newEnd.getDate()).padStart(2, '0');
                    finalFechaRetiro = `${year}-${month}-${day}`;
                }
            } catch (err) {
                console.error('Error calculating retiro date:', err);
            }
        }
    } else if (selectedEvent.tipo_evento === 'RETIRO' && isEditingDate) {
        finalFechaRetiro = editedDate;
    }

    const currentSamplerId = isEditingSampler
        ? Number(editedSamplerId)
        : (selectedEvent.tipo_evento === 'INICIO'
            ? Number(selectedEvent.id_muestreador) || 0
            : Number(selectedEvent.id_muestreador2 || selectedEvent.id_muestreador) || 0);

    const payload = {
        assignments: [{
            id: selectedEvent.id_agenda,
            fecha: finalFecha,
            fechaRetiro: finalFechaRetiro,
            idMuestreadorInstalacion: selectedEvent.tipo_evento === 'INICIO' ? currentSamplerId : (Number(selectedEvent.id_muestreador) || 0),
            idMuestreadorRetiro: selectedEvent.tipo_evento === 'RETIRO' ? currentSamplerId : (Number(selectedEvent.id_muestreador2 || selectedEvent.id_muestreador) || 0),
            idFichaIngresoServicio: selectedEvent.id,
            frecuenciaCorrelativo: selectedEvent.correlativo
        }],
        user: { id: user?.id || 0, usuario: user?.name || 'Sistema' }
    };

    setPendingPayload(payload);
    setShowReactivateConfirm(true);
    return;
}
```

Este código debe colocarse al inicio del `onClick`, ANTES del código existente que maneja pendientes.

- [ ] **Step 3: Verificar estructura del onClick**

El `onClick` debe tener ahora este flujo:
1. Validaciones básicas
2. SI es CANCELADO → Mostrar modal de reactivación y retornar
3. SI es PENDIENTE → Flujo existente (versiones o guardar directo)

- [ ] **Step 4: Commit**

```bash
git add frontend-adlone/src/features/medio-ambiente/components/EnProcesoCalendarView.tsx
git commit -m "feat: detect cancelled services and show reactivation modal"
```

---

## Task 4: Implementar Modal de Confirmación de Reactivación

**Files:**
- Modify: `frontend-adlone/src/features/medio-ambiente/components/EnProcesoCalendarView.tsx:1169-1171` (final del componente)

- [ ] **Step 1: Localizar el final del componente (antes del último `</Box>`)**

Ir a línea ~1169, antes de:
```typescript
        </Box>
    );
};
```

- [ ] **Step 2: Agregar el nuevo modal ANTES del cierre del componente**

Antes de `</Box>` y `);` finales, agregar:

```typescript
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

- [ ] **Step 3: Verificar que IconAlertCircle está importado**

Revisar líneas 32-40, debe estar en las importaciones de Tabler Icons:
```typescript
import {
    IconCalendar,
    IconChevronLeft,
    IconChevronRight,
    IconFilter,
    IconSearch,
    IconDeviceFloppy,
    IconAlertCircle  // ← Debe estar aquí
} from '@tabler/icons-react';
```

Si no está, agregarlo.

- [ ] **Step 4: Verificar que Divider está importado de Mantine**

Revisar líneas 2-22, Divider debe estar en las importaciones:
```typescript
import { 
    Stack, 
    Paper, 
    // ... otros componentes
    Divider,  // ← Debe estar aquí
    // ... más componentes
} from '@mantine/core';
```

Si no está, agregarlo.

- [ ] **Step 5: Commit**

```bash
git add frontend-adlone/src/features/medio-ambiente/components/EnProcesoCalendarView.tsx
git commit -m "feat: add reactivation confirmation modal UI"
```

---

## Task 5: Agregar Soporte de `reactivating` Flag en el Backend

**Files:**
- Modify: `api-backend-adlone/src/controllers/bulk-ficha.controller.js`
- Modify: `api-backend-adlone/src/services/bulk-ficha.service.js`

- [ ] **Step 1: Revisar el endpoint `batchUpdateAgenda` en el controlador**

Abrir: `api-backend-adlone/src/controllers/bulk-ficha.controller.js`

Buscar la función `batchUpdateAgenda` (probablemente alrededor de línea 200-300).

- [ ] **Step 2: Localizar dónde se construye el payload para el servicio**

Buscar dentro de `batchUpdateAgenda` donde se llama a `fichaService` o se procesa `req.body.assignments`.

El código probablemente se verá así:
```javascript
const { assignments, user } = req.body;
// ... procesamiento de assignments
await bulkFichaService.updateAssignments(assignments, user);
```

- [ ] **Step 3: Pasar el flag `reactivating` a través del payload**

Modificar para extraer y pasar el flag `reactivating` de cada assignment:

```javascript
const { assignments, user } = req.body;
// ... validaciones existentes

// Procesar cada assignment extrayendo el flag reactivating
const processedAssignments = assignments.map(assignment => ({
    ...assignment,
    reactivating: assignment.reactivating || false
}));

// Pasar al servicio
await bulkFichaService.updateAssignments(processedAssignments, user);
```

- [ ] **Step 4: Ir al servicio bulk-ficha.service.js**

Abrir: `api-backend-adlone/src/services/bulk-ficha.service.js`

Buscar el método `updateAssignments` (puede llamarse de otra forma, buscar donde se actualiza la agenda).

- [ ] **Step 5: Implementar lógica de reactivación en el servicio**

Dentro del bucle que procesa cada assignment, agregar antes de actualizar la agenda:

```javascript
// En el loop de assignments
for (const assignment of assignments) {
    // Si reactivating es true y el estado es CANCELADO, cambiar a PENDIENTE
    if (assignment.reactivating) {
        await request
            .input('id_agenda', sql.Int, assignment.id)
            .input('estado', sql.VarChar(50), 'PENDIENTE')
            .query(`
                UPDATE Agenda 
                SET id_estadomuestreo = 1, 
                    fecha_modificacion = GETDATE()
                WHERE id_agenda = @id_agenda
            `);
    }
    
    // Continuar con la actualización normal de fecha/muestreador
    // ... resto del código existente
}
```

**Nota:** Los nombres de columnas y tabla pueden variar. Usar los existentes en la BD.

- [ ] **Step 6: Validar que se mantiene el historial de cancelación**

En el paso anterior, NO se borran `motivo_cancelacion` ni `fecha_cancelacion`. El UPDATE solo cambia el estado a PENDIENTE, los otros campos se quedan igual para auditoría.

- [ ] **Step 7: Commit**

```bash
git add api-backend-adlone/src/controllers/bulk-ficha.controller.js
git add api-backend-adlone/src/services/bulk-ficha.service.js
git commit -m "feat: add reactivating flag support to batchUpdateAgenda"
```

---

## Task 6: Testing Manual del Flujo Completo

**Files:**
- Test: Frontend + Backend integration

- [ ] **Step 1: Iniciar el backend**

```bash
cd api-backend-adlone
npm run dev
```

Verificar que el servidor está escuchando en puerto 4000.

- [ ] **Step 2: Iniciar el frontend**

En otra terminal:
```bash
cd frontend-adlone
npm run dev
```

Verificar que está disponible en `http://localhost:5173` (o el puerto configurado).

- [ ] **Step 3: Navegar al Calendario de Servicios**

1. Login en la aplicación con usuario que tenga permisos `MA_CALENDARIO_ACCESO` y `MA_CALENDARIO_REAGENDAR`
2. Ir a Medio Ambiente → Calendario de Servicios
3. Asegurarse de que hay servicios CANCELADOS en el calendario

- [ ] **Step 4: Test Case 1: Campos editables para cancelados**

1. Haz clic en un servicio CANCELADO
2. Verifica que los campos "Fecha de Muestreo" y "Muestreador" están editables (no estáticos)
3. Los campos deben verse como inputs/selects, no como texto plano

**Esperado:** ✓ Campos editables

- [ ] **Step 5: Test Case 2: Modal de reactivación aparece**

1. En el mismo servicio CANCELADO, cambia la fecha o el muestreador
2. Haz clic en "Guardar Cambios"
3. Verifica que aparece un modal que dice "Reactivar y Reagendar Muestreo"
4. El modal debe mostrar:
   - El motivo de cancelación anterior
   - Las observaciones (si existen)
   - Un resumen de los nuevos datos

**Esperado:** ✓ Modal aparece con contenido correcto

- [ ] **Step 6: Test Case 3: Cancelar la reactivación**

1. En el modal, haz clic en "No, Volver"
2. Verifica que el modal se cierra y no se guarda nada
3. Los datos no deben cambiar

**Esperado:** ✓ Modal se cierra, sin cambios guardados

- [ ] **Step 7: Test Case 4: Confirmar reactivación (solo muestreador)**

1. En un servicio CANCELADO, cambia SOLO el muestreador (no la fecha)
2. Haz clic en "Guardar Cambios"
3. Confirma en el modal de reactivación
4. Verifica en la consola del navegador que se hace una llamada a `batchUpdateAgenda` con `reactivating: true`
5. El servicio debe cambiar a estado PENDIENTE en el calendario

**Esperado:** ✓ Servicio reactivado y muestreador actualizado

- [ ] **Step 8: Test Case 5: Confirmar reactivación (fecha + muestreador)**

1. En otro servicio CANCELADO, cambia TANTO la fecha como el muestreador
2. Haz clic en "Guardar Cambios"
3. Confirma en el modal de reactivación
4. Verifica que después aparece el modal de "Versión de Equipos" (existente)
5. Selecciona una opción (mantener o actualizar versiones)
6. El servicio debe reactivarse con las nuevas fechas

**Esperado:** ✓ Modal de versiones aparece, servicio se reactivar con cambios

- [ ] **Step 9: Test Case 6: Servicio ejecutado sigue siendo estático**

1. Busca un servicio EJECUTADO en el calendario
2. Haz clic en él
3. Verifica que los campos están estáticos (no editables)

**Esperado:** ✓ Campos estáticos, no se puede editar

- [ ] **Step 10: Verificar permisos**

1. Logout
2. Login con un usuario SIN permiso `MA_CALENDARIO_REAGENDAR`
3. Abre un servicio CANCELADO
4. Verifica que los campos están estáticos (no editables)

**Esperado:** ✓ Campos bloqueados para usuarios sin permiso

- [ ] **Step 11: Commit de cambios (si hay ajustes)**

Si fue necesario hacer ajustes durante el testing, commitear:

```bash
git add .
git commit -m "test: manual testing of reactivation feature complete"
```

---

## Task 7: Verificación Final y Limpieza

**Files:**
- Verify: Frontend + Backend code quality

- [ ] **Step 1: Lint del frontend**

```bash
cd frontend-adlone
npm run lint
```

Resolver cualquier error de ESLint.

- [ ] **Step 2: Type checking**

```bash
npx tsc -b
```

Verificar que no hay errores de TypeScript.

- [ ] **Step 3: Build del frontend**

```bash
npm run build
```

Verificar que la build se completa sin errores.

- [ ] **Step 4: Revisar los cambios de git**

```bash
git log --oneline -5
```

Verificar que hay 4-5 commits relacionados con la feature:
1. "feat: add reactivation modal state management"
2. "feat: enable editing for cancelled services"
3. "feat: detect cancelled services and show reactivation modal"
4. "feat: add reactivation confirmation modal UI"
5. "feat: add reactivating flag support to batchUpdateAgenda"

- [ ] **Step 5: Crear un resumen de cambios**

Ver git diff:
```bash
git diff main~5..HEAD --stat
```

Resumen esperado:
- `EnProcesoCalendarView.tsx`: ~100-150 líneas agregadas
- `bulk-ficha.controller.js`: ~20-30 líneas modificadas
- `bulk-ficha.service.js`: ~30-40 líneas modificadas

- [ ] **Step 6: Commit final (si hay ajustes de lint/build)**

```bash
git add .
git commit -m "refactor: clean up linting and type issues"
```

---

## Puntos de Verificación Críticos

1. ✅ **Estados agregados:** `showReactivateConfirm` y `isReactivating` creados
2. ✅ **Condiciones de visibilidad:** Solo EJECUTADOS quedan bloqueados
3. ✅ **Modal de reactivación:** Muestra motivo, observaciones, nuevos datos
4. ✅ **Flag en payload:** `reactivating: true` se envía al backend
5. ✅ **Lógica de backend:** Cambia estado a PENDIENTE cuando `reactivating: true`
6. ✅ **Historial:** Motivo de cancelación se mantiene (no se borra)
7. ✅ **Flujo de versiones:** Se muestra modal de equipos si cambia la fecha
8. ✅ **Permisos:** Se usa `MA_CALENDARIO_REAGENDAR` (existente)

---

## Rollback Plan (si algo falla)

Si necesitas deshacer todos los cambios:

```bash
# Deshacer últimos 5 commits
git reset --hard main~5

# O deshacer archivo específico
git checkout main -- frontend-adlone/src/features/medio-ambiente/components/EnProcesoCalendarView.tsx
```

---

## Próximos Pasos Después de Implementar

1. Code review con el equipo
2. Testing QA en ambiente de staging
3. Merge a main
4. Despliegue a producción
