/**
 * Genera el archivo Excel del Checklist QA de fixes ADL ONE.
 * Ejecutar: node generate-qa-excel.cjs
 * Salida: ./Checklist-QA-Fixes-ADLONE.xlsx
 */

const path = require('path');
const ExcelJS = require(path.join(__dirname, 'api-backend-adlone', 'node_modules', 'exceljs'));

const tests = [
    // ───────────────────────────────────────────────────────
    // FASE 1 — Bugs críticos
    // ───────────────────────────────────────────────────────
    ['1', 'MA-05', 'Entrar al maestro EMPRESA DE SERVICIO con 500+ registros', 'No crashea con "Cannot read properties of null (toLowerCase)"', '🔴 Crítico'],
    ['1', 'RB-03', 'Cambiar el rol de un usuario en Gestión de Usuarios', 'No crashea con error toLowerCase', '🔴 Crítico'],
    ['1', 'A-07', 'Asignar fecha de instalación posterior a fecha de retiro', 'Toast de error nombrando los correlativos. No guarda', '🔴 Crítico'],
    ['1', 'A-07 (UI)', 'Input F. Instalación tiene max=retiro; F. Retiro tiene min=instalación', 'Navegador bloquea la combinación inválida', '🟡 Alto'],
    ['1', 'A-02', 'Intentar elegir fecha anterior a hoy en asignación', 'Navegador bloquea; backend rechaza si manipulan DOM', '🔴 Crítico'],
    ['1', 'C-07', 'Reagendar desde calendario con fecha pasada', 'Input min=hoy; no permite seleccionar', '🟡 Alto'],
    ['1', 'A-01', 'Lista de asignación NO muestra fichas en PENDIENTE COORDINACIÓN', 'Solo aparecen id_validaciontecnica 5 o 6 con disponibles', '🔴 Crítico'],
    ['1', 'A-01 (EN PROCESO)', 'Fichas EN PROCESO sin servicios disponibles no aparecen', 'Filtradas por servicios_disponibles > 0', '🟡 Alto'],
    ['1', 'R-11', 'Planificador de rutas excluye fichas PENDIENTE COORDINACIÓN', 'Mismo filtro que A-01', '🔴 Crítico'],
    ['1', 'A-09 (servicio)', 'Seleccionar Servicio 2 en planificador y guardar', 'Se guarda el Servicio 2, no otro. No fallback silencioso', '🔴 Crítico'],
    ['1', 'A-09 (edge)', 'Servicio elegido pasa a AGENDADO/EJECUTADO/CANCELADO antes de guardar', 'Se omite con toast en vez de guardar incorrecto', '🟡 Alto'],
    ['1', 'A-09 (403)', 'Usuario con FI_GEST_ASIG abre comparación de versiones de remuestreo', 'Permite abrir el modal (antes daba 403)', '🟡 Alto'],
    ['1', 'C-04', 'Abrir ficha YA CANCELADA en calendario', 'Botón Cancelar Muestreo NO aparece', '🟡 Alto'],
    ['1', 'C-05', 'Abrir ficha YA EJECUTADA en calendario', 'Botón Cancelar Muestreo NO aparece + backend rechaza', '🔴 Crítico'],
    ['1', 'C-06 INICIO', 'Cambiar muestreador en evento tipo INICIO, guardar, reabrir', 'Select muestra el muestreador nuevo (no el de retiro)', '🟡 Alto'],
    ['1', 'C-06 RETIRO', 'Evento tipo RETIRO muestra muestreador correcto (id_muestreador2)', 'Select muestra muestreador de retiro', '🟡 Alto'],

    // ───────────────────────────────────────────────────────
    // FASE 2 — Fichas
    // ───────────────────────────────────────────────────────
    ['2', 'F-01a', 'Crear ficha y cerrar modal con "Volver al Menú"', 'Lleva al Listado de Fichas, no al selector', '🟡 Alto'],
    ['2', 'F-01a (ver)', 'Botón Ver Ficha del modal éxito', 'Lleva al detalle de la ficha recién creada', '🟢 Medio'],
    ['2', 'F-01b', 'Grabar análisis con normativas/tablas distintas', 'Tabla muestra columnas Normativa y Tabla/Referencia por línea', '🔴 Crítico'],
    ['2', 'F-01b BD', 'Inspeccionar App_Ma_FichaIngresoServicio_DET', 'Cada fila tiene id_normativa y id_normativareferencia correctos', '🟡 Alto'],
    ['2', 'F-01c', 'Campo Número Instrumento (instrumento != Otro)', 'Solo permite dígitos. Placeholder "Solo número (ej: 123)"', '🟡 Alto'],
    ['2', 'F-01c (Otro)', 'Campo Número Instrumento (instrumento = Otro)', 'Permite texto libre. Placeholder "Texto libre"', '🟡 Alto'],
    ['2', 'F-01d', 'Campo Año Instrumento', 'Solo dígitos máx 4. Error inline si fuera rango 1900-año+1', '🟡 Alto'],
    ['2', 'F-01e', 'Selects de cliente/empresa/fuente/objetivo/etc.', 'No tienen "No Aplica" hardcoded como primera opción', '🟢 Medio'],
    ['2', 'F-01e (excepción)', 'Medición Caudal sigue teniendo "No Aplica"', 'Conservado porque es opcional legítimo', '🟢 Medio'],
    ['2', 'F-01f (Otro)', 'Instrumento "Otro" + texto en Número', 'BD guarda solo el texto (no "Otro Otro...")', '🔴 Crítico'],
    ['2', 'F-01f (vacío)', 'Instrumento seleccionado sin número ni año', 'BD guarda solo el nombre, sin "/"', '🟡 Alto'],
    ['2', 'F-01f (normal)', 'Instrumento "DS 90" + 123 + 2024', 'BD guarda "DS 90 123/2024"', '🟡 Alto'],
    ['2', 'F-01g', 'Crear ficha a una hora conocida (ej 15:30)', 'Línea de tiempo muestra hora local correcta (no -4h)', '🔴 Crítico'],
    ['2', 'F-01g BD', 'Inspeccionar mae_ficha_historial.fecha', 'Tiene hora local de Chile', '🟡 Alto'],
    ['2', 'F-11 (analisis)', 'Sin completar Antecedentes, click directo en tab Análisis', 'Toast de error, no cambia de tab', '🟡 Alto'],
    ['2', 'F-11 (obs)', 'Sin grabar análisis, click directo en tab Observaciones', 'Toast de error, no cambia de tab', '🟡 Alto'],
    ['2', 'F-15', 'Cambiar Instrumento Ambiental a "No aplica"', 'Campos Número y Año se vacían y deshabilitan', '🟢 Medio'],
    ['2', 'F-15 reverso', 'Cambiar a otro instrumento', 'Campos se habilitan nuevamente', '🟢 Medio'],
    ['2', 'F-16 (punto)', 'En Duración escribir 1.5', 'Solo guarda 15 (filtra el punto)', '🟢 Medio'],
    ['2', 'F-16 (texto)', 'En Duración pegar "horas"', 'No se acepta nada', '🟢 Medio'],
    ['2', 'F-35', 'Abrir edición de ficha existente con datos completos', 'Todos los campos prellenados (incluye ubicación, comuna, región, código, ETFA)', '🔴 Crítico'],
    ['2', 'F-36', 'Tipear rápido en Nueva Observación (modo edición)', 'Sin lag perceptible', '🟡 Alto'],
    ['2', 'F-36 (técnica)', 'Tipear rápido en observaciones Técnica/Coordinación', 'Sin lag', '🟡 Alto'],
    ['2', 'F-37', 'Guardar edición sin cambios ni observación', 'Guarda con texto por defecto, sin bloquear', '🟡 Alto'],
    ['2', 'F-24', 'Ficha con referencia Google Maps + coordenadas', 'Sección "Ubicación" con link, botón, mapa OSM, coords', '🟡 Alto'],
    ['2', 'F-25', 'Ficha con link pero sin coordenadas resueltas', 'Muestra link + mensaje "Coordenadas no resueltas"', '🟡 Alto'],
    ['2', 'F-24/25 (sin nada)', 'Ficha sin referencia ni coordenadas', 'La sección no aparece', '🟢 Medio'],
    ['2', 'F-34', 'Abrir ficha de remuestreo (es_remuestreo=S)', 'WorkflowAlert azul con referencia a ficha original + título incluye "(REMUESTREO DE LA FICHA N° X)"', '🟡 Alto'],
    ['2', 'F-40 (creación)', 'Crear ficha nueva, ver historial', 'Aparece evento FICHA CREADA con hora correcta y usuario', '🟡 Alto'],
    ['2', 'F-40 (asignación)', 'Asignar fechas/muestreadores, ver historial', 'Aparece "Asignación Masiva"', '🟡 Alto'],
    ['2', 'F-40 (aprobación)', 'Aprobar/Rechazar técnica, ver historial', 'Aparece evento correspondiente', '🟢 Medio'],

    // ───────────────────────────────────────────────────────
    // FASE 3 — Rutas / Calendario / Asignación
    // ───────────────────────────────────────────────────────
    ['3', 'R-05 crear', 'Crear grupo con nombre existente (mismo case)', 'Error 409 "Ya existe un grupo con ese nombre"', '🟡 Alto'],
    ['3', 'R-05 case', 'Crear grupo con nombre existente en distinto case (MANTENCIÓN vs Mantención)', 'Error 409 (case-insensitive)', '🟡 Alto'],
    ['3', 'R-05 editar', 'Renombrar grupo a uno que ya existe', 'Error 409', '🟡 Alto'],
    ['3', 'R-08', 'Eliminar grupo con rutas → quedan en "Sin grupo"', 'Header muestra botón "Asignar a grupo" o "N sin grupo — asignar"', '🟡 Alto'],
    ['3', 'R-08 (1 ruta)', 'Sin grupo con 1 ruta → click en botón', 'Abre modal de Cambiar grupo para esa ruta', '🟢 Medio'],
    ['3', 'C-09', 'Placeholder del buscador de calendario', 'Dice "N° ficha, correlativo, empresa, muestreador..."', '🟢 Medio'],
    ['3', 'C-09 (buscar)', 'Buscar por correlativo en calendario', 'Filtra correctamente', '🟢 Medio'],
    ['3', 'C-01', 'Ficha con solo fecha de retiro asignada (sin muestreo)', 'Aparece en calendario en el mes del retiro', '🟡 Alto'],
    ['3', 'A-05', 'En asignación, solo fecha (sin muestreador)', 'Permite guardar; muestreador conserva valor previo', '🟡 Alto'],
    ['3', 'A-06', 'En asignación, solo muestreador (sin fecha)', 'Permite guardar; fecha conserva valor previo', '🟡 Alto'],
    ['3', 'A-05/06 (vacío)', 'Sin ningún dato en ninguna fila', 'Toast "Debe ingresar al menos una fecha o un muestreador..."', '🟢 Medio'],
    ['3', 'M-06', 'Descargar PDF de ficha con muestreo ejecutado', 'PDF incluye sección "Datos de Ejecución del Muestreo" con totalizadores y fechas reales', '🔴 Crítico'],
    ['3', 'M-06 (sin ejec)', 'PDF de ficha sin muestreos ejecutados', 'No aparece la sección extra, solo la tabla de asignación', '🟢 Medio'],
    ['3', 'R-09', 'Ver historial de ejecuciones de una ruta', 'Modal abre con ejecuciones registradas', '🟡 Alto'],
    ['3', 'R-03', 'Seleccionar fichas en planificador de rutas', 'Polyline solo aparece DESPUÉS del cálculo OSRM (no línea recta intermedia)', '🟢 Medio'],

    // ───────────────────────────────────────────────────────
    // FASE 4 — Equipos / Muestreadores
    // ───────────────────────────────────────────────────────
    ['4', 'E-01 (step1)', 'En crear equipo, click "Siguiente"', 'Pasa al step de Bulk Check', '🟡 Alto'],
    ['4', 'E-01 (guardar)', 'En step Bulk Check, click "Guardar Todo"', 'Abre modal de confirmación y luego guarda', '🔴 Crítico'],
    ['4', 'E-01 (asociado)', 'Dropdown "Equipo Asociado" en formulario', 'Muestra "CÓDIGO - Nombre", no IDs crudos. Es searchable', '🟡 Alto'],
    ['4', 'MS-05 (label)', 'Editar muestreador → ver campo Clave', 'Label "Clave de Acceso (opcional)", no required', '🟡 Alto'],
    ['4', 'MS-05 (vacío)', 'Editar muestreador sin escribir clave', 'Conserva la clave actual (probar login)', '🔴 Crítico'],
    ['4', 'MS-05 (cambio)', 'Editar muestreador con clave nueva', 'Cambia la clave correctamente', '🟡 Alto'],
    ['4', 'MS-06', 'Intentar subir PDF como firma', 'Toast error "La firma debe ser una imagen PNG o JPG"', '🟢 Medio'],
    ['4', 'MS-07', 'Subir imagen > 2 MB como firma', 'Toast error con tamaño real y máximo', '🟢 Medio'],
    ['4', 'MS-04', 'Deshabilitar muestreador con asignaciones futuras', 'Alert rojo con conteo y hasta 5 ejemplos de muestreos pendientes', '🟡 Alto'],
    ['4', 'MS-04 (sin)', 'Deshabilitar muestreador SIN asignaciones futuras', 'No aparece el Alert de advertencia', '🟢 Medio'],
    ['4', 'MS-01', 'Como admin con AI_MA_CREAR_NEW_MUESTREADOR', 'Ve botón "Nuevo Muestreador"', '🟡 Alto'],
    ['4', 'MS-02', 'Crear muestreador con nombre/correo existente', 'Advertencia de duplicado', '🟢 Medio'],

    // ───────────────────────────────────────────────────────
    // FASE 5 — Auth / Reset / RBAC
    // ───────────────────────────────────────────────────────
    ['5', 'S-01', 'Ver el formulario de login', 'Label "Usuario" (no "Usuario / Email"), placeholder "ej: jperez"', '🟢 Medio'],
    ['5', 'S-11', 'Login con espacios al inicio/final del usuario y contraseña', 'Inicia sesión correctamente (trim)', '🟢 Medio'],
    ['5', 'S-02', 'Login con clave en mayúsculas distintas a la guardada', 'Falla con "Credenciales inválidas"', '🔴 Crítico'],
    ['5', 'S-02 (usuario)', 'Login con username en distinto case', 'Funciona (username sigue case-insensitive)', '🟢 Medio'],
    ['5', 'S-03 (404)', 'Login con usuario inexistente', 'Mensaje "Usuario inexistente" (HTTP 404)', '🟡 Alto'],
    ['5', 'S-03 (401)', 'Login con usuario válido + clave incorrecta', 'Mensaje "Credenciales inválidas" (HTTP 401)', '🟡 Alto'],
    ['5', 'S-03 (403)', 'Login con usuario deshabilitado', 'Mensaje "Usuario deshabilitado" (HTTP 403)', '🟡 Alto'],
    ['5', 'S-13 bloqueo', 'Fallar login 5 veces seguidas', 'Al 6to intento: "Demasiados intentos fallidos. Inténtelo en N minutos" (HTTP 423)', '🟡 Alto'],
    ['5', 'S-13 reset', 'Login exitoso después de fallar 2-3 veces', 'Contador se resetea', '🟢 Medio'],
    ['5', 'S-13 BD', 'Inspeccionar mae_login_attempts', 'Tiene failed_count y locked_until poblados', '🟢 Medio'],
    ['5', 'S-07', 'Esperar expiración del JWT o forzar invalidación', 'Próxima petición: logout automático con mensaje "Tu sesión fue cerrada..."', '🟡 Alto'],
    ['5', 'S-14 enviado', 'Clic en "¿Olvidaste tu contraseña?" + email registrado', 'Mensaje genérico "Si el email está registrado..."', '🔴 Crítico'],
    ['5', 'S-15 genérico', 'Solicitar reset con email NO registrado', 'Mismo mensaje genérico (no revela existencia)', '🟡 Alto'],
    ['5', 'S-14 email', 'Verificar inbox del email registrado', 'Llega el correo con link válido por 60 min', '🔴 Crítico'],
    ['5', 'S-16 link válido', 'Abrir el link del email', 'Muestra form de Reset con nombre de usuario', '🔴 Crítico'],
    ['5', 'S-16 manipulado', 'Modificar el token en la URL', 'Muestra "El link no es válido"', '🟡 Alto'],
    ['5', 'S-16 usado', 'Usar el link dos veces', 'Segunda vez: "El link ya fue utilizado"', '🟡 Alto'],
    ['5', 'S-16 expirado', 'Esperar > 60 min y abrir el link', 'Muestra "El link ha expirado"', '🟢 Medio'],
    ['5', 'S-17', 'Solicitar reset dos veces seguidas', 'Solo el último link funciona; el primero queda inválido', '🟡 Alto'],
    ['5', 'Reset aplicar', 'Aplicar nueva clave + intentar login', 'Login funciona con nueva clave', '🔴 Crítico'],
    ['5', 'Reset bloqueo', 'Si el usuario estaba bloqueado por intentos, completar reset', 'Bloqueo se limpia automáticamente', '🟢 Medio'],
    ['5', 'RB-01 overlay', 'Abrir modal Crear Nuevo Usuario', 'NO se ve overlay blanco residual detrás del modal', '🟡 Alto'],
    ['5', 'RB-01 lag', 'Tipear en campos del modal de crear usuario', 'Sin lag perceptible', '🟡 Alto'],
    ['5', 'RB-04', 'Usuario A logueado, admin lo deshabilita desde otra sesión', 'Próxima petición: A se desloguea automáticamente con mensaje', '🔴 Crítico'],
    ['5', 'RB-07', 'Cambiar permisos de un usuario logueado', 'Próxima petición: se desloguea (mismo mecanismo permisos_version)', '🟡 Alto'],
    ['5', 'RB-08 BD', 'Verificar referencias a AI_MA_ADMIN_ACCESO', 'Backend verifyPermission y frontend AuthContext NO lo chequean', '🔴 Crítico'],
    ['5', 'RB-09', 'Deshabilitar rol que tiene N usuarios', 'Modal de confirmación dice "N usuarios perderán sus permisos..."', '🟡 Alto'],

    // ───────────────────────────────────────────────────────
    // FASE 6 — Polish UX
    // ───────────────────────────────────────────────────────
    ['6', 'MA-01 vacío', 'Crear registro de maestro con todos los campos vacíos', 'Toast "Debe completar al menos un campo para guardar"', '🟡 Alto'],
    ['6', 'MA-01 display', 'Crear registro sin el campo principal (display) lleno', 'Toast "Faltan campos obligatorios: <nombre>"', '🟡 Alto'],
    ['6', 'MA-03', 'Deshabilitar registro maestro', 'Confirm() del browser con advertencia de uso en fichas activas', '🟡 Alto'],
    ['6', 'MA-03 cancel', 'Cancelar el confirm', 'No se deshabilita el registro', '🟢 Medio'],
    ['6', 'N-04', 'Click en "Marcar todas como leídas"', 'Badge baja a 0; notificaciones quedan sin fondo azul', '🟡 Alto'],
    ['6', 'CH-03 PDF', 'Enviar PDF como adjunto en chat', 'Aparece icono rojo PDF (no genérico)', '🟢 Medio'],
    ['6', 'CH-03 Excel', 'Enviar XLSX como adjunto en chat', 'Aparece icono verde Excel', '🟢 Medio'],
    ['6', 'CH-03 Word', 'Enviar DOCX como adjunto en chat', 'Aparece icono azul Word', '🟢 Medio'],
    ['6', 'CH-03 ZIP', 'Enviar ZIP/RAR como adjunto en chat', 'Aparece icono específico', '🟢 Medio'],
    ['6', 'CH-04', 'Intentar enviar archivo > 25 MB en chat', 'Mensaje de error con nombre y límite', '🟡 Alto'],
    ['6', 'X-10', 'Parar el backend mientras se está logueado', 'Aparece banner naranjo "Sin conexión en tiempo real..."', '🟡 Alto'],
    ['6', 'X-10 recup', 'Reiniciar el backend', 'Banner desaparece cuando socket reconecta', '🟢 Medio'],
    ['6', 'X-08', 'Solicitar reset de password para usuario con nombre <script>', 'Email muestra el nombre como texto literal (no ejecuta)', '🟡 Alto']
];

async function main() {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ADL ONE QA';
    wb.created = new Date();

    // ── Hoja 1: Pruebas ──────────────────────────────────────
    const sh = wb.addWorksheet('Pruebas', {
        properties: { tabColor: { argb: 'FF1E40AF' } },
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    });

    sh.columns = [
        { header: '#',                  key: 'idx',      width: 5   },
        { header: 'Fase',               key: 'fase',     width: 8   },
        { header: 'ID',                 key: 'id',       width: 18  },
        { header: 'Caso de prueba',     key: 'caso',     width: 60  },
        { header: 'Resultado esperado', key: 'esperado', width: 60  },
        { header: 'Resultado obtenido', key: 'obtenido', width: 40  },
        { header: 'Estado',             key: 'estado',   width: 14  },
        { header: 'Severidad',          key: 'sev',      width: 14  },
        { header: 'Notas',              key: 'notas',    width: 40  }
    ];

    // Estilo del header
    const headerRow = sh.getRow(1);
    headerRow.height = 26;
    headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
            top:    { style: 'thin', color: { argb: 'FF1E3A8A' } },
            bottom: { style: 'thin', color: { argb: 'FF1E3A8A' } },
            left:   { style: 'thin', color: { argb: 'FF1E3A8A' } },
            right:  { style: 'thin', color: { argb: 'FF1E3A8A' } }
        };
    });

    // Color por fase (banda lateral en la columna "Fase")
    const faseColors = {
        '1': 'FFFEE2E2', // rojo claro
        '2': 'FFFEF3C7', // amarillo claro
        '3': 'FFFFE4E6', // rosa claro
        '4': 'FFE0E7FF', // violeta claro
        '5': 'FFDBEAFE', // azul claro
        '6': 'FFE5E7EB'  // gris claro
    };

    tests.forEach((t, i) => {
        const row = sh.addRow({
            idx: i + 1,
            fase: t[0],
            id: t[1],
            caso: t[2],
            esperado: t[3],
            obtenido: '',
            estado: '',
            sev: t[4],
            notas: ''
        });

        row.alignment = { vertical: 'top', wrapText: true };
        row.height = 38;

        // Color de la celda Fase según número
        const faseCell = row.getCell('fase');
        faseCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: faseColors[t[0]] || 'FFFFFFFF' } };
        faseCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        faseCell.font = { bold: true };

        // Bordes finos
        row.eachCell({ includeEmpty: true }, cell => {
            cell.border = {
                top:    { style: 'thin', color: { argb: 'FFE5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                left:   { style: 'thin', color: { argb: 'FFE5E7EB' } },
                right:  { style: 'thin', color: { argb: 'FFE5E7EB' } }
            };
        });

        // Severidad coloreada
        const sevCell = row.getCell('sev');
        const s = t[4] || '';
        if (s.includes('Crítico')) {
            sevCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
            sevCell.font = { color: { argb: 'FF991B1B' }, bold: true };
        } else if (s.includes('Alto')) {
            sevCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
            sevCell.font = { color: { argb: 'FF92400E' }, bold: true };
        } else if (s.includes('Medio')) {
            sevCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
            sevCell.font = { color: { argb: 'FF065F46' }, bold: true };
        }
        sevCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

        // Centra # y Estado
        row.getCell('idx').alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell('estado').alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Validación de datos en columna Estado (lista desplegable)
    const estadoColLetter = sh.getColumn('estado').letter;
    for (let r = 2; r <= tests.length + 1; r++) {
        sh.getCell(`${estadoColLetter}${r}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: ['"PASA,FALLA,BLOQUEADO,PENDIENTE"'],
            showErrorMessage: true,
            errorTitle: 'Estado inválido',
            error: 'Use solo: PASA, FALLA, BLOQUEADO o PENDIENTE'
        };
    }

    // Formato condicional sobre la columna Estado (colorea según valor)
    sh.addConditionalFormatting({
        ref: `${estadoColLetter}2:${estadoColLetter}${tests.length + 1}`,
        rules: [
            {
                type: 'containsText',
                operator: 'containsText',
                text: 'PASA',
                priority: 1,
                style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FF86EFAC' } }, font: { color: { argb: 'FF14532D' }, bold: true } }
            },
            {
                type: 'containsText',
                operator: 'containsText',
                text: 'FALLA',
                priority: 2,
                style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFCA5A5' } }, font: { color: { argb: 'FF7F1D1D' }, bold: true } }
            },
            {
                type: 'containsText',
                operator: 'containsText',
                text: 'BLOQUEADO',
                priority: 3,
                style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFCD34D' } }, font: { color: { argb: 'FF78350F' }, bold: true } }
            },
            {
                type: 'containsText',
                operator: 'containsText',
                text: 'PENDIENTE',
                priority: 4,
                style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFE5E7EB' } }, font: { color: { argb: 'FF374151' } } }
            }
        ]
    });

    sh.autoFilter = {
        from: { row: 1, column: 1 },
        to:   { row: 1, column: 9 }
    };

    // ── Hoja 2: Resumen con fórmulas dinámicas ───────────────
    const sum = wb.addWorksheet('Resumen', {
        properties: { tabColor: { argb: 'FF059669' } }
    });
    sum.columns = [
        { header: 'Fase', key: 'fase',  width: 35 },
        { header: 'Total', key: 'total', width: 12 },
        { header: '✅ PASA', key: 'pasa', width: 12 },
        { header: '❌ FALLA', key: 'falla', width: 12 },
        { header: '⏸️ BLOQUEADO', key: 'bloq', width: 14 },
        { header: '⏳ PENDIENTE', key: 'pend', width: 14 },
        { header: '% Avance', key: 'avance', width: 12 }
    ];
    const sumHeader = sum.getRow(1);
    sumHeader.height = 28;
    sumHeader.eachCell(c => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
        c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });

    const fases = [
        ['1 — Crashes y críticos', '1'],
        ['2 — Fichas',             '2'],
        ['3 — Rutas/Calendario/Asignación', '3'],
        ['4 — Equipos/Muestreadores', '4'],
        ['5 — Auth/Reset/RBAC',    '5'],
        ['6 — Polish UX',          '6']
    ];

    fases.forEach((f, i) => {
        const fId = f[1];
        const r = sum.addRow({
            fase: f[0],
            total:  { formula: `COUNTIF(Pruebas!B:B,"${fId}")` },
            pasa:   { formula: `COUNTIFS(Pruebas!B:B,"${fId}",Pruebas!G:G,"PASA")` },
            falla:  { formula: `COUNTIFS(Pruebas!B:B,"${fId}",Pruebas!G:G,"FALLA")` },
            bloq:   { formula: `COUNTIFS(Pruebas!B:B,"${fId}",Pruebas!G:G,"BLOQUEADO")` },
            pend:   { formula: `COUNTIFS(Pruebas!B:B,"${fId}",Pruebas!G:G,"PENDIENTE")+COUNTIFS(Pruebas!B:B,"${fId}",Pruebas!G:G,"")` },
            avance: { formula: `IFERROR((COUNTIFS(Pruebas!B:B,"${fId}",Pruebas!G:G,"PASA")+COUNTIFS(Pruebas!B:B,"${fId}",Pruebas!G:G,"FALLA")+COUNTIFS(Pruebas!B:B,"${fId}",Pruebas!G:G,"BLOQUEADO"))/COUNTIF(Pruebas!B:B,"${fId}"),0)` }
        });
        r.getCell('avance').numFmt = '0%';
        r.alignment = { vertical: 'middle', horizontal: 'center' };
        r.getCell('fase').alignment = { vertical: 'middle', horizontal: 'left' };
        r.height = 22;
    });

    // Fila TOTAL
    const totalRow = sum.addRow({
        fase: 'TOTAL',
        total: { formula: `SUM(B2:B${fases.length + 1})` },
        pasa:  { formula: `SUM(C2:C${fases.length + 1})` },
        falla: { formula: `SUM(D2:D${fases.length + 1})` },
        bloq:  { formula: `SUM(E2:E${fases.length + 1})` },
        pend:  { formula: `SUM(F2:F${fases.length + 1})` },
        avance: { formula: `IFERROR((C${fases.length + 2}+D${fases.length + 2}+E${fases.length + 2})/B${fases.length + 2},0)` }
    });
    totalRow.height = 26;
    totalRow.eachCell(c => {
        c.font = { bold: true, size: 12 };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
        c.border = {
            top: { style: 'medium', color: { argb: 'FF1E40AF' } }
        };
    });
    totalRow.getCell('avance').numFmt = '0%';

    // ── Hoja 3: Hallazgos nuevos ─────────────────────────────
    const hl = wb.addWorksheet('Hallazgos nuevos', {
        properties: { tabColor: { argb: 'FFDC2626' } }
    });
    hl.columns = [
        { header: '#',           key: 'idx',     width: 5   },
        { header: 'Sección',     key: 'seccion', width: 30  },
        { header: 'Descripción', key: 'desc',    width: 60  },
        { header: 'Pasos para reproducir', key: 'pasos', width: 50 },
        { header: 'Severidad',   key: 'sev',     width: 14  },
        { header: 'Estado',      key: 'estado',  width: 14  },
        { header: 'Asignado a',  key: 'owner',   width: 20  },
        { header: 'Fecha',       key: 'fecha',   width: 14  }
    ];
    const hlHeader = hl.getRow(1);
    hlHeader.height = 28;
    hlHeader.eachCell(c => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
        c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    // 30 filas vacías para ir rellenando
    for (let i = 1; i <= 30; i++) {
        const r = hl.addRow({ idx: i, seccion: '', desc: '', pasos: '', sev: '', estado: '', owner: '', fecha: '' });
        r.alignment = { vertical: 'top', wrapText: true };
        r.height = 30;
        r.eachCell({ includeEmpty: true }, c => {
            c.border = { top: { style: 'thin', color: { argb: 'FFE5E7EB' } }, bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
        });
    }
    // Validación severidad y estado en hoja Hallazgos
    for (let r = 2; r <= 31; r++) {
        hl.getCell(`E${r}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: ['"🔴 Crítico,🟡 Alto,🟢 Medio,⚪ Bajo"']
        };
        hl.getCell(`F${r}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: ['"ABIERTO,EN PROGRESO,RESUELTO,DESCARTADO"']
        };
    }
    hl.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 8 } };

    // ── Hoja 4: Prerequisitos ────────────────────────────────
    const pre = wb.addWorksheet('Prerequisitos', {
        properties: { tabColor: { argb: 'FF6366F1' } }
    });
    pre.columns = [
        { header: '#',          key: 'idx',  width: 5 },
        { header: 'Paso',       key: 'paso', width: 80 },
        { header: 'Listo',      key: 'ok',   width: 10 }
    ];
    const preHeader = pre.getRow(1);
    preHeader.height = 28;
    preHeader.eachCell(c => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };
        c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    const prereqs = [
        'SQL ejecutado: db-migrations/phase5-auth-tables.sql',
        'Variable FRONTEND_URL agregada al .env del backend (ej: http://localhost:5173)',
        'Backend reiniciado (npm run dev en api-backend-adlone/)',
        'Frontend corriendo (npm run dev en frontend-adlone/)',
        'SMTP del backend verificado con un envío de prueba',
        'Tener al menos 1 usuario admin y 1 usuario regular para pruebas RB-04/RB-07',
        'Tener al menos 1 ficha existente para probar edición (F-35, F-36, F-37)',
        'Tener al menos 1 ficha de remuestreo para probar F-34 / A-09',
        'Browser con consola Network abierta para verificar status HTTP'
    ];
    prereqs.forEach((p, i) => {
        const r = pre.addRow({ idx: i + 1, paso: p, ok: '' });
        r.height = 24;
        r.alignment = { vertical: 'middle', wrapText: true };
        pre.getCell(`C${i + 2}`).dataValidation = {
            type: 'list', allowBlank: true, formulae: ['"✅,⏳"']
        };
        pre.getCell(`C${i + 2}`).alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Las hojas quedan en orden de creación: Pruebas | Resumen | Hallazgos nuevos | Prerequisitos
    const outPath = path.join(__dirname, 'Checklist-QA-Fixes-ADLONE.xlsx');
    await wb.xlsx.writeFile(outPath);
    console.log(`OK — Archivo creado: ${outPath}`);
    console.log(`     Total de pruebas: ${tests.length}`);
}

main().catch(err => {
    console.error('ERROR:', err);
    process.exit(1);
});
