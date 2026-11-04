@echo off
setlocal EnableDelayedExpansion
REM 이미 켜진 가상폰(Android Studio 포함)도 알아보고, 한국어·화면 꺼짐·잠금을 맞춘다.
call "%~dp0avd-config.bat"
set "ADB=%LOCALAPPDATA%\Cbiseo\MisoBridge\sdk\platform-tools\adb.exe"
if not exist "%ADB%" set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB%" (
  echo adb를 찾지 못했습니다.
  exit /b 1
)

set "LOCALE_DONE=0"

:WaitReady
echo 가상폰 연결을 기다리는 중...
"%ADB%" wait-for-device
if errorlevel 1 (
  echo 가상폰에 연결하지 못했습니다.
  exit /b 1
)

set /a FIND=0
:FindEmu
set "SERIAL="
"%ADB%" devices > "%TEMP%\miso-adb-devices.txt" 2>nul
for /f "tokens=1,2" %%A in (%TEMP%\miso-adb-devices.txt) do (
  set "NAME=%%A"
  set "STATE=%%B"
  echo !NAME! | findstr /B /I "emulator-" >nul
  if not errorlevel 1 if "!STATE!"=="device" set "SERIAL=!NAME!"
)
if defined SERIAL goto HaveSerial
set /a FIND+=1
if !FIND! GEQ 90 (
  echo 켜진 가상폰을 찾지 못했습니다.
  exit /b 1
)
echo 켜진 가상폰을 찾는 중...
timeout /t 2 /nobreak >nul
goto FindEmu

:HaveSerial
echo 가상폰이 연결되었습니다.
set /a BOOT=0
:WaitBoot
set "BOOT_DONE="
for /f "delims=" %%B in ('"%ADB%" -s !SERIAL! shell getprop sys.boot_completed 2^>nul') do set "BOOT_DONE=%%B"
if "!BOOT_DONE!"=="1" goto BootOk
set /a BOOT+=1
if !BOOT! GEQ 40 (
  echo 가상폰 부팅이 끝나지 않았습니다.
  exit /b 1
)
echo 가상폰이 켜지는 중...
timeout /t 3 /nobreak >nul
goto WaitBoot

:BootOk
echo 화면 잠금을 해제하고 화면이 꺼지지 않게 합니다.
"%ADB%" -s !SERIAL! shell input keyevent 224 >nul 2>&1
"%ADB%" -s !SERIAL! shell input keyevent 82 >nul 2>&1
"%ADB%" -s !SERIAL! shell wm dismiss-keyguard >nul 2>&1
"%ADB%" -s !SERIAL! shell settings put system screen_off_timeout 2147483647 >nul 2>&1
"%ADB%" -s !SERIAL! shell svc power stayon true >nul 2>&1
call :ApplyKeyboard

if "!LOCALE_DONE!"=="1" goto Done
set "CUR="
for /f "delims=" %%L in ('"%ADB%" -s !SERIAL! shell settings get system system_locales 2^>nul') do set "CUR=%%L"
echo !CUR! | findstr /I "ko-KR" >nul
if errorlevel 1 (
  echo 표시 언어를 한국어로 맞춘 뒤 가상폰을 다시 시작합니다.
  "%ADB%" -s !SERIAL! shell settings put system system_locales ko-KR
  set "LOCALE_DONE=1"
  "%ADB%" -s !SERIAL! reboot
  goto WaitReady
)

:Done
echo 가상폰 준비가 끝났습니다.
exit /b 0

:ApplyKeyboard
"%ADB%" -s !SERIAL! shell settings put secure show_ime_with_hard_keyboard 1 >nul 2>&1
"%ADB%" -s !SERIAL! shell settings put secure default_input_method com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME >nul 2>&1
exit /b 0
