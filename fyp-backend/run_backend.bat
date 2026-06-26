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

REM Use the project interpreter directly so PATH cannot hijack the launcher.
"%PYTHON%" "%~dp0launch_backend.py" %FORWARD_ARGS%
set "APP_EXIT=%ERRORLEVEL%"

echo.
if not "%APP_EXIT%"=="0" (
    echo Backend stopped with an error. See the message above.
) else (
    echo Backend stopped.
)

if defined PAUSE_AFTER pause

endlocal
