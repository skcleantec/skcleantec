@echo off
cd /d "%~dp0"

set "LOGDIR=%LOCALAPPDATA%\Cbiseo\SoomgoBridge"
if not exist "%LOGDIR%" mkdir "%LOGDIR%" >nul 2>&1
set "LOG=%LOGDIR%\launch.log"

>>"%LOG%" echo === %date% %time% launch-desktop.cmd ===

if exist "%~dp0python\pythonw.exe" (
  "%~dp0python\pythonw.exe" -u -m desktop.tray_app >>"%LOG%" 2>&1
) else (
  pythonw -u -m desktop.tray_app >>"%LOG%" 2>&1
)

if errorlevel 1 (
  >>"%LOG%" echo pythonw failed — retry with python.exe
  if exist "%~dp0python\python.exe" (
    start "" /min "%~dp0python\python.exe" -u -m desktop.tray_app
  ) else (
    start "" /min python -u -m desktop.tray_app
  )
)
