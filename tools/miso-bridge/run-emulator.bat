@echo off
setlocal
call "%~dp0avd-config.bat"
set "EMU=%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe"

if not exist "%EMU%" (
  echo ERROR: emulator.exe not found. Install Android Emulator via SDK Manager.
  pause
  exit /b 1
)

echo AVD: %MISO_AVD%  Locale: %MISO_LOCALE%
echo Boot takes 1-3 min. adb offline in log is OK until home screen.
echo.

start "Miso %MISO_AVD%" "%EMU%" -avd %MISO_AVD% -gpu swiftshader_indirect -no-boot-anim -no-audio -prop persist.sys.locale=%MISO_LOCALE%

start "Miso Boot" /MIN cmd /c ""%~dp0emulator-boot-helper.bat""

endlocal
