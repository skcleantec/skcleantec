@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [SK클린텍] 포트 3000 API 서버 종료
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-api.ps1"
echo.
pause
