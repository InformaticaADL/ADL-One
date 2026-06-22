# Regeneración de FoMa / Cadena de Custodia desde ADL ONE Web

## Contexto

La app móvil (`app-mam` + `api-app-mam`) genera dos tipos de documentos PDF durante el proceso de muestreo, guardándolos en una carpeta compartida por `frecuencia_correlativo` (variable de entorno `RUTA_FOTOS`, leída tanto por `api-app-mam` como por `api-backend-adlone`):

- **FoMa** (Formulario de Muestreo): `fomaPuntualTemplate.js` o `fomaCompuestoTemplate.js`, según `tipo_fichaingresoservicio`.
- **Cadena de Custodia**: `cadenaCustodiaTemplate.js`, uno por laboratorio al que se derivan análisis (una ficha puede tener varios).

En ambos templates, el encabezado muestra una línea **"Folio"** con un número secuencial interno (`datos.Folio` / `datos.Numero_Formulario_Muestreo`). Este valor es distinto del **`caso_adlab`** (código tipo `OI-12345`) que el personal GEM asigna manualmente desde ADL ONE Web, en `FichaDetailView.tsx`, al marcar "Realizado por GEM". Por diseño, `caso_adlab` siempre es `null` en el momento en que la app móvil genera los PDFs, por lo que estos documentos nunca muestran el caso ADLab real.

**Objetivo:** cuando el GEM confirma el caso ADLab desde la web, regenerar automáticamente ambos documentos (si ya existen) para que su encabezado muestre **"ID CASO: {caso_adlab}"** en vez de "Folio: {numero}".

## Alcance

- Modificar los 3 templates PDF en `api-app-mam` para que prioricen `caso_adlab` sobre `Folio` cuando esté presente.
- Crear un endpoint nuevo en `api-app-mam` para regenerar Cadena de Custodia a demanda (FoMa ya tiene uno).
- Crear un endpoint nuevo en `api-backend-adlone` que orquesta la llamada a ambos endpoints de `api-app-mam`.
- Modificar el modal "Confirmar ingreso en ADL Soft" en `FichaDetailView.tsx` para disparar la regeneración automáticamente tras guardar el caso ADLab.

Fuera de alcance: cambios al flujo de generación original desde la app móvil (sigue mostrando "Folio" mientras `caso_adlab` sea `null`, sin cambios de comportamiento).

## Diseño

### 1. Templates PDF (`api-app-mam/pdf/*.js`)

En `fomaPuntualTemplate.js`, `fomaCompuestoTemplate.js` y `cadenaCustodiaTemplate.js`, la línea de encabezado del Folio cambia de:

```js
doc.text('Folio', ...);
doc.text(`${naOrValue(datos.Folio)}`, ...);
```

a:

```js
const usarCasoAdlab = datos.caso_adlab && String(datos.caso_adlab).trim() !== '';
doc.text(usarCasoAdlab ? 'ID CASO' : 'Folio', ...);
doc.text(usarCasoAdlab ? String(datos.caso_adlab).trim() : `${naOrValue(datos.Folio)}`, ...);
```

(En `cadenaCustodiaTemplate.js` el campo equivalente a `datos.Folio` es `datos.Numero_Formulario_Muestreo`; misma lógica.)

Como `caso_adlab` es `null` en la generación original (app móvil), esta condición nunca se activa en ese flujo — comportamiento idéntico al actual. Solo se activa cuando el endpoint de regeneración inyecta `caso_adlab` explícitamente.

### 2. Autenticación interna servidor-a-servidor (`api-app-mam`)

Nuevo middleware `middlewares/protectInternalService.js`:

```js
const protectInternalService = (req, res, next) => {
    const key = req.headers['x-internal-key'];
    if (!key || key !== process.env.INTERNAL_API_KEY) {
        return res.status(401).json({ message: 'Clave interna inválida o ausente.' });
    }
    next();
};
module.exports = protectInternalService;
```

Nueva variable de entorno `INTERNAL_API_KEY` (mismo valor) en `.env` de `api-app-mam` Y de `api-backend-adlone`. Se usa solo en los 2 endpoints de regeneración — el resto de la API de `api-app-mam` sigue protegida con `protectRoute` (JWT de usuario móvil) sin cambios.

### 3. Endpoint FoMa (`api-app-mam`) — ya existe, se agrega ruta interna

`generarFoMaManual` (en `controllers/fichaIngresoServicioController.js`) no cambia de lógica. Se agrega una segunda ruta que apunta a la misma función, protegida con la nueva clave interna:

```js
// routes/fichaIngresoServicioRoutes.js
router.post("/interno/generar-foma", protectInternalService, generarFoMaManual);
```

La ruta existente `/generar-foma-manual` (protegida con `protectRoute`, JWT de usuario móvil) no se modifica ni se elimina — queda como está por si la usa la app móvil. La nueva ruta `/interno/generar-foma` es exclusiva para llamadas servidor-a-servidor desde `api-backend-adlone`.

### 4. Endpoint Cadena de Custodia (`api-app-mam`) — nuevo

Se extrae la lógica de generación de un PDF de cadena (hoy inline en `saveTransporte`, líneas ~2357-2471) a una función reutilizable:

```js
// Reutilizada por saveTransporte y por el nuevo endpoint de regeneración.
async function generarCadenaCustodiaParaLab(frecuenciaReal, idLaboratorio, opciones = {}) {
    // opciones: { fechaDerivacion, horaDerivacion, observacionesCadena } — opcionales,
    // si no se pasan se conservan los valores ya persistidos/calculados por getVistaCadenaCustodia.
    let vistaCadenaOriginal = await getVistaCadenaCustodia(frecuenciaReal);
    let vistaCadenaFiltrada = vistaCadenaOriginal.filter(item =>
        String(item.id_laboratorioensayo) === String(idLaboratorio) ||
        String(item.id_laboratorioensayo_2) === String(idLaboratorio)
    );
    if (vistaCadenaFiltrada.length === 0) {
        throw new Error(`No se encontraron análisis para el laboratorio ${idLaboratorio}.`);
    }

    let vistaCadena = transformarDatosCadena(vistaCadenaFiltrada, idLaboratorio);
    if (opciones.fechaDerivacion) vistaCadena.Fecha_derivacion = opciones.fechaDerivacion;
    if (opciones.horaDerivacion) vistaCadena.Hora_derivacion = opciones.horaDerivacion;
    if (opciones.observacionesCadena) vistaCadena.Observaciones_monitoreo = opciones.observacionesCadena;

    const carpetaFrecuencia = obtenerCarpetaPorFrecuencia(frecuenciaReal);
    if (!carpetaFrecuencia) throw new Error('Error al determinar carpeta de frecuencia');

    const nombreFirma = `${frecuenciaReal}_firma_muestreador_retiro.png`;
    const rutaFirma = path.join(carpetaFrecuencia, nombreFirma);
    const firmas = {};
    if (fs.existsSync(rutaFirma)) {
        firmas.firmaMuestreador = rutaFirma;
    } else {
        const fallbackPath = path.join(carpetaFrecuencia, `${frecuenciaReal}_firma_muestreador.png`);
        if (fs.existsSync(fallbackPath)) firmas.firmaMuestreador = fallbackPath;
    }

    const labNombreLimpio = sanitizarNombre(vistaCadena.nombre_laboratorio || `Lab${idLaboratorio}`);
    const nombreArchivo = `CadenaCustodia_${frecuenciaReal}_${labNombreLimpio}.pdf`;
    const rutaPDF = path.join(carpetaFrecuencia, nombreArchivo);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        const writeStream = fs.createWriteStream(rutaPDF);
        doc.pipe(writeStream);
        generarCadenaCustodiaPDF(doc, vistaCadena, firmas);
        doc.end();
        writeStream.on('finish', () => resolve(rutaPDF));
        writeStream.on('error', reject);
    });
}
```

`saveTransporte` se reescribe para llamar a esta función en vez de tener la lógica inline (mismo comportamiento, sin duplicación).

Nuevo controlador `generarCadenaCustodiaManual`:

```js
const generarCadenaCustodiaManual = async (req, res) => {
    const { id_agendamam } = req.body;
    if (!id_agendamam) return res.status(400).json({ message: "Falta id_agendamam" });

    try {
        const registro = await AgendaMuestreo.findOne({ where: { id_agendamam } });
        if (!registro) return res.status(404).json({ message: "Muestreo no encontrado" });

        const frecuenciaReal = registro.frecuencia_correlativo;
        const carpetaFrecuencia = obtenerCarpetaPorFrecuencia(frecuenciaReal);
        if (!carpetaFrecuencia || !fs.existsSync(carpetaFrecuencia)) {
            return res.json({ regenerados: 0, message: "No hay carpeta de frecuencia; nada que regenerar." });
        }

        // Detectar PDFs de Cadena de Custodia ya generados para esta frecuencia.
        const prefijo = `CadenaCustodia_${frecuenciaReal}_`;
        const archivosExistentes = fs.readdirSync(carpetaFrecuencia)
            .filter(f => f.startsWith(prefijo) && f.endsWith('.pdf'));

        if (archivosExistentes.length === 0) {
            return res.json({ regenerados: 0, message: "No hay Cadena de Custodia previa; nada que regenerar." });
        }

        // Mapear cada archivo a su laboratorio comparando el sufijo sanitizado.
        // Modelo real: LaboratorioEnsayo (tabla mae_laboratorioensayo), campo
        // nombre_laboratorioensayo — es el mismo valor que CadenaCustodiaScreen.jsx
        // envía como `nombre_laboratorio` al generar el archivo originalmente (línea 308/494/764),
        // por lo que sanitizarNombre(nombre_laboratorioensayo) reproduce el mismo slug.
        const labsActivos = await LaboratorioEnsayo.findAll({ where: { habilitado: 'S' } });
        const resultados = [];

        for (const archivo of archivosExistentes) {
            const slug = archivo.slice(prefijo.length, -'.pdf'.length);
            const lab = labsActivos.find(l => sanitizarNombre(l.nombre_laboratorioensayo) === slug);
            if (!lab) {
                resultados.push({ archivo, ok: false, error: 'No se pudo determinar el laboratorio de este archivo.' });
                continue;
            }
            try {
                await generarCadenaCustodiaParaLab(frecuenciaReal, lab.id_laboratorioensayo);
                resultados.push({ archivo, ok: true, laboratorio: lab.nombre_laboratorioensayo });
            } catch (e) {
                resultados.push({ archivo, ok: false, error: e.message });
            }
        }

        return res.json({ regenerados: resultados.filter(r => r.ok).length, resultados });
    } catch (error) {
        console.error("Error en generarCadenaCustodiaManual:", error);
        return res.status(500).json({ message: "Error al regenerar Cadena de Custodia", error: error.message });
    }
};
```

Nueva ruta:

```js
router.post("/interno/generar-cadena-custodia", protectInternalService, generarCadenaCustodiaManual);
```

### 5. Endpoint orquestador (`api-backend-adlone`)

Nuevas variables de entorno en `api-backend-adlone/.env`:

```
APP_MAM_API_URL=http://127.0.0.1:8001
INTERNAL_API_KEY=<mismo valor que en api-app-mam>
```

Nuevo método en `ficha.service.js`:

```js
async regenerarDocumentos(idAgendamam, { foma, cadena }) {
    const baseUrl = process.env.APP_MAM_API_URL;
    const headers = { 'x-internal-key': process.env.INTERNAL_API_KEY };
    const resultado = { foma: null, cadena: null };

    if (foma) {
        try {
            await axios.post(`${baseUrl}/ficha/interno/generar-foma`, { id_agendamam: idAgendamam }, { headers, timeout: 15000 });
            resultado.foma = { ok: true };
        } catch (e) {
            logger.warn('Error regenerando FoMa:', e.message);
            resultado.foma = { ok: false, error: e.response?.data?.message || e.message };
        }
    }

    if (cadena) {
        try {
            const { data } = await axios.post(`${baseUrl}/ficha/interno/generar-cadena-custodia`, { id_agendamam: idAgendamam }, { headers, timeout: 15000 });
            resultado.cadena = { ok: true, regenerados: data.regenerados };
        } catch (e) {
            logger.warn('Error regenerando Cadena de Custodia:', e.message);
            resultado.cadena = { ok: false, error: e.response?.data?.message || e.message };
        }
    }

    return resultado;
}
```

Nuevo controlador + ruta:

```js
// ficha.controller.js
async regenerarDocumentos(req, res) {
    const { id_agendamam, foma, cadena } = req.body;
    if (!id_agendamam) return errorResponse(res, 'id_agendamam requerido', 400);
    const result = await fichaService.regenerarDocumentos(id_agendamam, { foma: !!foma, cadena: !!cadena });
    return successResponse(res, result, 'Regeneración de documentos procesada');
}

// ficha.routes.js
router.post('/regenerar-documentos', authenticate, fichaController.regenerarDocumentos);
```

Este endpoint nunca lanza error 500 por fallos de documento individual — cada fallo queda reflejado en `resultado.foma.ok` / `resultado.cadena.ok` para que el frontend muestre un aviso específico, sin bloquear el flujo principal (el caso ADLab ya quedó guardado antes de llegar aquí).

### 6. Frontend (`FichaDetailView.tsx`)

En el modal "Confirmar ingreso en ADL Soft":

- Se agregan dos `Switch` (Mantine), debajo del input OI: **"Generar FoMa"** y **"Generar Cadena de Custodia"**, ambos con estado inicial `true`.
- `handleConfirmRealizado` queda así, en orden:
  1. `updateRealizadoGem(id_agendamam, true)`
  2. `updateCasoAdlab(id_agendamam, fullCode)` — el caso ADLab debe quedar persistido en BD ANTES del paso 3, porque la regeneración de PDF lee `caso_adlab` en vivo desde la base de datos.
  3. Si `generarFoma || generarCadena`: llamar a `fichaService.regenerarDocumentos(id_agendamam, { foma: generarFoma, cadena: generarCadena })`.
  4. Mostrar toast de éxito del caso ADLab (como ya ocurre hoy).
  5. Si el paso 3 devolvió algún `ok: false`, mostrar un toast adicional de advertencia (no de error) indicando qué documento no se pudo regenerar (ej. "Caso OI-123 guardado. No se pudo regenerar la Cadena de Custodia: <motivo>").
- Si los pasos 1-2 fallan, el comportamiento es igual al actual (no se intenta regenerar nada, se muestra el error existente).

Nuevo método en `frontend-adlone/src/features/medio-ambiente/services/ficha.service.ts`:

```ts
regenerarDocumentos: async (idAgendamam: number, opts: { foma: boolean; cadena: boolean }) => {
    const response = await apiClient.post(`/api/fichas/regenerar-documentos`, {
        id_agendamam: idAgendamam,
        foma: opts.foma,
        cadena: opts.cadena
    });
    return response.data?.data;
}
```

## Manejo de errores y casos límite

- **Ficha sin Cadena de Custodia previa** (aún no derivada a laboratorio): el endpoint de regeneración responde `{ regenerados: 0 }`, no es error. El frontend no muestra advertencia en ese caso (se distingue `regenerados: 0` sin `resultados` con `ok: false` de un fallo real).
- **api-app-mam no disponible** (timeout/red): se captura como `ok: false` con mensaje genérico; el caso ADLab queda guardado igual.
- **Equipos/firmas faltantes** para regenerar FoMa: el endpoint existente `generarFoMaManual` ya devuelve error 400 controlado; se propaga como `ok: false`.
- **No reintentos automáticos**: si falla, el usuario puede repetir la acción reabriendo el modal (los switches quedan disponibles) — no se agrega un botón "Reintentar" separado en este alcance.

## Testing

- Backend `api-app-mam`: tests unitarios para `generarCadenaCustodiaParaLab` (mock de `getVistaCadenaCustodia`, verificar que el PDF se genera con el lab correcto) y para `generarCadenaCustodiaManual` (mock de filesystem: detecta archivos existentes, resuelve laboratorio por nombre sanitizado, regenera cada uno).
- Backend `api-backend-adlone`: test de `regenerarDocumentos` con axios mockeado (éxito, fallo de uno solo, fallo de ambos, timeout).
- Templates PDF: test snapshot/regex verificando que con `caso_adlab` presente se imprime "ID CASO" y sin él se imprime "Folio" (igual patrón que `renderer.test.js` ya usado en este proyecto).
- Frontend: prueba manual en navegador — confirmar caso ADLab con ambos switches activos, con uno desactivado, y con ambos desactivados; verificar que la pestaña "Documentos" de `FichaDetailView.tsx` muestra el PDF regenerado con "ID CASO" tras recargar.
