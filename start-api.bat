@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [SK클린텍] API 서버 포트 3000 시작 (npm run dev:server)
echo 창을 닫거나 Ctrl+C 로 종료할 수 있습니다.
echo.
call npm run dev:server
pause
