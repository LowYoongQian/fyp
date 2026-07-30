@echo off
setlocal EnableDelayedExpansion

REM Always run from the backend folder this script lives in.
cd /d "%~dp0"

for %%I in ("%~dp0.cache") do set "BACKEND_CACHE_ROOT=%%~fI"

REM Keep all caches/config inside the backend folder so it stays self-contained.
set "PIP_CACHE_DIR=%BACKEND_CACHE_ROOT%\pip"
set "ULTRALYTICS_CONFIG_DIR=%BACKEND_CACHE_ROOT%\ultralytics"
set "MPLCONFIGDIR=%BACKEND_CACHE_ROOT%\matplotlib"
set "TORCH_HOME=%BACKEND_CACHE_ROOT%\torch"
set "HF_HOME=%BACKEND_CACHE_ROOT%\huggingface"
set "TMP=%BACKEND_CACHE_ROOT%\tmp"
set "TEMP=%BACKEND_CACHE_ROOT%\tmp"

if not exist "%PIP_CACHE_DIR%" mkdir "%PIP_CACHE_DIR%"
if not exist "%ULTRALYTICS_CONFIG_DIR%" mkdir "%ULTRALYTICS_CONFIG_DIR%"
if not exist "%MPLCONFIGDIR%" mkdir "%MPLCONFIGDIR%"
if not exist "%TORCH_HOME%" mkdir "%TORCH_HOME%"
if not exist "%HF_HOME%" mkdir "%HF_HOME%"
if not exist "%TMP%" mkdir "%TMP%"

set "PYTHON=%~dp0.venv\Scripts\python.exe"
set "PAUSE_AFTER=1"
set "RELOAD=--reload"

:parse_args
if "%~1"=="" goto args_done
if /I "%~1"=="--no-pause" (
    set "PAUSE_AFTER="
) else if /I "%~1"=="--no-reload" (
    set "RELOAD="
) else if /I "%~1"=="--reload" (
    set "RELOAD=--reload"
) else (
    echo Unknown option: %~1
    echo Usage: run_backend.bat [--no-reload] [--no-pause]
    exit /b 1
)
shift
goto parse_args

:args_done

if not exist "%PYTHON%" (
    echo Backend venv not found:
    echo   %PYTHON%
    echo.
    echo Create it first with:
    echo   setup_backend.bat
    echo.
    if defined PAUSE_AFTER pause
    exit /b 1
)

REM Port is defined once, in .env (see .env.example). stop_backend.bat reads the
REM same key, so changing it there is enough.
set "BACKEND_PORT="
if exist ".env" (
    for /f "usebackq tokens=1,* delims==" %%K in (".env") do (
        if /I "%%K"=="BACKEND_PORT" set "BACKEND_PORT=%%L"
    )
)
if not defined BACKEND_PORT set "BACKEND_PORT=8003"
set "BACKEND_PORT=!BACKEND_PORT: =!"

REM Schema is owned by Alembic. Procfile/Dockerfile run this before uvicorn; do the
REM same locally so the app never starts against an un-migrated database.
"%PYTHON%" -m alembic upgrade head
if errorlevel 1 (
    echo.
    echo Database migration failed. Backend not started.
    if defined PAUSE_AFTER pause
    exit /b 1
)

echo.
echo Starting backend on http://127.0.0.1:!BACKEND_PORT!
if defined RELOAD (echo Reload mode enabled.) else (echo Reload mode disabled.)
echo Press Ctrl+C to stop. If the port stays busy afterwards, run stop_backend.bat.
echo.

REM Use the project interpreter directly so PATH cannot hijack it.
"%PYTHON%" -m uvicorn main:app --host 0.0.0.0 --port !BACKEND_PORT! %RELOAD%
set "APP_EXIT=%ERRORLEVEL%"

echo.
if not "%APP_EXIT%"=="0" (
    echo Backend stopped with an error. See the message above.
) else (
    echo Backend stopped.
)

if defined PAUSE_AFTER pause

endlocal
