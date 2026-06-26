@echo off
setlocal EnableDelayedExpansion

REM Always run from the web folder this script lives in.
cd /d "%~dp0"

for %%I in ("%~dp0.cache") do set "WEB_CACHE_ROOT=%%~fI"

REM Keep npm cache and temp files inside the project folder.
set "npm_config_cache=%WEB_CACHE_ROOT%\npm"
set "TMP=%WEB_CACHE_ROOT%\tmp"
set "TEMP=%WEB_CACHE_ROOT%\tmp"

if not exist "%npm_config_cache%" mkdir "%npm_config_cache%"
if not exist "%TMP%" mkdir "%TMP%"

set "PAUSE_AFTER=1"
set "FORWARD_ARGS="

:parse_args
if "%~1"=="" goto args_done
if /I "%~1"=="--no-pause" (
    set "PAUSE_AFTER="
) else (
    set "FORWARD_ARGS=!FORWARD_ARGS! %~1"
)
shift
goto parse_args

:args_done

where npm.cmd >nul 2>nul
if errorlevel 1 (
    echo npm was not found.
    echo Install Node.js first, then run this script again.
    echo.
    if defined PAUSE_AFTER pause
    exit /b 1
)

if not exist "node_modules" (
    echo Frontend dependencies were not found.
    echo Run setup_web.bat first.
    echo.
    if defined PAUSE_AFTER pause
    exit /b 1
)

if exist "node_modules\.vite" (
    echo Clearing stale Vite optimize cache...
    rmdir /s /q "node_modules\.vite" 2>nul
)

echo Starting web app on http://127.0.0.1:5173
echo.
call npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort --force %FORWARD_ARGS%
set "APP_EXIT=%ERRORLEVEL%"

echo.
if not "%APP_EXIT%"=="0" (
    echo Web app stopped with an error. See the message above.
) else (
    echo Web app stopped.
)

if defined PAUSE_AFTER pause

endlocal
