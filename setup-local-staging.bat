@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Railway staging DB로 로컬 API를 맞춥니다.
echo STAGING_SETUP.md 「로컬 server/.env를 스테이징 DB로」 참고
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\apply-local-staging-env.ps1"
pause
