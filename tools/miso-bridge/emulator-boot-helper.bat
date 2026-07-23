@echo off
setlocal EnableDelayedExpansion
REM After emulator start: boot, locale ko-KR, Korean IME ready
call "%~dp0avd-config.bat"
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB%" exit /b 0

timeout /t 90 /nobreak >nul

set /a N=0
:WaitOnline
set /a N+=1
if !N! GTR 60 exit /b 1
"%ADB%" devices 2>nul | findstr /R /C:"emulator-[0-9][0-9]* device" >nul
if errorlevel 1 (
  timeout /t 5 /nobreak >nul
  goto WaitOnline
)

set /a BOOT=0
:WaitBoot
set BOOT_DONE=
for /f "delims=" %%B in ('"%ADB%" shell getprop sys.boot_completed 2^>nul') do set BOOT_DONE=%%B
if "!BOOT_DONE!"=="1" goto AfterBoot
set /a BOOT+=1
if !BOOT! GEQ 40 goto AfterBoot
timeout /t 3 /nobreak >nul
goto WaitBoot

:AfterBoot
"%ADB%" shell input keyevent 26 >nul 2>&1
"%ADB%" shell input keyevent 82 >nul 2>&1
"%ADB%" shell wm dismiss-keyguard >nul 2>&1

set "NEED_REBOOT=0"
set "CUR="
for /f "delims=" %%L in ('"%ADB%" shell settings get system system_locales 2^>nul') do set "CUR=%%L"
echo !CUR! | findstr /I "ko" >nul
if errorlevel 1 (
  echo Applying locale %MISO_LOCALE%...
  "%ADB%" shell settings put system system_locales %MISO_LOCALE%
  set "NEED_REBOOT=1"
)

call :ApplyKeyboard
if "!NEED_REBOOT!"=="1" (
  "%ADB%" reboot
  exit /b 0
)
exit /b 0

:ApplyKeyboard
REM Soft keyboard on; Korean follows system locale on Play AVD
"%ADB%" shell settings put secure show_ime_with_hard_keyboard 1 >nul 2>&1
"%ADB%" shell settings put secure default_input_method com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME >nul 2>&1
exit /b 0
