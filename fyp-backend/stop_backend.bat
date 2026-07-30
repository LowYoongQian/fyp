@echo off
setlocal EnableDelayedExpansion

cd /d "%~dp0"

REM Port is defined once, in .env (see .env.example). run_backend.bat reads the
REM same key; these two used to hardcode it separately and drifted apart.
set "TARGET_PORT="
if exist ".env" (
    for /f "usebackq tokens=1,* delims==" %%K in (".env") do (
        if /I "%%K"=="BACKEND_PORT" set "TARGET_PORT=%%L"
    )
)
if not defined TARGET_PORT set "TARGET_PORT=8003"
REM Strip stray spaces picked up from the .env line.
set "TARGET_PORT=!TARGET_PORT: =!"

set "PAUSE_AFTER=1"
set "FOUND="

if /I "%~1"=="--no-pause" set "PAUSE_AFTER="

for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$portPids = Get-NetTCPConnection -LocalPort !TARGET_PORT! -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($portPid in $portPids) { $portPid }"`) do (
    REM Only kill our own backend. A Windows service can also be listening on
    REM this port (iphlpsvc binds 127.0.0.1:8000 on this machine), and blindly
    REM taskkill-ing an svchost process tree would take down system services.
    set "PROC_NAME="
    for /f "usebackq delims=" %%N in (`powershell -NoProfile -Command "(Get-Process -Id %%P -ErrorAction SilentlyContinue).ProcessName"`) do set "PROC_NAME=%%N"

    if /I "!PROC_NAME!"=="python" (
        echo Stopping backend process tree on port !TARGET_PORT! ^(PID %%P, !PROC_NAME!^)^...
        taskkill /PID %%P /T /F
        set "FOUND=1"
    ) else (
        echo Skipping PID %%P on port !TARGET_PORT!: process is "!PROC_NAME!", not the backend.
    )
)

echo.
if defined FOUND (
    echo Backend on port !TARGET_PORT! has been stopped.
) else (
    echo No listening backend found on port !TARGET_PORT!.
)

if defined PAUSE_AFTER pause

endlocal
