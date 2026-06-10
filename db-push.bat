@echo off
chcp 65001 >nul
echo [주의] prisma db push 는 현재 DATABASE_URL DB 스키마를 바꿉니다.
echo 팀 기본은 Railway staging — 실수 방지를 위해 setup-local-staging.bat 로 URL을 먼저 확인하세요.
pause
cd /d "%~dp0server"
call npx.cmd prisma db push
pause
