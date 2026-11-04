@echo off
setlocal
call "%~dp0avd-config.bat"
set "EMU=%LOCALAPPDATA%\Cbiseo\MisoBridge\sdk\emulator\emulator.exe"
if not exist "%EMU%" set "EMU=%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe"

if not exist "%EMU%" (
  echo ERROR: emulator.exe not found.
  pause
  exit /b 1
)

echo AVD: %MISO_AVD% (cold boot)
call "%~dp0locale-launch-args.bat"
start "Miso %MISO_AVD%" "%EMU%" -avd %MISO_AVD% -gpu swiftshader_indirect -no-boot-anim -no-audio -no-snapshot-load %MISO_LOCALE_EXTRA%

start "Miso Boot" /MIN cmd /c ""%~dp0emulator-boot-helper.bat""
endlocal
