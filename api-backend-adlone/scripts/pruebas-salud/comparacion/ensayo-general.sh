#!/bin/bash
# ENSAYO GENERAL del procedimiento del lunes, con facturas YA emitidas por ADLSOFT (solo copia local, con instantánea que se restaura al final).
# Uso: ensayo-general.sh "<pwd sa local>" <desde> <desdeB> "<grupos>" "<ids a comparar, separados por coma>"
#   ej.: ensayo-general.sh 'pwd' 74890 74908 "74891 74898 74900+74902+74904+74906" 74891,74898,74900,74902,74904,74906
# Pasos: instantánea -> cargar las facturas de ADLSOFT (producción, solo lectura) -> eliminar y rehacer en ADL ONE con los mismos parámetros -> comparar -> restaurar.
PWD_LOCAL="$1"; DESDE="$2"; DESDEB="$3"; GRUPOS="$4"; IDS="$5"
R="C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone"; P="$R/scripts/pruebas-salud"
S="C:/Users/VREMOL~1/AppData/Local/Temp/claude/0e3f9cd0bc6e6277/faf79ec4-9168-489b-a662-8a8ce5cb74f9/scratchpad"
FILTRO="DEP0\|trace-dep\|service\":\"adl"
echo "== 1. instantánea"; (cd "$S" && node snap2.cjs "$PWD_LOCAL" 2>&1 | grep -v "$FILTRO" | tail -1)
echo "== 2. cargar facturas de ADLSOFT (producción, solo lectura)"; (cd "$P/comparacion" && node cargar-facturas-adlsoft.cjs "$PWD_LOCAL" --desde=$DESDE 2>&1 | grep -v "$FILTRO" | tail -2)
echo "== 3. rehacer en ADL ONE (copia local)"; (cd "$R" && REPLAY_MANUAL=1 SALIDA="$S" node "$P/valorizacion/valorizacion-prueba.mjs" $GRUPOS 2>&1 | grep -v "$FILTRO" | grep -E "\"(error|iguales|de|creadas|lineas_iguales)\"|errores" | tr -s ' ' | tr '\n' ' '; echo)
echo "== 4. comparar"; (cd "$P/comparacion" && node comparar-facturas.cjs "$PWD_LOCAL" --desde=$DESDE --desdeB=$DESDEB --ids=$IDS --esperadas=factura,emitido,fecha_proceso_ini,fecha_proceso_fin,valorizado --salida="$S/informe-ensayo.md" 2>&1 | grep -v "$FILTRO" | head -${LINEAS:-40} | cut -c1-240)
echo "== 5. restaurar"; (cd "$S" && node restaurar2.cjs "$PWD_LOCAL" 2>&1 | grep -v "$FILTRO" | tr '\n' ' '; node dropsnap2.cjs "$PWD_LOCAL" 2>&1 | grep -v "$FILTRO" | tail -1)
