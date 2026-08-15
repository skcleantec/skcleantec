@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "LOGDIR=%LOCALAPPDATA%\Cbiseo\SoomgoBridge"
if not exist "%LOGDIR%" mkdir "%LOGDIR%" >nul 2>&1
rem tray_app도 launch.log에 쓰므로 cmd 부트스트랩은 별도 파일 (동시 실행 시 잠금 방지)
set "LOG=%LOGDIR%\launch-cmd.log"
set "PYTHONPATH=%~dp0"

>>"%LOG%" echo === %date% %time% launch-desktop.cmd ===
>>"%LOG%" echo PYTHONPATH=%PYTHONPATH%

set "PYW="
set "PY="

rem 1) 번들 Python — tkinter 포함 시 우선 (Setup 본편)
if exist "%~dp0python\python.exe" (
  "%~dp0python\python.exe" -c "import tkinter" 2>nul
  if not errorlevel 1 (
    set "PYW=%~dp0python\pythonw.exe"
    set "PY=%~dp0python\python.exe"
    >>"%LOG%" echo python=bundled tkinter=ok
  ) else (
    >>"%LOG%" echo bundled python missing tkinter — try system python
  )
)

rem 2) PC에 설치된 Python (tkinter 있는 경우 — 구버전 Setup 임시 폴백)
if not defined PY (
  where python >nul 2>&1
  if not errorlevel 1 (
    for /f "delims=" %%I in ('where python 2^>nul') do (
      "%%I" -c "import tkinter" 2>nul
      if not errorlevel 1 (
        set "PY=%%I"
        if exist "%%~dpIpythonw.exe" (
          set "PYW=%%~dpIpythonw.exe"
        ) else (
          set "PYW=%%I"
        )
        >>"%LOG%" echo python=system path=%%I
        goto :launch
      )
    )
  )
)

:launch
if not defined PYW (
  >>"%LOG%" echo FATAL: tkinter 없는 Python만 발견됨 — Setup 2.1.14 이상 재설치 또는 run-desktop-debug.bat
  mshta "javascript:alert('Python(tkinter) 환경이 없어 숨고 연동을 시작할 수 없습니다.\n\nSetup 2.1.14 이상을 설치하거나,\n개발 PC에서는 run-desktop-debug.bat 으로 오류를 확인하세요.');close()"
  exit /b 1
)

"%PYW%" -u -m desktop.tray_app >>"%LOGDIR%\launch.log" 2>&1
if not errorlevel 1 exit /b 0

>>"%LOG%" echo pythonw failed — retry with python.exe
start "" /min /D "%~dp0" "%PY%" -u -m desktop.tray_app >>"%LOGDIR%\launch.log" 2>&1
