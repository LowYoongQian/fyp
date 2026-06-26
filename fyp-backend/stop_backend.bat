@echo off
setlocal

cd /d "%~dp0"

set "TARGET_PORT=8003"
set "PAUSE_AFTER=1"
set "FOUND="

if /I "%~1"=="--no-pause" set "PAUSE_AFTER="

for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$portPids = Get-NetTCPConnection -LocalPort %TARGET_PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($portPid in $portPids) { $portPid }"`) do (
    echo Stopping backend process tree on port %TARGET_PORT% ^(PID %%P^)^...
    taskkill /PID %%P /T /F
    set "FOUND=1"
)

echo.
if defined FOUND (
    echo Backend on port %TARGET_PORT% has been stopped.
) else (
    echo No listening backend found on port %TARGET_PORT%.
)

if defined PAUSE_AFTER pause

endlocal
