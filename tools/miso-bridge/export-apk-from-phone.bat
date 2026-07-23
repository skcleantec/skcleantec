@echo off
setlocal
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
set "OUT=%~dp0apk\miso-partner-from-phone.apk"

if not exist "%ADB%" (
  echo ERROR: adb.exe not found.
  pause
  exit /b 1
)

echo Connect partner phone: USB debugging ON, allow this PC.
"%ADB%" devices
echo.

for /f "tokens=2 delims=:" %%P in ('"%ADB%" shell pm path com.miso.cleaner 2^>nul ^| findstr base.apk') do set "PKGPATH=%%P"
set "PKGPATH=%PKGPATH: =%"

if "%PKGPATH%"=="" (
  echo com.miso.cleaner not found on phone.
  echo Install Miso Partner from Play Store on the phone first.
  pause
  exit /b 1
)

if not exist "%~dp0apk" mkdir "%~dp0apk"
echo Pulling %PKGPATH%
"%ADB%" pull "%PKGPATH%" "%OUT%"
if errorlevel 1 (
  echo Pull failed.
  pause
  exit /b 1
)

echo Saved: %OUT%
echo Run install-miso-apk.bat to install on emulator.
pause
endlocal
