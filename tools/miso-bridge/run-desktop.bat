@echo off
cd /d "%~dp0"
set "PYTHONPATH=%~dp0"
if exist "%~dp0python\python.exe" (
  "%~dp0python\python.exe" -u -m desktop.tray_app
) else (
  python -u -m desktop.tray_app
)
