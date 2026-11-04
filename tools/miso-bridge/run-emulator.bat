@echo off
setlocal
call "%~dp0avd-config.bat"
set "EMU=%LOCALAPPDATA%\Cbiseo\MisoBridge\sdk\emulator\emulator.exe"
if not exist "%EMU%" set "EMU=%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe"

if not exist "%EMU%" (
  echo ERROR: emulator.exe not found. Install Android Emulator via SDK Manager.
  pause
  exit /b 1
)

echo 가상폰: %MISO_AVD%
echo 켜지는 데 1~3분 걸릴 수 있습니다. 이미 켜져 있으면 그대로 이어갑니다.
echo.

start "Miso %MISO_AVD%" "%EMU%" -avd %MISO_AVD% -gpu swiftshader_indirect -no-boot-anim -no-audio

start "Miso Boot" /MIN cmd /c ""%~dp0emulator-boot-helper.bat""

endlocal
