@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "LOGDIR=%LOCALAPPDATA%\Cbiseo\MisoBridge"
if not exist "%LOGDIR%" mkdir "%LOGDIR%" >nul 2>&1
set "LOG=%LOGDIR%\launch-cmd.log"
set "PYTHONPATH=%~dp0"
set "PYTHONIOENCODING=utf-8"
set "PYTHONUTF8=1"
set "ANDROID_SDK_ROOT=%LOCALAPPDATA%\Cbiseo\MisoBridge\sdk"
set "ANDROID_HOME=%ANDROID_SDK_ROOT%"

>>"%LOG%" echo === %date% %time% launch-desktop.cmd ===

set "PYW="
set "PY="

if exist "%~dp0python\python.exe" (
  "%~dp0python\python.exe" -c "import tkinter" 2>nul
  if not errorlevel 1 (
    set "PYW=%~dp0python\pythonw.exe"
    set "PY=%~dp0python\python.exe"
    >>"%LOG%" echo python=bundled tkinter=ok
  )
)

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
        goto :launch
      )
    )
  )
)

:launch
if not defined PYW (
  >>"%LOG%" echo FATAL: no python with tkinter
  mshta "javascript:alert('Python(tkinter) is missing. Install Setup again.');close()"
  exit /b 1
)

"%PYW%" -u -m desktop.tray_app
exit /b !ERRORLEVEL!
