@echo off
REM ---------------------------------------------------------------
REM Applies `adb reverse tcp:8000 tcp:8000` to EVERY connected device
REM so the phone's localhost:8000 tunnels to the PC's backend.
REM Runs automatically before each Flutter launch (see .vscode/tasks.json).
REM Re-run anytime a device disconnects/reconnects.
REM ---------------------------------------------------------------
setlocal enabledelayedexpansion

set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB%" set "ADB=%ANDROID_HOME%\platform-tools\adb.exe"
if not exist "%ADB%" set "ADB=adb"

echo Applying adb reverse to all connected devices...
for /f "skip=1 tokens=1,2" %%a in ('"%ADB%" devices') do (
  if "%%b"=="device" (
    "%ADB%" -s %%a reverse tcp:8000 tcp:8000 >nul 2>&1
    echo   [OK] %%a  localhost:8000 -^> PC:8000
  )
)
echo Done.
exit /b 0
