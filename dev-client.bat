@echo off
chcp 65001 >nul
cd /d "%~dp0client"
title SK클린텍 Vite :5173
echo [Vite] http://localhost:5173
echo.
npm run dev
echo.
echo Vite가 종료되었습니다.
pause
