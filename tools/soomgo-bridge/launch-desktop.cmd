@echo off
cd /d "%~dp0"

set "LOGDIR=%LOCALAPPDATA%\Cbiseo\SoomgoBridge"
if not exist "%LOGDIR%" mkdir "%LOGDIR%" >nul 2>&1
set "LOG=%LOGDIR%\launch.log"

rem embed Python은 cwd만으로 desktop 패키지를 못 찾음 — 앱 루트를 PYTHONPATH에 고정
set "PYTHONPATH=%~dp0"

>>"%LOG%" echo === %date% %time% launch-desktop.cmd ===
>>"%LOG%" echo PYTHONPATH=%PYTHONPATH%

if exist "%~dp0python\pythonw.exe" (
  "%~dp0python\pythonw.exe" -u -m desktop.tray_app >>"%LOG%" 2>&1
) else (
  pythonw -u -m desktop.tray_app >>"%LOG%" 2>&1
)

if errorlevel 1 (
  >>"%LOG%" echo pythonw failed — retry with python.exe
  if exist "%~dp0python\python.exe" (
    start "" /min /D "%~dp0" "%~dp0python\python.exe" -u -m desktop.tray_app
  ) else (
    start "" /min /D "%~dp0" python -u -m desktop.tray_app
  )
)
