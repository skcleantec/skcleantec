@echo off
REM 기본은 그래픽카드(-gpu auto). 깨짐·연결 끊김 뒤에만 config의 swiftshader를 쓴다.
set "MISO_GPU=auto"
set "MISO_TZ=-timezone Asia/Seoul"
if exist "%LOCALAPPDATA%\Cbiseo\MisoBridge\config.json" (
  findstr /C:"swiftshader_indirect" "%LOCALAPPDATA%\Cbiseo\MisoBridge\config.json" >nul && set "MISO_GPU=swiftshader_indirect"
)
exit /b 0
