@echo off
setlocal
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB%" (
  echo ERROR: adb.exe not found.
  pause
  exit /b 1
)
"%ADB%" wait-for-device
"%ADB%" shell am start -a android.settings.SETTINGS
endlocal
