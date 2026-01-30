# Guía de Creación de Permisos y Seguridad (RBAC)

Este documento detalla el flujo de trabajo estándar para asegurar una nueva funcionalidad o página dentro del sistema.

## 1. Definición de Jerarquía
Antes de escribir código, define dónde encaja el nuevo permiso en la estructura de 3 niveles:

1.  **Módulo (Área)**: ¿A qué área mayor pertenece? (Ej. `MEDIO AMBIENTE`, `ADMINISTRACION`).
2.  **Submódulo**: ¿En qué agrupación lógica está? (Ej. `Fichas Ingreso`, `Reportes`, `Mantenedores`).
3.  **Funcionalidad**: ¿Qué acción específica realiza? (Ej. `Ver`, `Crear`, `Aprobar`).

**Nomenclatura Estándar:** `AREA_SUBMODULO_ACCION`
*   Ejemplo: `MA_REPORTES_EXPORTAR`

---

## 2. Base de Datos (SQL)
Crea un script SQL para insertar el permiso en la tabla `mae_permiso`.
**Ruta:** `db_scripts/XX_nombre_script.sql`

```sql
-- Verificar que no exista
IF NOT EXISTS (SELECT 1 FROM mae_permiso WHERE codigo = 'MA_NUEVO_PERMISO')
BEGIN
    INSERT INTO mae_permiso (codigo, nombre, modulo, submodulo, tipo) 
    VALUES (
        'MA_NUEVO_PERMISO',    -- Código Único
        'Exportar Excel',      -- Nombre visible en UI
        'MA',                  -- Módulo (Sigla)
        'Reportes',            -- Submódulo (Agrupador en UI)
        'ACCION'               -- Tipo: 'VISTA' o 'ACCION'
    );
END
```

> **Nota:** Si es un permiso crítico, considera asignárselo automáticamente al rol `Administrador` en el mismo script.

---

## 3. Backend (API & Endpoints)
Protege las rutas del servidor para que nadie pueda llamar a la API sin permiso, incluso si usan Postman.

**Archivo:** `src/routes/tu_ruta.routes.js`

```javascript
const { verifyPermission } = require('../middlewares/auth.middleware');

// Proteger la ruta con el middleware
router.post(
    '/reportes/exportar', 
    verifyPermission('MA_NUEVO_PERMISO'), // <--- El código debe coincidir con SQL
    reportesController.exportarExcel
);
```

---

## 4. Frontend (UI & Componentes)
Oculta botones o redirige páginas si el usuario no tiene el permiso.

### A. Proteger una Pantalla Completa (Ruta)
**Archivo:** `src/App.tsx` o configuración de rutas.

```tsx
<Route 
    path="/reportes" 
    element={
        <ProtectedContent requiredPermission="MA_REPORTES_ACCESO">
            <ReportesPage />
        </ProtectedContent>
    } 
/>
```

### B. Ocultar un Botón o Sección
**Archivo:** Tu componente (ej. `ReportesPage.tsx`).

```tsx
import { useAuth } from '../../context/AuthContext';

const ReportesPage = () => {
    const { hasPermission } = useAuth();

    return (
        <div>
            <h1>Reportes</h1>
            
            {/* Solo mostrar si tiene permiso de exportar */}
            {hasPermission('MA_NUEVO_PERMISO') && (
                <button onClick={handleExport}>
                    Exportar a Excel
                </button>
            )}
        </div>
    );
};
```

---

## 5. Validación (Gestión de Roles)
Finalmente, verifica que el permiso aparezca y funcione correctamente en la UI de Administración.

1.  Entra a **Administración -> Informatica -> Gestión de Roles**.
2.  Edita un rol (o crea uno de prueba).
3.  Verifica que tu nuevo permiso aparezca bajo la jerarquía correcta:
    *   **Módulo:** `MA` (Medio Ambiente)
    *   **Submódulo:** `Reportes`
    *   **Permiso:** `Exportar Excel`
4.  **Prueba de Fuego:**
    *   Asigna el permiso a tu usuario -> El botón debe aparecer.
    *   Quita el permiso -> El botón debe desaparecer.

---

## Checklist Rápido
- [ ] Definir Nombre (`CODIGO_UNICO`).
- [ ] Script SQL (Insert).
- [ ] Middleware Backend (`verifyPermission`).
- [ ] Frontend (`hasPermission` o `<ProtectedContent>`).
- [ ] Verificar en Modal de Roles.
