@echo off
setlocal
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB%" (
  echo ERROR: adb.exe not found.
  pause
  exit /b 1
)

"%ADB%" devices 2>nul | findstr /R /C:"emulator-[0-9][0-9]* device" >nul
if errorlevel 1 (
  echo No online emulator. Run run-emulator.bat and wait 2-3 min first.
  "%ADB%" devices
  pause
  exit /b 1
)

echo Waking screen...
"%ADB%" shell input keyevent 26
"%ADB%" shell input keyevent 82
"%ADB%" shell wm dismiss-keyguard
echo Done. If still black, click POWER on the emulator side bar.
pause
endlocal
