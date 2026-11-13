#!/bin/bash
# Uso: corrida.sh <etiqueta>   (la configuracion de indices ya debe estar creada)
S="C:/Users/VREMOL~1/AppData/Local/Temp/claude/0e3f9cd0bc6e6277/faf79ec4-9168-489b-a662-8a8ce5cb74f9/scratchpad"
cd "$S" && node snap2.cjs 'adl.1542pm' 2>&1 | grep -v "DEP0\|trace-dep" | tail -1
cd "C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone" && SALIDA="$S/indices-$1.json" timeout 500 node "$S/indices-medicion.mjs" "$1" 2>&1 | grep -v "DEP0\|trace-dep\|service\":\"adl\|\[info\]\|\[warn\]" | cut -c1-340
cd "$S" && node restaurar2.cjs 'adl.1542pm' 2>&1 | grep -v "DEP0\|trace-dep" | tr '\n' ' '; node dropsnap2.cjs 'adl.1542pm' 2>&1 | grep -v "DEP0\|trace-dep" | tail -1
