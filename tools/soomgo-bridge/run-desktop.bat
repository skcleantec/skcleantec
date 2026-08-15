@echo off
cd /d "%~dp0"

set "SD=%LOCALAPPDATA%\Cbiseo\SoomgoBridge"
if not exist "%SD%" mkdir "%SD%" >nul 2>&1

rem 이미 브릿지가 떠 있으면 상태창만 다시 띄우고 안내 (무반응 방지)
curl.exe -s -m 2 http://127.0.0.1:17890/status?lite=1 >nul 2>&1
if not errorlevel 1 (
  echo 1>"%SD%\show.window"
  mshta "javascript:alert('청소비서 숨고 연동이 이미 실행 중입니다.\n\n작업 표시줄 트레이(^)에서 「청소비서 숨고 연동」 아이콘을 클릭하거나,\n방금 상태창을 다시 열었습니다.');close()"
  exit /b 0
)

start "" wscript.exe "%~dp0launch-desktop.vbs"
