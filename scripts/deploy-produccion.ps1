# Despliegue de ADL ONE a produccion. Se ejecuta EN EL SERVIDOR (192.168.10.28), desde cualquier carpeta:
#   .\scripts\deploy-produccion.ps1                 -> trae el codigo, instala, compila y reinicia backend y frontend
#   .\scripts\deploy-produccion.ps1 -SoloBackend    -> solo backend
#   .\scripts\deploy-produccion.ps1 -SoloFrontend   -> solo frontend
#   .\scripts\deploy-produccion.ps1 -Forzar         -> vuelve a desplegar aunque no haya commits nuevos
#
# Reglas que salen de los incidentes del 2026-10-24 en este servidor (comparte PM2 con otras apps):
#  - Solo toca adl-one-backend y adl-one-frontend, por NOMBRE. Nunca "pm2 restart all" ni "--update-env".
#  - No usa "pm2 restart": un reinicio simple puede dejar un proceso suelto ocupando el puerto (EADDRINUSE).
#    Se hace stop -> liberar el puerto -> start, y luego se verifica que responda.
#  - El frontend se compila en una carpeta aparte (dist-nuevo) y recien despues se cambia por dist: el sitio no se queda
#    sin archivos durante la compilacion y si la compilacion falla no se toca nada. La version anterior queda en dist-anterior.
#
# No toca la base de datos: si el despliegue trae archivos nuevos en migraciones, los avisa y se aplican a mano.
# Archivo en ASCII a proposito: PowerShell 5.1 lee como ANSI los .ps1 sin BOM y un caracter especial rompe las cadenas.
param([switch]$SoloBackend, [switch]$SoloFrontend, [switch]$Forzar)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$APP_BACKEND = 'adl-one-backend'
$APP_FRONTEND = 'adl-one-frontend'
$PUERTO_BACKEND = 8002
$PUERTO_FRONTEND = 5174
$hacerBackend = -not $SoloFrontend
$hacerFrontend = -not $SoloBackend

function Paso($texto) { Write-Host "`n== $texto" -ForegroundColor Cyan }
function Ejecutar([string]$exe, [string[]]$argumentos) {
    & $exe @argumentos
    if ($LASTEXITCODE -ne 0) { throw "Fallo: $exe $($argumentos -join ' ') (codigo $LASTEXITCODE)" }
}
# Cualquier respuesta HTTP (incluso 401 o 404) significa que el proceso esta vivo; solo "sin conexion" es falla.
function EstaVivo([string]$url) {
    try { Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 | Out-Null; return $true }
    catch { return [bool]$_.Exception.Response }
}
function EsperarVivo([string]$nombre, [string]$url) {
    for ($i = 0; $i -lt 30; $i++) {
        if (EstaVivo $url) { Write-Host "   $nombre responde ($url)" -ForegroundColor Green; return }
        Start-Sleep -Seconds 2
    }
    throw "$nombre no responde en $url tras 60 s. Revisa: pm2 logs $nombre --lines 40 --nostream"
}
# Detiene la app en PM2, cierra lo que quede escuchando en su puerto (procesos sueltos) y la vuelve a arrancar.
function ReiniciarSeguro([string]$app, [int]$puerto, [string]$url) {
    Ejecutar 'pm2' @('stop', $app)
    Start-Sleep -Seconds 4
    Get-NetTCPConnection -LocalPort $puerto -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "   Cerrando proceso suelto en el puerto $puerto (PID $($_.OwningProcess))" -ForegroundColor Yellow
        Stop-Process -Id $_.OwningProcess -Force
    }
    Start-Sleep -Seconds 2
    Ejecutar 'pm2' @('start', $app)
    EsperarVivo $app $url
}

Set-Location $raiz

Paso 'Codigo'
$modificados = git status --porcelain --untracked-files=no
if ($modificados -and -not $Forzar) { throw "Hay cambios locales en el servidor (no deberian existir):`n$modificados`nRevisalos antes de desplegar." }
$antes = (git rev-parse --short HEAD).Trim()
Ejecutar 'git' @('fetch', 'origin')
Ejecutar 'git' @('pull', '--ff-only')
$despues = (git rev-parse --short HEAD).Trim()
# Sin commits nuevos igual se reinicia: un cambio solo en el .env no trae commits y necesita reinicio.
$soloReinicio = ($antes -eq $despues -and -not $Forzar)
if ($soloReinicio) { Write-Host "   Sin commits nuevos ($despues): no se instala ni se compila, solo se reinicia." }
else { Write-Host "   $antes -> $despues"; git log --oneline "$antes..$despues" }

$migraciones = if ($soloReinicio) { $null } else { git diff --name-only $antes $despues -- api-backend-adlone/migrations db-migrations }
if ($migraciones) {
    Write-Host "`nATENCION: este despliegue trae archivos de migracion. Aplicalos a mano en la base antes de usar la funcion nueva:" -ForegroundColor Yellow
    $migraciones | ForEach-Object { Write-Host "   $_" -ForegroundColor Yellow }
}

if ($hacerBackend -and -not $soloReinicio) {
    Paso 'Backend: dependencias'
    Set-Location (Join-Path $raiz 'api-backend-adlone')
    Ejecutar 'npm' @('install', '--no-audit', '--no-fund')
}

$huboNuevoDist = $false
if ($hacerFrontend -and -not $soloReinicio) {
    Paso 'Frontend: dependencias y compilacion (1-3 min; el sitio sigue sirviendo la version anterior)'
    $front = Join-Path $raiz 'frontend-adlone'
    Set-Location $front
    Ejecutar 'npm' @('install', '--no-audit', '--no-fund')
    if (Test-Path 'dist-nuevo') { Remove-Item 'dist-nuevo' -Recurse -Force }
    Ejecutar 'npm' @('run', 'build', '--', '--outDir', 'dist-nuevo')
    if (-not (Test-Path 'dist-nuevo\index.html')) { throw 'La compilacion no genero dist-nuevo\index.html. No se cambio nada.' }
    $huboNuevoDist = $true
}

if ($hacerBackend) {
    Paso 'Reinicio del backend'
    ReiniciarSeguro $APP_BACKEND $PUERTO_BACKEND "http://localhost:$PUERTO_BACKEND/"
}

if ($hacerFrontend) {
    Paso 'Reinicio del frontend'
    if ($huboNuevoDist) {
        # El cambio de carpeta se hace con el servidor detenido, para que no tenga archivos abiertos.
        Ejecutar 'pm2' @('stop', $APP_FRONTEND)
        Start-Sleep -Seconds 4
        Get-NetTCPConnection -LocalPort $PUERTO_FRONTEND -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
        Start-Sleep -Seconds 2
        $dist = Join-Path $raiz 'frontend-adlone\dist'
        $anterior = Join-Path $raiz 'frontend-adlone\dist-anterior'
        $nuevo = Join-Path $raiz 'frontend-adlone\dist-nuevo'
        if (Test-Path $anterior) { Remove-Item $anterior -Recurse -Force }
        if (Test-Path $dist) { Rename-Item $dist 'dist-anterior' }
        Rename-Item $nuevo 'dist'
        Ejecutar 'pm2' @('start', $APP_FRONTEND)
        EsperarVivo $APP_FRONTEND "http://localhost:$PUERTO_FRONTEND/"
    } else {
        ReiniciarSeguro $APP_FRONTEND $PUERTO_FRONTEND "http://localhost:$PUERTO_FRONTEND/"
    }
}

Write-Host "`nListo: $antes -> $despues" -ForegroundColor Green
Write-Host "Para volver atras:  git reset --hard $antes ; .\scripts\deploy-produccion.ps1 -Forzar"
if ($huboNuevoDist) { Write-Host "(la version anterior del frontend quedo en frontend-adlone\dist-anterior)" }
