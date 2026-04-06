@echo off
chcp 65001 >nul
cd /d "%~dp0server"
title SK클린텍 API :3000
echo [API] http://localhost:3000
echo.
npm run dev
echo.
echo API 서버가 종료되었습니다.
pause
