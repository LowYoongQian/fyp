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

if exist "%PYTHON%" (
    echo Reusing existing backend venv:
    echo   %PYTHON%
) else (
    set "VENV_CREATED="

    where py >nul 2>nul
    if not errorlevel 1 (
        py -3.11 -m venv .venv
        if not errorlevel 1 set "VENV_CREATED=1"
    )

    if not defined VENV_CREATED (
        set "PY311_EXE="
        for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$lines = py -0p 2^> $null; foreach ($line in $lines) { if ($line -match '3\.11' -and $line -match '([A-Z]:\\.*python\.exe)$' -and (Test-Path $Matches[1])) { $Matches[1]; break } }"`) do set "PY311_EXE=%%P"

        if defined PY311_EXE (
            "!PY311_EXE!" -m venv .venv
            if not errorlevel 1 set "VENV_CREATED=1"
        )
    )

    if not defined VENV_CREATED (
        python -m venv .venv
        if not errorlevel 1 set "VENV_CREATED=1"
    )

    if not defined VENV_CREATED (
        echo Failed to create backend venv.
        echo Install Python 3.11 and make sure either:
        echo   py -3.11
        echo or
        echo   python
        echo works in terminal.
        echo.
        if /I not "%~1"=="--no-pause" pause
        exit /b 1
    )
)

"%PYTHON%" -m pip install --upgrade pip
if errorlevel 1 (
    echo.
    echo Backend setup failed while upgrading pip.
    if /I not "%~1"=="--no-pause" pause
    exit /b 1
)

"%PYTHON%" -m pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo Backend setup failed while installing requirements.
    if /I not "%~1"=="--no-pause" pause
    exit /b 1
)

echo.
echo Backend environment is ready.
echo Start it with:
echo   run_backend.bat
echo.
if /I not "%~1"=="--no-pause" pause

endlocal
