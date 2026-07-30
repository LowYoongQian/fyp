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

REM Show pip's download progress bars even though this runs in a plain console.
set "PIP_PROGRESS_BAR=on"
set "PYTHONUTF8=1"

set "PYTHON=%~dp0.venv\Scripts\python.exe"

echo ============================================================
echo   FYP backend setup
echo ============================================================
echo.

REM ---------------------------------------------------------------
REM [1/5] Locate a Python 3.11 interpreter.
REM tensorflow-intel 2.14.0 (what deepface/ArcFace needs) only ships
REM cp39/cp310/cp311 wheels - there is NO cp312 build. On 3.12+ the
REM install fails outright, and TF 2.16+ would drag in numpy 2.x,
REM which breaks the deepface import. 3.11 is not a preference here.
REM ---------------------------------------------------------------
echo [1/5] Locating Python 3.11...

if exist "%PYTHON%" (
    for /f "usebackq delims=" %%V in (`"%PYTHON%" -c "import sys;print('%%d.%%d.%%d'%%sys.version_info[:3])" 2^>nul`) do set "VENV_PY_VER=%%V"
    echo       Reusing existing venv: !VENV_PY_VER!
    echo       %PYTHON%
    if "!VENV_PY_VER:~0,5!" NEQ "3.11." (
        echo.
        echo       WARNING: existing venv is !VENV_PY_VER!, not 3.11.
        echo       deepface / tensorflow 2.14 will not install on it.
        echo       Delete .venv and run this script again.
        echo.
        if /I not "%~1"=="--no-pause" pause
        exit /b 1
    )
    goto ensure_pip
)

set "PY311_EXE="

REM Preferred: the launcher's own 3.11 registration.
where py >nul 2>nul
if not errorlevel 1 (
    for /f "usebackq delims=" %%P in (`py -3.11 -c "import sys;print(sys.executable)" 2^>nul`) do set "PY311_EXE=%%P"
)

REM Fallback: scan every interpreter the launcher knows about for a 3.11.
if not defined PY311_EXE (
    for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$lines = py -0p 2^> $null; foreach ($line in $lines) { if ($line -match '3\.11' -and $line -match '([A-Z]:\\.*python\.exe)$' -and (Test-Path $Matches[1])) { $Matches[1]; break } }"`) do set "PY311_EXE=%%P"
)

REM Last resort: a bare `python` on PATH, but ONLY if it really is 3.11.
REM The old version fell through to `python -m venv` unconditionally, which
REM happily built a 3.12/3.14 venv that then could not install tensorflow.
if not defined PY311_EXE (
    for /f "usebackq delims=" %%V in (`python -c "import sys;print('%%d.%%d'%%sys.version_info[:2])" 2^>nul`) do (
        if "%%V"=="3.11" (
            for /f "usebackq delims=" %%P in (`python -c "import sys;print(sys.executable)" 2^>nul`) do set "PY311_EXE=%%P"
        )
    )
)

if not defined PY311_EXE (
    echo       FAILED: no Python 3.11 found.
    echo.
    echo       This project requires Python 3.11 specifically.
    echo       tensorflow 2.14 ^(needed by deepface/ArcFace^) has no
    echo       Windows wheels for 3.12 or newer.
    echo.
    echo       Install Python 3.11, then make sure this works:
    echo         py -3.11 --version
    echo.
    if /I not "%~1"=="--no-pause" pause
    exit /b 1
)

echo       Found: !PY311_EXE!
echo.

echo [2/5] Creating virtual environment ^(.venv^)...
"!PY311_EXE!" -m venv .venv
if errorlevel 1 (
    echo       FAILED to create .venv
    if /I not "%~1"=="--no-pause" pause
    exit /b 1
)
echo       Done.
echo.
goto ensure_pip

:ensure_pip
echo.
echo [3/5] Checking pip...
"%PYTHON%" -m pip --version >nul 2>nul
if errorlevel 1 (
    echo       pip missing from venv - restoring with ensurepip...
    "%PYTHON%" -m ensurepip --upgrade
    if errorlevel 1 (
        echo       FAILED to restore pip.
        if /I not "%~1"=="--no-pause" pause
        exit /b 1
    )
)
"%PYTHON%" -m pip install --upgrade pip
if errorlevel 1 (
    echo       FAILED while upgrading pip.
    if /I not "%~1"=="--no-pause" pause
    exit /b 1
)
echo.

echo [4/5] Installing requirements...
echo       ~130 packages, tensorflow alone is about 300 MB.
echo       First run on an empty cache takes a while - progress bars below.
echo.
"%PYTHON%" -m pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo       FAILED while installing requirements.
    if /I not "%~1"=="--no-pause" pause
    exit /b 1
)
echo.

REM ---------------------------------------------------------------
REM [5/5] Prove the install actually works. "pip install succeeded"
REM is not the same as "the app imports" - deepface silently falls
REM back to mock embeddings if tensorflow/numpy are mismatched.
REM ---------------------------------------------------------------
echo [5/5] Verifying install...

set "VERIFY_FAILED="

"%PYTHON%" -m pip check
if errorlevel 1 set "VERIFY_FAILED=1"

"%PYTHON%" -c "import numpy, tensorflow, sklearn; print('      numpy', numpy.__version__, '/ tensorflow', tensorflow.__version__, '/ sklearn', sklearn.__version__)"
if errorlevel 1 (
    echo       FAILED: core ML imports are broken.
    set "VERIFY_FAILED=1"
)

"%PYTHON%" -c "from deepface import DeepFace; print('      deepface import OK')"
if errorlevel 1 (
    echo       WARNING: deepface did not import - face recognition will run
    echo                in MOCK mode ^(no real matching^).
    set "VERIFY_FAILED=1"
)

REM ArcFace weights live outside the venv and are NOT downloaded by pip.
REM Auto-download has failed on this network before, so check explicitly:
REM without this file deepface degrades to mock embeddings at runtime.
if exist "%USERPROFILE%\.deepface\weights\arcface_weights.h5" (
    echo       ArcFace weights present.
) else (
    echo.
    echo       WARNING: ArcFace weights NOT found at
    echo         %USERPROFILE%\.deepface\weights\arcface_weights.h5
    echo       deepface tries to download them on first use; if that fails,
    echo       fetch the 137 MB file manually from:
    echo         github.com/serengil/deepface_models/releases/download/v1.0/
    echo.
    set "VERIFY_FAILED=1"
)

echo.
echo ============================================================
if defined VERIFY_FAILED (
    echo   Setup finished WITH WARNINGS - see above.
) else (
    echo   Backend environment is ready.
)
echo ============================================================
echo.
echo   Next: make sure .env has DATABASE_URL, then run
echo     run_backend.bat
echo.
if /I not "%~1"=="--no-pause" pause

endlocal
