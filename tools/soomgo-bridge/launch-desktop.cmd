@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "LOGDIR=%LOCALAPPDATA%\Cbiseo\SoomgoBridge"
if not exist "%LOGDIR%" mkdir "%LOGDIR%" >nul 2>&1
rem tray_app writes tray-events.log. This bootstrap uses launch-cmd.log.
set "LOG=%LOGDIR%\launch-cmd.log"
set "PYTHONPATH=%~dp0"

>>"%LOG%" echo === %date% %time% launch-desktop.cmd ===
>>"%LOG%" echo PYTHONPATH=%PYTHONPATH%

set "PYW="
set "PY="

rem 1) Bundled Python with tkinter (Setup)
if exist "%~dp0python\python.exe" (
  "%~dp0python\python.exe" -c "import tkinter" 2>nul
  if not errorlevel 1 (
    set "PYW=%~dp0python\pythonw.exe"
    set "PY=%~dp0python\python.exe"
    >>"%LOG%" echo python=bundled tkinter=ok
  ) else (
    >>"%LOG%" echo bundled python missing tkinter - try system python
  )
)

rem 2) System Python with tkinter
if not defined PY (
  where python >nul 2>&1
  if not errorlevel 1 (
    for /f "delims=" %%I in ('where python 2^>nul') do (
      "%%I" -c "import tkinter" 2>nul
      if not errorlevel 1 (
        set "PY=%%I"
        if exist "%%~dpIpythonw.exe" (
          set "PYW=%%~dpIpythonw.exe"
        ) else (
          set "PYW=%%I"
        )
        >>"%LOG%" echo python=system path=%%I
        goto :launch
      )
    )
  )
)

:launch
if not defined PYW (
  >>"%LOG%" echo FATAL: no python with tkinter
  mshta "javascript:alert('Python(tkinter) is missing. Install Setup again, or run run-desktop-debug.bat.');close()"
  exit /b 1
)

powershell -NoProfile -Command "[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()" > "%TEMP%\soomgo-launch-t0.txt"
"%PYW%" -u -m desktop.tray_app >>"%LOGDIR%\launch.log" 2>&1
set "RC=!ERRORLEVEL!"
if "!RC!"=="0" (
  >>"%LOG%" echo pythonw exit 0 - no retry
  exit /b 0
)
set "ELAPSED=999"
powershell -NoProfile -Command "$t0=[int64](Get-Content -LiteralPath $env:TEMP\soomgo-launch-t0.txt); $sec=[int](([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()-$t0)/1000); Set-Content -LiteralPath $env:TEMP\soomgo-launch-elapsed.txt -Value $sec -NoNewline"
if exist "%TEMP%\soomgo-launch-elapsed.txt" set /p ELAPSED=<"%TEMP%\soomgo-launch-elapsed.txt"
if !ELAPSED! GEQ 10 (
  >>"%LOG%" echo pythonw exit !RC! after !ELAPSED!s - no retry
  exit /b !RC!
)
>>"%LOG%" echo pythonw exit !RC! within !ELAPSED!s - retry python.exe
"%PY%" -u -m desktop.tray_app >>"%LOGDIR%\launch.log" 2>&1
set "RC=!ERRORLEVEL!"
>>"%LOG%" echo python.exe exit !RC!
exit /b !RC!
