@echo off
setlocal
call "%~dp0avd-config.bat"
set "EMU=%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe"

if not exist "%EMU%" (
  echo ERROR: emulator.exe not found.
  pause
  exit /b 1
)

echo AVD: %MISO_AVD% (cold boot)
start "Miso %MISO_AVD%" "%EMU%" -avd %MISO_AVD% -gpu swiftshader_indirect -no-boot-anim -no-audio -no-snapshot-load -prop persist.sys.locale=%MISO_LOCALE%
start "Miso Boot" /MIN cmd /c ""%~dp0emulator-boot-helper.bat""
endlocal
