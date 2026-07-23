@echo off
setlocal
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB%" (
  echo ERROR: adb.exe not found.
  pause
  exit /b 1
)

echo Checking adb...
"%ADB%" devices
echo.
echo If status is offline: close emulator, run run-emulator.bat, wait for home screen.
pause
endlocal
