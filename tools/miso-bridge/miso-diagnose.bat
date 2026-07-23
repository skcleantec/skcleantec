@echo off
setlocal EnableDelayedExpansion
set "ADB=%LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB%" (
  echo ERROR: adb.exe not found.
  pause
  exit /b 1
)

"%ADB%" devices 2>nul | findstr /R /C:"emulator-[0-9][0-9]* device" >nul
if errorlevel 1 (
  echo ERROR: No online emulator. Run run-emulator.bat first.
  "%ADB%" devices
  pause
  exit /b 1
)

echo === Miso diagnose ===
echo.

echo [1] Page size (16384 = 16KB AVD, often breaks apps):
for /f "delims=" %%P in ('"%ADB%" shell getconf PAGE_SIZE 2^>nul') do echo     PAGE_SIZE=%%P
echo     If 16384: create API 34 Google Play AVD WITHOUT 16KB page size.
echo.

echo [2] Miso package:
"%ADB%" shell pm list packages | findstr /i miso
echo.

echo [3] Miso version:
"%ADB%" shell dumpsys package com.miso.cleaner 2>nul | findstr /I "versionName versionCode"
echo.

echo [4] Foreground app:
"%ADB%" shell dumpsys window 2>nul | findstr /I "mCurrentFocus"
echo.

echo [5] Recent crash / ANR (last 80 lines filtered):
"%ADB%" logcat -d -t 300 2>nul | findstr /I "miso FATAL AndroidRuntime ANR crash" | more +0
echo.

echo [6] Force-stop and relaunch Miso Partner...
"%ADB%" shell am force-stop com.miso.cleaner
timeout /t 2 /nobreak >nul
"%ADB%" shell monkey -p com.miso.cleaner -c android.intent.category.LAUNCHER 1 >nul 2>&1
echo     Relaunched. Wait 30-60s on first screen.
echo.
pause
endlocal
