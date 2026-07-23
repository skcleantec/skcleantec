@echo off
setlocal EnableDelayedExpansion
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
set "APKDIR=%~dp0apk"

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

set "APKFILE="
if not "%~1"=="" (
  set "APKFILE=%~1"
  goto DoInstall
)

set /a CNT=0
for %%F in ("%APKDIR%\*.apk") do (
  set "APKFILE=%%~fF"
  set /a CNT+=1
)

if !CNT! EQU 0 (
  echo No APK in %APKDIR%
  echo Put miso-partner.apk there, or: install-miso-apk.bat C:\path\to\file.apk
  pause
  exit /b 1
)
if !CNT! GTR 1 (
  echo Multiple APK files. Pick one:
  dir /b "%APKDIR%\*.apk"
  echo install-miso-apk.bat C:\full\path\to\file.apk
  pause
  exit /b 1
)

:DoInstall
if not exist "%APKFILE%" (
  echo ERROR: File not found: %APKFILE%
  pause
  exit /b 1
)

echo Installing: %APKFILE%
"%ADB%" install -r "%APKFILE%"
if errorlevel 1 (
  echo.
  echo Install failed. Try Google Play AVD or export-apk-from-phone.bat
  echo Or: adb uninstall com.miso.cleaner
  pause
  exit /b 1
)

echo OK. Open Miso Partner on emulator.
"%ADB%" shell pm list packages | findstr /i miso
pause
exit /b 0
