#!/bin/bash
# ENSAYO de reproducir-corrida.mjs con facturas YA emitidas: instantánea -> eliminar esas facturas en la copia (quedan pendientes, como el lunes)
# -> reproducir con los parámetros de ADLSOFT -> comparar -> restaurar. Requiere haber cargado antes las facturas (cargar-facturas-adlsoft.cjs).
# Uso: ensayo-reproducir.sh "<pwd sa local>" <desde> "<ids a eliminar y reproducir, con coma>"
PWD_LOCAL="$1"; DESDE="$2"; IDS="$3"
R="C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone"; C="$R/scripts/pruebas-salud/comparacion"
S="C:/Users/VREMOL~1/AppData/Local/Temp/claude/0e3f9cd0bc6e6277/faf79ec4-9168-489b-a662-8a8ce5cb74f9/scratchpad"
F="DEP0\|trace-dep\|service\":\"adl"
echo "== instantánea"; (cd "$S" && node snap2.cjs "$PWD_LOCAL" 2>&1 | grep -v "$F" | tail -1)
echo "== dejar pendientes los casos (eliminar las facturas en la copia)"
cat > "$S/eliminar-ids.mjs" <<'EOF'
process.chdir('C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone');
const b = 'file:///C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone/src/';
const db0 = await import(b + 'config/databaseSalud.js'); const { facturacionSaludService: s } = await import(b + 'services/facturacion-salud.service.js');
const pool = await db0.getConnectionSalud();
if (!/ADLLOCAL/i.test((await pool.request().query('SELECT @@SERVERNAME s')).recordset[0].s)) process.exit(2);
const max = (await pool.request().query('SELECT MAX(id_facturacion) m FROM facturacion_enc')).recordset[0].m;
for (const id of process.argv.slice(2)) await s.eliminarPrefacturaSalud(Number(id));
console.log('eliminadas', process.argv.length - 2, '| mayor id antes de reproducir:', max);
await db0.closeConnectionSalud(); process.exit(0);
EOF
(cd "$R" && node "$S/eliminar-ids.mjs" ${IDS//,/ } 2>&1 | grep -v "$F")
echo "== reproducir"; (cd "$C" && node reproducir-corrida.mjs "$PWD_LOCAL" --desde=$DESDE --solo=$IDS --manuales-auto --ejecutar --salida="$S/reproduccion.json" 2>&1 | grep -v "$F")
echo "== comparar"; (cd "$C" && node comparar-facturas.cjs "$PWD_LOCAL" --desde=$DESDE --desdeB=${DESDEB:-74908} --ids=$IDS --esperadas=factura,emitido,valorizado --salida="$S/informe-reproducir.md" 2>&1 | grep -v "$F" | head -${LINEAS:-45} | cut -c1-230)
echo "== restaurar"; (cd "$S" && node restaurar2.cjs "$PWD_LOCAL" 2>&1 | grep -v "$F" | tr '\n' ' '; node dropsnap2.cjs "$PWD_LOCAL" 2>&1 | grep -v "$F" | tail -1)
